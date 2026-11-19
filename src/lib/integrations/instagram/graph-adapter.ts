import type { InstagramConfig } from "@/lib/env";
import { redact } from "@/lib/security/crypto";
import {
  ProviderError,
  type ContainerStatus,
  type InstagramAdapter,
  type InstagramProfile,
  type MediaInsights,
  type PublishMediaItem,
} from "./types";

/**
 * Adapter oficial da API do Instagram, em dois modos:
 * - Login unificado (padrão para apps novos da Meta): Login do Facebook para Empresas com
 *   config_id, token de usuário do sistema (não expira) e API em graph.facebook.com. Uma
 *   autorização pode liberar várias contas do Instagram (/me/assigned_instagram_accounts).
 * - Instagram Login (legado, graph.instagram.com): mantido para apps antigos.
 * Os endpoints de publicação são os mesmos nos dois hosts.
 * Fluxo de publicação: criar container → aguardar FINISHED → media_publish.
 * Referência: https://developers.facebook.com/docs/instagram-platform/content-publishing/
 *
 * Os tokens são passados no corpo/form (POST) ou query (GET, exigido pela API);
 * URLs nunca são registradas em log sem `redact`.
 */
export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
] as const;

type GraphErrorBody = { error?: { message?: string; code?: number; error_subcode?: number; is_transient?: boolean } };

function classify(status: number, body: GraphErrorBody): ProviderError {
  const e = body.error ?? {};
  const msg = e.message ?? `HTTP ${status}`;
  const code = e.code;
  // 190: token inválido/expirado · 10/200-299: permissão
  if (code === 190 || status === 401) return new ProviderError(msg, "auth", code);
  if (code === 10 || (code && code >= 200 && code < 300)) return new ProviderError(msg, "permanent", code);
  // 4/17/32/613: rate limit de chamadas · 9: limite de publicação
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 9 || status === 429) {
    return new ProviderError(msg, "rate_limit", code);
  }
  if (e.is_transient || status >= 500 || code === 1 || code === 2) return new ProviderError(msg, "transient", code);
  return new ProviderError(msg, "permanent", code);
}

export class GraphInstagramAdapter implements InstagramAdapter {
  readonly simulated = false;
  private readonly base: string;
  readonly unified: boolean;

  constructor(
    private readonly config: InstagramConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.unified = !!config.configId;
    this.base = `https://graph.${this.unified ? "facebook" : "instagram"}.com/${config.graphVersion}`;
  }

