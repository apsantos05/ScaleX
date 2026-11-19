import "server-only";
import { supabaseAdminClient } from "@/lib/data/supabase-admin";
import { canReadInsights } from "@/lib/domain/instagram-scopes";
import { getGraphAdapter, ProviderError } from "@/lib/integrations/instagram";
import { decryptSecret, redact } from "@/lib/security/crypto";

/**
 * Coleta de métricas do Instagram (roda a cada hora via /api/cron/insights).
 * - Contas reais ativas: um retrato diário de seguidores.
 * - Todos os posts das contas nos últimos 90 dias (feitos pela ScaleX ou direto no Instagram):
 *   importados para instagram_posts, com métricas atualizadas. Com a permissão de insights:
 *   alcance/visualizações/curtidas/comentários/salvamentos/compartilhamentos; sem ela, só
 *   curtidas e comentários. Posts da última semana a cada hora; os mais antigos a cada 6 horas.
 * Nunca inventa número: o que a API não devolve fica vazio.
 */

const POSTS_WINDOW_DAYS = 90;
const MAX_POSTS_PER_ACCOUNT = 200;
const MAX_POST_METRICS = 400;
const REFRESH_AFTER_MS = 55 * 60_000;
const REFRESH_OLD_AFTER_MS = 6 * 3_600_000;
const TIME_BUDGET_MS = 45_000;

type AccountRow = { id: string; workspace_id: string; provider_account_id: string; scopes: string[]; status: string; is_demo: boolean };
type PostRow = {
  id: string;
  social_account_id: string;
  provider_media_id: string;
  product_type: string | null;
  posted_at: string;
  metrics_fetched_at: string | null;
};

export type InsightsSyncResult = { media: number; basicOnly: number; failed: number; accounts: number; skipped: number; imported: number };

const dayInSaoPaulo = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const errMsg = (err: unknown) => redact(err instanceof ProviderError ? `${err.kind}: ${err.message}` : (err as Error).message).slice(0, 300);

/** Quais posts precisam de métrica agora: os nunca coletados primeiro, depois os mais recentes. */
export function postsDue(posts: PostRow[], now: Date): { due: PostRow[]; skipped: number } {
  let skipped = 0;
  const due = posts
    .filter((p) => {
      if (!p.metrics_fetched_at) return true;
      const old = now.getTime() - Date.parse(p.posted_at) > 7 * 86_400_000;
      const fresh = now.getTime() - Date.parse(p.metrics_fetched_at) < (old ? REFRESH_OLD_AFTER_MS : REFRESH_AFTER_MS);
      if (fresh) skipped++;
      return !fresh;
    })
    .sort((a, b) => Number(!!a.metrics_fetched_at) - Number(!!b.metrics_fetched_at) || Date.parse(b.posted_at) - Date.parse(a.posted_at))
    .slice(0, MAX_POST_METRICS);
  return { due, skipped };
}

