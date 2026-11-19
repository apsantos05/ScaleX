import { NextResponse, type NextRequest } from "next/server";
import { getRepo, getSystemRepo } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth/session";
import { planLimits } from "@/lib/domain/plans";
import { sessionSecret } from "@/lib/env";
import { getGraphAdapter, ProviderError } from "@/lib/integrations/instagram";
import { encryptSecret, redact, verify } from "@/lib/security/crypto";

const NONCE_COOKIE = "sx_ig_nonce";
const SUPPORTED_TYPES = ["BUSINESS", "MEDIA_CREATOR", "CREATOR"];

/**
 * Callback OAuth: valida state (assinatura + nonce em cookie + expiração + usuário),
 * troca o code por token e grava o token CRIPTOGRAFADO. O token nunca vai ao navegador.
 *
 * No login unificado uma autorização pode liberar várias contas do Instagram: todas são
 * registradas (até o limite do plano), cada uma com a credencial da autorização.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/app/accounts?${q}`, request.url));
    res.cookies.delete({ name: NONCE_COOKIE, path: "/api/integrations/instagram" });
    return res;
  };

  if (url.searchParams.get("error")) return back("error=autorizacao_negada");
  const code = url.searchParams.get("code");
  const state = verify<{ ws: string; uid: string; nonce: string }>(url.searchParams.get("state") ?? undefined, sessionSecret());
  const nonce = request.cookies.get(NONCE_COOKIE)?.value;
  if (!code || !state || !nonce || state.nonce !== nonce) return back("error=state_invalido");

  const user = await getCurrentUser();
  if (!user || user.id !== state.uid) return back("error=sessao_invalida");

  const repo = await getRepo();
  const membership = await repo.getMembership(state.ws, user.id);
  if (!membership || membership.role === "viewer") return back("error=sem_permissao");

  const adapter = getGraphAdapter();
  if (!adapter) return back("error=integracao_nao_configurada");

  try {
    const token = await adapter.exchangeCode(code.replace(/#_$/, ""));
    const profiles = (await adapter.listAuthorizedAccounts(token.accessToken)).filter(
      (p) => !p.accountType || SUPPORTED_TYPES.includes(p.accountType.toUpperCase()),
    );
    if (profiles.length === 0) return back(adapter.unified ? "error=nenhuma_conta_liberada" : "error=conta_nao_profissional");

    // Limite do plano: contas já conectadas (reconexão não conta de novo) + novas.
    const existing = (await repo.listAccounts(state.ws)).filter((a) => !a.isDemo);
    const known = new Set(existing.map((a) => a.providerAccountId));
    let room = planLimits(membership.workspace.plan).maxAccounts - existing.length;
    const expiresAt = token.expiresInSec ? new Date(Date.now() + token.expiresInSec * 1000).toISOString() : null;
    const ciphertext = encryptSecret(token.accessToken);
    const connected: string[] = [];
    let skipped = 0;

    for (const profile of profiles) {
      if (!known.has(profile.providerAccountId)) {
        if (room <= 0) {
          skipped++;
          continue;
        }
        room--;
      }
      const account = await repo.upsertAccount(state.ws, {
        provider: "instagram",
        providerAccountId: profile.providerAccountId,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        accountType: profile.accountType,
        status: "active",
        scopes: token.scopes,
        tags: [],
        group: null,
        followersCount: profile.followersCount,
        lastSyncedAt: new Date().toISOString(),
        tokenExpiresAt: expiresAt,
        isDemo: false,
      });
      await getSystemRepo().saveCredential(account.id, ciphertext, expiresAt);
      connected.push(profile.username);
    }

    await repo.addAudit({
      workspaceId: state.ws,
      actorId: user.id,
      action: "account.connected",
      entity: "social_account",
      entityId: null,
      meta: { usernames: connected, skipped, mode: adapter.unified ? "unified" : "instagram_login" },
    });
    if (connected.length === 0) return back("error=limite_de_contas");
    const q = new URLSearchParams({ connected: connected.length === 1 ? connected[0]! : `${connected.length} contas` });
    if (skipped) q.set("skipped", String(skipped));
    return back(q.toString());
  } catch (err) {
    console.error(
      JSON.stringify({ svc: "oauth", event: "callback_failed", error: redact((err as Error).message), kind: err instanceof ProviderError ? err.kind : "unknown" }),
    );
    return back("error=falha_na_conexao");
  }
}
