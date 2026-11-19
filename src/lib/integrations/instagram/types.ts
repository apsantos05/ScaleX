import type { ErrorKind, PublishFormat } from "@/lib/domain/types";

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: ErrorKind,
    public readonly code?: string | number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export type ContainerStatus = "IN_PROGRESS" | "FINISHED" | "PUBLISHED" | "ERROR" | "EXPIRED";

export type PublishMediaItem = { kind: "image" | "video"; url: string };

export type InstagramProfile = {
  providerAccountId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accountType: string | null;
  followersCount: number | null;
};

/** Um post da conta, como a API lista (feito pela ScaleX ou direto no Instagram). */
export type AccountMedia = {
  id: string;
  mediaType: string | null;
  productType: string | null;
  caption: string | null;
  permalink: string | null;
  timestamp: string;
  likes: number | null;
  comments: number | null;
};

export type MediaInsights = {
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
};

/**
 * Contrato do adapter. O motor de jobs depende apenas desta interface, o que permite
 * plugar outras redes no futuro (TikTok, YouTube…) e testar com fakes.
 */
export interface InstagramAdapter {
  readonly simulated: boolean;
  /** Perfil da conta. No login unificado o token é de um usuário do sistema, então o ID da conta é obrigatório. */
  getProfile(accessToken: string, igUserId?: string): Promise<InstagramProfile>;
  createContainer(
    accessToken: string,
    igUserId: string,
    input: { format: PublishFormat; media: PublishMediaItem[]; caption: string },
  ): Promise<string>;
  getContainerStatus(accessToken: string, containerId: string): Promise<{ status: ContainerStatus; message?: string }>;
  publishContainer(accessToken: string, igUserId: string, containerId: string): Promise<{ mediaId: string }>;
  getPermalink(accessToken: string, mediaId: string): Promise<string | null>;
  /** Quota oficial restante (content_publishing_limit). null se indisponível. */
  getPublishingQuota(accessToken: string, igUserId: string): Promise<{ used: number; total: number } | null>;
  refreshToken(accessToken: string): Promise<{ accessToken: string; expiresInSec: number }>;
  /** Métricas completas (exige a permissão de insights). Stories e Reels aceitam conjuntos diferentes de métricas. */
  getMediaInsights(accessToken: string, mediaId: string, format?: PublishFormat): Promise<MediaInsights>;
  /** Curtidas e comentários (disponíveis só com a permissão básica). */
  getMediaBasic(accessToken: string, mediaId: string): Promise<{ likes: number | null; comments: number | null }>;
  /** Posts da conta publicados desde `sinceIso`, do mais novo para o mais antigo (até `max`). */
  listAccountMedia(accessToken: string, igUserId: string, sinceIso: string, max?: number): Promise<AccountMedia[]>;
}
