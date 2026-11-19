export type ID = string;
export type ISODate = string;

export type Role = "owner" | "admin" | "editor" | "viewer";
export type PlanId = "trial" | "starter" | "pro" | "scale";

export type User = { id: ID; email: string; name: string };

export type Workspace = {
  id: ID;
  name: string;
  slug: string;
  plan: PlanId;
  createdAt: ISODate;
};

export type WorkspaceWithRole = Workspace & { role: Role };

export type Member = {
  workspaceId: ID;
  userId: ID;
  role: Role;
  email: string;
  name: string;
  createdAt: ISODate;
};

export type SocialProvider = "instagram";
export type AccountStatus = "active" | "needs_reauth" | "disconnected" | "error";

export type SocialAccount = {
  id: ID;
  workspaceId: ID;
  provider: SocialProvider;
  providerAccountId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  /** BUSINESS | MEDIA_CREATOR (contas profissionais). Contas pessoais não são suportadas pela API. */
  accountType: string | null;
  status: AccountStatus;
  scopes: string[];
  tags: string[];
  group: string | null;
  followersCount: number | null;
  lastSyncedAt: ISODate | null;
  tokenExpiresAt: ISODate | null;
  /** Contas de demonstração nunca chamam a API real. */
  isDemo: boolean;
  createdAt: ISODate;
};

export type MediaKind = "image" | "video";

export type MediaAsset = {
  id: ID;
  workspaceId: ID;
  kind: MediaKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  storagePath: string;
  folder: string | null;
  tags: string[];
  rightsConfirmed: boolean;
  rightsNote: string | null;
  createdBy: ID;
  createdAt: ISODate;
};

export type CaptionTemplate = { id: ID; workspaceId: ID; title: string; body: string; createdAt: ISODate };

export type Campaign = {
  id: ID;
  workspaceId: ID;
  name: string;
  color: string;
  description: string | null;
  createdAt: ISODate;
};

export type PublishFormat = "FEED" | "REELS" | "STORIES" | "CAROUSEL";

export type Publication = {
  id: ID;
  workspaceId: ID;
  campaignId: ID | null;
  mediaIds: ID[];
  caption: string;
  format: PublishFormat;
  scheduledAt: ISODate;
  idempotencyKey: string;
  createdBy: ID;
  createdAt: ISODate;
};

export type TargetStatus =
  | "draft"
  | "scheduled"
  | "queued"
  | "processing"
  | "published"
  | "failed"
  | "cancelled";

export type ErrorKind = "transient" | "permanent" | "auth" | "rate_limit";

/**
 * Um "target" é a execução de uma publicação em UMA conta. Funciona também como o job
 * da fila: possui lease (lockedBy/lockedUntil), tentativas e próxima execução.
 */
export type PublicationTarget = {
  id: ID;
  workspaceId: ID;
  publicationId: ID;
  socialAccountId: ID;
  status: TargetStatus;
  scheduledAt: ISODate;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: ISODate | null;
  lockedBy: string | null;
  lockedUntil: ISODate | null;
  providerContainerId: string | null;
  providerMediaId: string | null;
  permalink: string | null;
  lastError: string | null;
  errorKind: ErrorKind | null;
  simulated: boolean;
  publishedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
};

/** Target enriquecido para exibição. */
export type TargetView = PublicationTarget & {
  caption: string;
  format: PublishFormat;
  campaignId: ID | null;
  mediaIds: ID[];
  accountUsername: string;
  accountAvatarUrl: string | null;
};

export type LogLevel = "info" | "warn" | "error";

export type ExecutionLog = {
  id: ID;
  workspaceId: ID;
  targetId: ID;
  at: ISODate;
  level: LogLevel;
  event: string;
  message: string;
  data: Record<string, unknown> | null;
};

export type AuditEntry = {
  id: ID;
  workspaceId: ID;
  actorId: ID | null;
  action: string;
  entity: string;
  entityId: ID | null;
  meta: Record<string, unknown> | null;
  at: ISODate;
};

export type Invitation = {
  id: ID;
  workspaceId: ID;
  email: string;
  role: Exclude<Role, "owner">;
  invitedBy: ID | null;
  expiresAt: ISODate;
  acceptedAt: ISODate | null;
  revokedAt: ISODate | null;
  createdAt: ISODate;
};

export type InvitationPreview = {
  workspaceName: string;
  role: Role;
  email: string;
  status: "valid" | "expired" | "revoked" | "accepted";
};

/** Métricas de uma publicação real, coletadas da API oficial do Instagram. */
/** Um post de conta conectada (feito pela ScaleX ou direto no Instagram) com as métricas oficiais. */
export type InstagramPost = {
  id: ID;
  socialAccountId: ID;
  providerMediaId: string;
  mediaType: string | null;
  productType: string | null;
  caption: string | null;
  permalink: string | null;
  postedAt: ISODate;
  viaScalex: boolean;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  /** "insights" = métricas completas; "basic" = só curtidas/comentários. */
  source: "insights" | "basic";
  lastError: string | null;
  metricsFetchedAt: ISODate | null;
};

export type AccountSnapshot = { socialAccountId: ID; day: string; followersCount: number | null };
