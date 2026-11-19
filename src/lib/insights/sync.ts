import "server-only";
import { supabaseAdminClient } from "@/lib/data/supabase-admin";
import { canReadInsights } from "@/lib/domain/instagram-scopes";
import { getGraphAdapter, ProviderError } from "@/lib/integrations/instagram";
import { decryptSecret, redact } from "@/lib/security/crypto";

/**
 * Coleta de métricas do Instagram (roda a cada hora via /api/cron/insights).
 * - Publicações reais (não simuladas) dos últimos 30 dias: com a permissão de insights, busca
 *   alcance/visualizações/curtidas/comentários/salvamentos/compartilhamentos; sem ela, só
 *   curtidas e comentários (permissão básica).
 * - Contas reais ativas: um retrato diário de seguidores.
 * Nunca inventa número: o que a API não devolve fica vazio.
 */

const WINDOW_DAYS = 30;
const REFRESH_AFTER_MS = 55 * 60_000;
const MAX_TARGETS = 300;
const TIME_BUDGET_MS = 45_000;

type TargetRow = {
  id: string;
  workspace_id: string;
  social_account_id: string;
  provider_media_id: string;
  published_at: string;
  publications: { format: string } | null;
};
type AccountRow = { id: string; workspace_id: string; provider_account_id: string; scopes: string[]; status: string; is_demo: boolean };

export type InsightsSyncResult = { media: number; basicOnly: number; failed: number; accounts: number; skipped: number };

const dayInSaoPaulo = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export async function syncInsights(now = new Date()): Promise<InsightsSyncResult> {
  const started = Date.now();
  const result: InsightsSyncResult = { media: 0, basicOnly: 0, failed: 0, accounts: 0, skipped: 0 };
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
    if (Date.now() - started > TIME_BUDGET_MS / 3) break;
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
      console.warn(JSON.stringify({ svc: "insights", event: "profile_failed", account: acc.id, error: redact((err as Error).message) }));
    }
  }

  // ── 2) Métricas por publicação ──
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const tRes = await db
    .from("publication_targets")
    .select("id, workspace_id, social_account_id, provider_media_id, published_at, publications(format)")
    .eq("status", "published")
    .eq("simulated", false)
    .not("provider_media_id", "is", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(MAX_TARGETS);
  if (tRes.error) throw new Error(tRes.error.message);
  const targets = tRes.data as unknown as TargetRow[];
  if (targets.length === 0) return result;

  const fresh = await db.from("media_insights").select("target_id, fetched_at").in("target_id", targets.map((t) => t.id));
  const lastFetch = new Map(((fresh.data ?? []) as { target_id: string; fetched_at: string }[]).map((r) => [r.target_id, Date.parse(r.fetched_at)]));

  for (const t of targets) {
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const acc = accounts.get(t.social_account_id);
    if (!acc) continue;
    if (now.getTime() - (lastFetch.get(t.id) ?? 0) < REFRESH_AFTER_MS) {
      result.skipped++;
      continue;
    }
    const token = await tokenFor(acc.id);
    if (!token) continue;
    const base = { target_id: t.id, workspace_id: t.workspace_id, social_account_id: acc.id, provider_media_id: t.provider_media_id, fetched_at: now.toISOString() };
    try {
      if (canReadInsights(acc.scopes ?? [])) {
        const m = await adapter.getMediaInsights(token, t.provider_media_id, t.publications?.format);
        // Stories não trazem curtidas/comentários em insights; o restante vem completo.
        const basic = m.likes == null && m.comments == null && t.publications?.format !== "STORIES" ? await adapter.getMediaBasic(token, t.provider_media_id) : null;
        await db.from("media_insights").upsert(
          { ...base, ...m, likes: m.likes ?? basic?.likes ?? null, comments: m.comments ?? basic?.comments ?? null, source: "insights", last_error: null },
          { onConflict: "target_id" },
        );
        result.media++;
      } else {
        const b = await adapter.getMediaBasic(token, t.provider_media_id);
        await db.from("media_insights").upsert({ ...base, likes: b.likes, comments: b.comments, source: "basic", last_error: null }, { onConflict: "target_id" });
        result.basicOnly++;
      }
    } catch (err) {
      const msg = err instanceof ProviderError ? `${err.kind}: ${err.message}` : (err as Error).message;
      // Mantém os números anteriores; registra só o erro e o horário da tentativa.
      await db.from("media_insights").upsert({ ...base, source: "basic", last_error: redact(msg).slice(0, 300) }, { onConflict: "target_id" });
      result.failed++;
    }
  }
  return result;
}