  private async call<T>(method: "GET" | "POST", path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(path.startsWith("http") ? path : `${this.base}${path}`);
    let body: URLSearchParams | undefined;
    if (method === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    else body = new URLSearchParams(params);
    let res: Response;
    try {
      res = await this.fetchImpl(url, { method, body, signal: AbortSignal.timeout(30_000) });
    } catch (err) {
      throw new ProviderError(`Falha de rede: ${String(redact((err as Error).message))}`, "transient");
    }
    const json = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
    if (!res.ok || json.error) throw classify(res.status, json);
    return json;
  }

  // ───────────── OAuth ─────────────
  authorizeUrl(state: string): string {
    if (this.unified) {
      // Com config_id não se envia scope: as permissões vêm da configuração criada no painel da Meta.
      const u = new URL(`https://www.facebook.com/${this.config.graphVersion}/dialog/oauth`);
      u.searchParams.set("client_id", this.config.appId);
      u.searchParams.set("redirect_uri", this.config.redirectUri);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("config_id", this.config.configId!);
      u.searchParams.set("override_default_response_type", "true");
      u.searchParams.set("state", state);
      return u.toString();
    }
    const u = new URL("https://www.instagram.com/oauth/authorize");
    u.searchParams.set("client_id", this.config.appId);
    u.searchParams.set("redirect_uri", this.config.redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
    u.searchParams.set("state", state);
    return u.toString();
  }

  /**
   * Login unificado: code → token do usuário do sistema (sem troca por token longo).
   * expiresInSec = null quando a configuração diz "nunca expira".
   */
  private async exchangeUnified(code: string): Promise<{ accessToken: string; userId: string; expiresInSec: number | null; scopes: string[] }> {
    const t = await this.call<{ access_token: string; expires_in?: number }>("GET", `${this.base}/oauth/access_token`, {
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      redirect_uri: this.config.redirectUri,
      code,
    });
    const dbg = await this.call<{ data?: { scopes?: string[]; expires_at?: number; user_id?: string; is_valid?: boolean } }>(
      "GET",
      `${this.base}/debug_token`,
      { input_token: t.access_token, access_token: `${this.config.appId}|${this.config.appSecret}` },
    );
    const d = dbg.data ?? {};
    if (d.is_valid === false) throw new ProviderError("Token recebido da Meta é inválido.", "auth");
    const scopes = d.scopes ?? [];
    for (const required of ["instagram_basic", "instagram_content_publish"]) {
      if (!scopes.includes(required)) throw new ProviderError(`Permissão obrigatória não concedida: ${required}`, "permanent");
    }
    const exp =
      d.expires_at && d.expires_at > 0 ? d.expires_at - Math.floor(Date.now() / 1000) : t.expires_in && t.expires_in > 0 ? t.expires_in : null;
    return { accessToken: t.access_token, userId: String(d.user_id ?? ""), expiresInSec: exp, scopes };
  }

  /**
   * Contas do Instagram liberadas por esta autorização. No login unificado podem ser várias;
   * no modo legado é sempre a própria conta do token.
   */
  async listAuthorizedAccounts(accessToken: string): Promise<InstagramProfile[]> {
    if (!this.unified) return [await this.getProfile(accessToken)];
    const ids = new Set<string>();
    let next: string | undefined = `${this.base}/me/assigned_instagram_accounts`;
    let params: Record<string, string> = { fields: "id", limit: "100", access_token: accessToken };
    for (let page = 0; next && page < 20; page++) {
      const r: { data?: { id: string }[]; paging?: { next?: string } } = await this.call("GET", next, params);
      for (const a of r.data ?? []) ids.add(String(a.id));
      next = r.paging?.next;
      params = {}; // o link "next" já traz todos os parâmetros
    }
    // Quando o app e a conta estão no mesmo portfólio, a lista pode vir vazia mesmo com acesso.
    if (ids.size === 0) for (const id of this.config.fallbackAccountIds) ids.add(id);
    const out: InstagramProfile[] = [];
    for (const id of ids) {
      try {
        out.push(await this.getProfile(accessToken, id));
      } catch (err) {
        if (!(err instanceof ProviderError) || err.kind === "transient") throw err; // sem acesso a essa conta: ignora
      }
    }
    return out;
  }

  /** code → token curto → token longo (60 dias). No login unificado, token do usuário do sistema. */
  async exchangeCode(code: string): Promise<{ accessToken: string; userId: string; expiresInSec: number | null; scopes: string[] }> {
    if (this.unified) return this.exchangeUnified(code);
    const short = await this.call<{ access_token: string; user_id: string | number; permissions?: string[] | string }>(
      "POST",
      "https://api.instagram.com/oauth/access_token",
      {
        client_id: this.config.appId,
        client_secret: this.config.appSecret,
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
        code,
      },
    );
    const long = await this.call<{ access_token: string; expires_in: number }>(
      "GET",
      "https://graph.instagram.com/access_token",
      { grant_type: "ig_exchange_token", client_secret: this.config.appSecret, access_token: short.access_token },
    );
    const perms = short.permissions;
    return {
      accessToken: long.access_token,
      userId: String(short.user_id),
      expiresInSec: long.expires_in,
      scopes: Array.isArray(perms) ? perms : typeof perms === "string" ? perms.split(",") : [...INSTAGRAM_SCOPES],
    };
  }

  async refreshToken(accessToken: string) {
    // Token de usuário do sistema não é renovável por API; com "nunca expira" isso nem é chamado.
    if (this.unified) throw new ProviderError("Token do login unificado não é renovável. Reconecte a conta.", "auth");
    const r = await this.call<{ access_token: string; expires_in: number }>(
      "GET",
      "https://graph.instagram.com/refresh_access_token",
      { grant_type: "ig_refresh_token", access_token: accessToken },
    );
    return { accessToken: r.access_token, expiresInSec: r.expires_in };
  }

  async getProfile(accessToken: string, igUserId?: string): Promise<InstagramProfile> {
    if (this.unified) {
      if (!igUserId) throw new ProviderError("ID da conta do Instagram ausente.", "permanent");
      const p = await this.call<{ id: string; username: string; name?: string; profile_picture_url?: string; followers_count?: number }>(
        "GET",
        `/${igUserId}`,
        { fields: "id,username,name,profile_picture_url,followers_count", access_token: accessToken },
      );
      return {
        providerAccountId: String(p.id),
        username: p.username,
        displayName: p.name ?? p.username,
        avatarUrl: p.profile_picture_url ?? null,
        // Só contas profissionais aparecem para a API.
        accountType: "BUSINESS",
        followersCount: p.followers_count ?? null,
      };
    }
    const r = await this.call<{
      user_id?: string;
      id: string;
      username: string;
      name?: string;
      profile_picture_url?: string;
      account_type?: string;
      followers_count?: number;
    }>("GET", "/me", {
      fields: "user_id,username,name,profile_picture_url,account_type,followers_count",
      access_token: accessToken,
    });
    return {
      providerAccountId: String(r.user_id ?? r.id),
      username: r.username,
      displayName: r.name ?? r.username,
      avatarUrl: r.profile_picture_url ?? null,
      accountType: r.account_type ?? null,
      followersCount: r.followers_count ?? null,
    };
  }

  // ───────────── Publicação ─────────────
  async createContainer(
    accessToken: string,
    igUserId: string,
    input: { format: string; media: PublishMediaItem[]; caption: string },
  ): Promise<string> {
    const create = (params: Record<string, string>) =>
      this.call<{ id: string }>("POST", `/${igUserId}/media`, { ...params, access_token: accessToken }).then((r) => r.id);

    const single = (m: PublishMediaItem, extra: Record<string, string> = {}) =>
      m.kind === "image" ? { image_url: m.url, ...extra } : { video_url: m.url, ...extra };

    const [first] = input.media;
    if (!first) throw new ProviderError("Nenhuma mídia informada.", "permanent");

    switch (input.format) {
      case "FEED":
        // Vídeos no feed são publicados como REELS (VIDEO foi descontinuado na API).
        return create(
          first.kind === "image"
            ? { image_url: first.url, caption: input.caption }
            : { video_url: first.url, media_type: "REELS", caption: input.caption },
        );
      case "REELS":
        return create({ video_url: first.url, media_type: "REELS", caption: input.caption, share_to_feed: "true" });
      case "STORIES":
        return create(single(first, { media_type: "STORIES" }));
      case "CAROUSEL": {
        const children: string[] = [];
        for (const m of input.media) {
          children.push(
            await create(
              m.kind === "image"
                ? { image_url: m.url, is_carousel_item: "true" }
                : { video_url: m.url, media_type: "VIDEO", is_carousel_item: "true" },
            ),
          );
        }
        return create({ media_type: "CAROUSEL", children: children.join(","), caption: input.caption });
      }
      default:
        throw new ProviderError(`Formato não suportado: ${input.format}`, "permanent");
    }
  }

  async getContainerStatus(accessToken: string, containerId: string) {
    const r = await this.call<{ status_code?: ContainerStatus; status?: string }>("GET", `/${containerId}`, {
      fields: "status_code,status",
      access_token: accessToken,
    });
    return { status: r.status_code ?? "IN_PROGRESS", message: r.status };
  }

  async publishContainer(accessToken: string, igUserId: string, containerId: string) {
    const r = await this.call<{ id: string }>("POST", `/${igUserId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    });
    return { mediaId: r.id };
  }

  async getPermalink(accessToken: string, mediaId: string) {
    try {
      const r = await this.call<{ permalink?: string }>("GET", `/${mediaId}`, {
        fields: "permalink",
        access_token: accessToken,
      });
      return r.permalink ?? null;
    } catch {
      return null;
    }
  }

  async getPublishingQuota(accessToken: string, igUserId: string) {
    try {
      const r = await this.call<{ data?: { quota_usage?: number; config?: { quota_total?: number } }[] }>(
        "GET",
        `/${igUserId}/content_publishing_limit`,
        { fields: "quota_usage,config", access_token: accessToken },
      );
      const d = r.data?.[0];
      if (!d) return null;
      return { used: d.quota_usage ?? 0, total: d.config?.quota_total ?? 50 };
    } catch {
      return null;
    }
  }

  async getMediaInsights(accessToken: string, mediaId: string): Promise<MediaInsights> {
    // "impressions" foi substituída por "views" (Graph API v22+, abr/2025).
    const r = await this.call<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
      "GET",
      `/${mediaId}/insights`,
      { metric: "reach,views,likes,comments,saved,shares", access_token: accessToken },
    );
    const get = (n: string) => {
      const m = r.data.find((x) => x.name === n);
      return m?.total_value?.value ?? m?.values?.[0]?.value ?? null;
    };
    return {
      reach: get("reach"),
      views: get("views"),
      likes: get("likes"),
      comments: get("comments"),
      saved: get("saved"),
      shares: get("shares"),
    };
  }
}
