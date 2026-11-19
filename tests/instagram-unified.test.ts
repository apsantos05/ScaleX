import { describe, expect, it } from "vitest";
import type { InstagramConfig } from "@/lib/env";
import { GraphInstagramAdapter, ProviderError } from "@/lib/integrations/instagram";

const base: InstagramConfig = {
  appId: "111",
  appSecret: "shh",
  redirectUri: "https://app.exemplo.com/api/integrations/instagram/callback",
  graphVersion: "v25.0",
  configId: "1122224850703890",
  fallbackAccountIds: [],
};

/** fetch falso: responde por caminho e guarda as chamadas. */
function fakeFetch(routes: Record<string, unknown>) {
  const calls: URL[] = [];
  const impl = (async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.pathname.endsWith(k));
    const body = key ? routes[key] : { error: { message: "não encontrado", code: 100 } };
    const isErr = typeof body === "object" && body !== null && "error" in body;
    return new Response(JSON.stringify(body), { status: isErr ? 400 : 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

describe("Instagram com login unificado (config_id)", () => {
  it("monta o diálogo do Facebook com config_id e sem scope", () => {
    const u = new URL(new GraphInstagramAdapter(base).authorizeUrl("st"));
    expect(u.origin + u.pathname).toBe("https://www.facebook.com/v25.0/dialog/oauth");
    expect(u.searchParams.get("config_id")).toBe("1122224850703890");
    expect(u.searchParams.get("override_default_response_type")).toBe("true");
    expect(u.searchParams.get("scope")).toBeNull();
    expect(u.searchParams.get("redirect_uri")).toBe(base.redirectUri);
  });

  it("troca o code, confere permissões e trata 'nunca expira' como sem validade", async () => {
    const { impl } = fakeFetch({
      "/oauth/access_token": { access_token: "SUAT" },
      "/debug_token": { data: { is_valid: true, expires_at: 0, user_id: "9", scopes: ["instagram_basic", "instagram_content_publish"] } },
    });
    const r = await new GraphInstagramAdapter(base, impl).exchangeCode("abc");
    expect(r).toMatchObject({ accessToken: "SUAT", expiresInSec: null });
  });

  it("recusa autorização sem permissão de publicar", async () => {
    const { impl } = fakeFetch({
      "/oauth/access_token": { access_token: "SUAT" },
      "/debug_token": { data: { is_valid: true, expires_at: 0, scopes: ["instagram_basic"] } },
    });
    await expect(new GraphInstagramAdapter(base, impl).exchangeCode("abc")).rejects.toBeInstanceOf(ProviderError);
  });

  it("lista as contas liberadas e usa graph.facebook.com", async () => {
    const { impl, calls } = fakeFetch({
      "/me/assigned_instagram_accounts": { data: [{ id: "1784" }, { id: "1785" }] },
      "/1784": { id: "1784", username: "loja_a", name: "Loja A", followers_count: 10 },
      "/1785": { id: "1785", username: "loja_b" },
    });
    const list = await new GraphInstagramAdapter(base, impl).listAuthorizedAccounts("SUAT");
    expect(list.map((p) => p.username)).toEqual(["loja_a", "loja_b"]);
    expect(calls.every((c) => c.host === "graph.facebook.com")).toBe(true);
  });

  it("usa IDs de reserva quando a lista vem vazia e ignora os inacessíveis", async () => {
    const { impl } = fakeFetch({
      "/me/assigned_instagram_accounts": { data: [] },
      "/1786": { id: "1786", username: "propria" },
    });
    const list = await new GraphInstagramAdapter({ ...base, fallbackAccountIds: ["1786", "1799"] }, impl).listAuthorizedAccounts("SUAT");
    expect(list.map((p) => p.username)).toEqual(["propria"]);
  });

  it("sem config_id, continua no modo legado (graph.instagram.com)", () => {
    const legacy = new GraphInstagramAdapter({ ...base, configId: null });
    expect(legacy.unified).toBe(false);
    expect(new URL(legacy.authorizeUrl("st")).host).toBe("www.instagram.com");
  });
});
