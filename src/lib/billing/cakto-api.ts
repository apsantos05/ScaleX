import "server-only";

/**
 * Cliente mínimo da API pública da Cakto (OAuth client credentials).
 * Usado só para ações que o dono do workspace dispara pela ScaleX (cancelar assinatura).
 * Credenciais: CAKTO_CLIENT_ID e CAKTO_CLIENT_SECRET (painel Cakto › Integrações › API).
 */
const BASE = "https://api.cakto.com.br/public_api";

let cached: { token: string; exp: number } | null = null;

export function isCaktoApiConfigured(): boolean {
  return !!process.env.CAKTO_CLIENT_ID && !!process.env.CAKTO_CLIENT_SECRET;
}

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  const res = await fetch(`${BASE}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.CAKTO_CLIENT_ID ?? "", client_secret: process.env.CAKTO_CLIENT_SECRET ?? "" }),
    signal: AbortSignal.timeout(3_500),
  });
  if (!res.ok) throw new Error(`cakto-token-${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

/** Cancela as cobranças futuras. O webhook subscription_canceled atualiza o plano depois. */
export async function cancelCaktoSubscription(subscriptionId: string): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  const res = await fetch(`${BASE}/subscriptions/${encodeURIComponent(subscriptionId)}/cancel/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}` },
    signal: AbortSignal.timeout(3_500),
  });
  if (res.ok) return { ok: true };
  const body = (await res.json().catch(() => ({}))) as { detail?: string };
  return { ok: false, status: res.status, detail: body.detail ?? "" };
}
