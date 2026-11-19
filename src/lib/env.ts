/**
 * Leitura centralizada de variáveis de ambiente.
 * O "modo de dados" decide se usamos Supabase (real) ou o armazenamento local de demonstração.
 */
export type DataMode = "supabase" | "demo";

export function getDataMode(): DataMode {
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? "supabase"
    : "demo";
}

export function isDemoMode(): boolean {
  return getDataMode() === "demo";
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

const DEV_FALLBACK_SECRET = "scalex-dev-only-secret-do-not-use-in-production-0123456789";

export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production" && !isDemoMode()) {
    throw new Error("SESSION_SECRET (>= 32 caracteres) é obrigatório em produção.");
  }
  return DEV_FALLBACK_SECRET;
}

export type InstagramConfig = {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphVersion: string;
};

/** Retorna null quando a integração oficial ainda não foi configurada. */
export function instagramConfig(): InstagramConfig | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret || !process.env.TOKEN_ENCRYPTION_KEY) return null;
  return {
    appId,
    appSecret,
    redirectUri:
      process.env.INSTAGRAM_REDIRECT_URI ?? `${appUrl()}/api/integrations/instagram/callback`,
    graphVersion: process.env.INSTAGRAM_GRAPH_VERSION ?? "v25.0",
  };
}

export function dailyPublishLimit(): number {
  const n = Number(process.env.INSTAGRAM_DAILY_PUBLISH_LIMIT ?? 25);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 25;
}