export async function syncInsights(now = new Date()): Promise<InsightsSyncResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  const result: InsightsSyncResult = { media: 0, basicOnly: 0, failed: 0, accounts: 0, skipped: 0, imported: 0 };
  const adapter = getGraphAdapter();
  if (!adapter) return result;
  const db = supabaseAdminClient();

  const accRes = await db.from("social_accounts").select("id, workspace_id, provider_account_id, scopes, status, is_demo").eq("is_demo", false).eq("status", "active");
  if (accRes.error) throw new Error(accRes.error.message);
  const accounts = new Map((accRes.data as AccountRow[]).map((a) => [a.id, a]));
  if (accounts.size === 0) return result;

  // Um token por conta, descriptografado só quando necessário.
  const tokens = new Map<string, string | null>();
  async function tokenFor(accountId: string): Promise<string | null> {
    if (tokens.has(accountId)) return tokens.get(accountId)!;
    const r = await db.from("social_account_credentials").select("ciphertext").eq("account_id", accountId).maybeSingle();
    let t: string | null = null;
    if (!r.error && r.data) {
      try {
        t = decryptSecret((r.data as { ciphertext: string }).ciphertext);
      } catch {
        t = null;
      }
    }
    tokens.set(accountId, t);
    return t;
  }

  // ── 1) Retrato diário de seguidores ──
  const today = dayInSaoPaulo(now);
  for (const acc of accounts.values()) {
    if (elapsed() > TIME_BUDGET_MS / 4) break;
    const token = await tokenFor(acc.id);
    if (!token) continue;
    try {
      const p = await adapter.getProfile(token, acc.provider_account_id);
      await db.from("account_snapshots").upsert(
        { social_account_id: acc.id, workspace_id: acc.workspace_id, day: today, followers_count: p.followersCount },
        { onConflict: "social_account_id,day" },
      );
      await db.from("social_accounts").update({ followers_count: p.followersCount, avatar_url: p.avatarUrl, last_synced_at: now.toISOString() }).eq("id", acc.id);
      result.accounts++;
    } catch (err) {
      console.warn(JSON.stringify({ svc: "insights", event: "profile_failed", account: acc.id, error: errMsg(err) }));
    }
  }

  // ── 2) Importa os posts de cada conta (feitos pela ScaleX ou direto no Instagram) ──
  const postsSince = new Date(now.getTime() - POSTS_WINDOW_DAYS * 86_400_000).toISOString();
  const viaScalex = new Set<string>();
  {
    const r = await db.from("publication_targets").select("provider_media_id").eq("status", "published").eq("simulated", false).not("provider_media_id", "is", null);
    for (const row of (r.data ?? []) as { provider_media_id: string }[]) viaScalex.add(row.provider_media_id);
  }
  for (const acc of accounts.values()) {
    if (elapsed() > TIME_BUDGET_MS / 2) break;
    const token = await tokenFor(acc.id);
    if (!token) continue;
    try {
      const media = await adapter.listAccountMedia(token, acc.provider_account_id, postsSince, MAX_POSTS_PER_ACCOUNT);
      if (media.length === 0) continue;
      const up = await db.from("instagram_posts").upsert(
        media.map((m) => ({
          workspace_id: acc.workspace_id,
          social_account_id: acc.id,
          provider_media_id: m.id,
          media_type: m.mediaType,
          product_type: m.productType,
          caption: m.caption?.slice(0, 2200) ?? null,
          permalink: m.permalink,
          posted_at: m.timestamp,
          via_scalex: viaScalex.has(m.id),
        })),
        { onConflict: "social_account_id,provider_media_id" },
      );
      if (up.error) throw new Error(up.error.message);
      result.imported += media.length;
    } catch (err) {
      console.warn(JSON.stringify({ svc: "insights", event: "media_list_failed", account: acc.id, error: errMsg(err) }));
    }
  }

  // ── 3) Métricas dos posts ──
  const pRes = await db
    .from("instagram_posts")
    .select("id, social_account_id, provider_media_id, product_type, posted_at, metrics_fetched_at")
    .in("social_account_id", [...accounts.keys()])
    .gte("posted_at", postsSince)
    .order("posted_at", { ascending: false })
    .limit(MAX_POSTS_PER_ACCOUNT * accounts.size);
  if (pRes.error) throw new Error(pRes.error.message);
  const { due, skipped } = postsDue(pRes.data as PostRow[], now);
  result.skipped += skipped;

  for (const p of due) {
    if (elapsed() > TIME_BUDGET_MS * 0.85) break;
    const acc = accounts.get(p.social_account_id);
    if (!acc) continue;
    const token = await tokenFor(acc.id);
    if (!token) continue;
    const format = p.product_type === "REELS" ? "REELS" : p.product_type === "STORY" ? "STORIES" : "FEED";
    const stamp = { metrics_fetched_at: now.toISOString() };
    try {
      if (canReadInsights(acc.scopes ?? [])) {
        const m = await adapter.getMediaInsights(token, p.provider_media_id, format);
        const basic = m.likes == null && m.comments == null && format !== "STORIES" ? await adapter.getMediaBasic(token, p.provider_media_id) : null;
        await db
          .from("instagram_posts")
          .update({ ...m, likes: m.likes ?? basic?.likes ?? null, comments: m.comments ?? basic?.comments ?? null, source: "insights", last_error: null, ...stamp })
          .eq("id", p.id);
        result.media++;
      } else {
        const b = await adapter.getMediaBasic(token, p.provider_media_id);
        await db.from("instagram_posts").update({ likes: b.likes, comments: b.comments, source: "basic", last_error: null, ...stamp }).eq("id", p.id);
        result.basicOnly++;
      }
    } catch (err) {
      // Mantém os números anteriores; registra só o erro e o horário da tentativa.
      await db.from("instagram_posts").update({ last_error: errMsg(err), ...stamp }).eq("id", p.id);
      result.failed++;
    }
  }

  return result;
}
