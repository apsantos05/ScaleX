import { NextResponse, type NextRequest } from "next/server";
import { getRepo, getSystemRepo } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth/session";
import { sessionSecret } from "@/lib/env";
import { getGraphAdapter, ProviderError } from "@/lib/integrations/instagram";
import { encryptSecret, redact, verify } from "@/lib/security/crypto";

const NONCE_COOKIE = "sx_ig_nonce";
const SUPPORTED_TYPES = ["BUSINESS", "MEDIA_CREATOR", "CREATOR"];

/**
 * Callback OAuth: valida state (assinatura + nonce em cookie + expiração + usuário),
 * troca o code por token longo, valida o tipo de conta e grava o token CRIPTOGRAFADO.
 * O token nunca é enviado ao navegador.
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
    const profile = await adapter.getProfile(token.accessToken);
    if (profile.accountType && !SUPPORTED_TYPES.includes(profile.accountType.toUpperCase())) {
      return back("error=conta_nao_profissional");
    }
    const expiresAt = new Date(Date.now() + token.expiresInSec * 1000).toISOString();
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
    await getSystemRepo().saveCredential(account.id, encryptSecret(token.accessToken), expiresAt);
    await repo.addAudit({
      workspaceId: state.ws,
      actorId: user.id,
      action: "account.connected",
      entity: "social_account",
      entityId: account.id,
      meta: { username: profile.username, scopes: token.scopes },
    });
    return back(`connected=${encodeURIComponent(profile.username)}`);
  } catch (err) {
    console.error(JSON.stringify({ svc: "oauth", event: "callback_failed", error: redact((err as Error).message), kind: err instanceof ProviderError ? err.kind : "unknown" }));
    return back("error=falha_na_conexao");
  }
}
