import type {
  AuditEntry,
  Campaign,
  CaptionTemplate,
  ExecutionLog,
  ID,
  Invitation,
  InvitationPreview,
  MediaAsset,
  Member,
  Publication,
  PublicationTarget,
  Role,
  SocialAccount,
  TargetStatus,
  TargetView,
  Workspace,
  WorkspaceWithRole, InstagramPost, AccountSnapshot } from "@/lib/domain/types";

export type NewAccount = Omit<SocialAccount, "id" | "createdAt" | "workspaceId">;
export type NewMedia = Omit<MediaAsset, "id" | "createdAt" | "workspaceId">;

export type TargetFilter = {
  from?: string;
  to?: string;
  statuses?: TargetStatus[];
  accountIds?: ID[];
  campaignId?: ID;
  limit?: number;
};

export type MediaFilter = { search?: string; folder?: string; tag?: string; kind?: "image" | "video" };

export type EncryptedCredential = {
  accountId: ID;
  ciphertext: string;
  expiresAt: string | null;
  updatedAt: string;
};

/**
 * Operações executadas em nome de um usuário dentro de um workspace.
 * No modo Supabase, o isolamento é garantido por RLS; no modo demo, pelo `guard` da camada de serviço.
 */
export interface WorkspaceRepository {
  listWorkspacesForUser(userId: ID): Promise<WorkspaceWithRole[]>;
  createWorkspace(userId: ID, name: string): Promise<Workspace>;
  getMembership(workspaceId: ID, userId: ID): Promise<{ role: Role; workspace: Workspace } | null>;
  updateWorkspace(workspaceId: ID, patch: { name?: string }): Promise<void>;
  listMembers(workspaceId: ID): Promise<Member[]>;

  /** Convites pendentes (não aceitos, não revogados). */
  listInvitations(workspaceId: ID): Promise<Invitation[]>;
  createInvitation(
    workspaceId: ID,
    input: { email: string; role: Invitation["role"]; tokenHash: string; invitedBy: ID; expiresAt: string },
  ): Promise<Invitation>;
  revokeInvitation(workspaceId: ID, id: ID): Promise<boolean>;
  /** Visível para quem tem o link, mesmo sem ser membro. */
  previewInvitation(tokenHash: string): Promise<InvitationPreview | null>;
  /** Lança MemberError em caso de convite inválido ou e-mail diferente. Retorna o workspace. */
  acceptInvitation(tokenHash: string, user: { id: ID; email: string }): Promise<ID>;
  setMemberRole(workspaceId: ID, actorId: ID, userId: ID, role: Role): Promise<void>;
  removeMember(workspaceId: ID, actorId: ID, userId: ID): Promise<void>;

  listAccounts(workspaceId: ID): Promise<SocialAccount[]>;
  getAccount(workspaceId: ID, id: ID): Promise<SocialAccount | null>;
  upsertAccount(workspaceId: ID, input: NewAccount): Promise<SocialAccount>;
  updateAccounts(workspaceId: ID, ids: ID[], patch: Partial<Pick<SocialAccount, "tags" | "group" | "status" | "lastSyncedAt" | "username" | "displayName" | "avatarUrl" | "followersCount" | "tokenExpiresAt">>): Promise<void>;
  deleteAccount(workspaceId: ID, id: ID): Promise<void>;

  listMedia(workspaceId: ID, filter?: MediaFilter): Promise<MediaAsset[]>;
  getMediaByIds(workspaceId: ID, ids: ID[]): Promise<MediaAsset[]>;
  createMedia(workspaceId: ID, input: NewMedia): Promise<MediaAsset>;
  updateMedia(workspaceId: ID, ids: ID[], patch: Partial<Pick<MediaAsset, "folder" | "tags" | "rightsConfirmed" | "rightsNote">>): Promise<void>;
  deleteMedia(workspaceId: ID, ids: ID[]): Promise<MediaAsset[]>;
  storageUsedBytes(workspaceId: ID): Promise<number>;
  /** Métricas coletadas das publicações do workspace (Analytics). */
  /** Posts das contas conectadas publicados desde `sinceIso` (mais recentes primeiro). */
  listInstagramPosts(workspaceId: ID, sinceIso: string): Promise<InstagramPost[]>;
  /** Retratos diários de seguidores a partir de `sinceDay` (AAAA-MM-DD). */
  listAccountSnapshots(workspaceId: ID, sinceDay: string): Promise<AccountSnapshot[]>;

  listCaptions(workspaceId: ID): Promise<CaptionTemplate[]>;
  createCaption(workspaceId: ID, input: { title: string; body: string }): Promise<CaptionTemplate>;
  deleteCaption(workspaceId: ID, id: ID): Promise<void>;

  listCampaigns(workspaceId: ID): Promise<Campaign[]>;
  createCampaign(workspaceId: ID, input: { name: string; color: string; description?: string | null }): Promise<Campaign>;
  deleteCampaign(workspaceId: ID, id: ID): Promise<void>;

  findPublicationByKey(workspaceId: ID, idempotencyKey: string): Promise<Publication | null>;
  /** Cria publicação + targets de forma atômica. */
  createPublication(
    workspaceId: ID,
    pub: Omit<Publication, "id" | "createdAt" | "workspaceId">,
    accountIds: ID[],
    status: "scheduled" | "draft",
  ): Promise<{ publication: Publication; targets: PublicationTarget[] }>;
  listTargets(workspaceId: ID, filter?: TargetFilter): Promise<TargetView[]>;
  getTarget(workspaceId: ID, id: ID): Promise<TargetView | null>;
  /** Atualização condicional: só aplica se o status atual estiver em `expected`. Retorna se aplicou. */
  updateTargetIf(workspaceId: ID, id: ID, expected: TargetStatus[], patch: Partial<PublicationTarget>): Promise<boolean>;
  countTargetsCreatedSince(workspaceId: ID, sinceIso: string): Promise<number>;
  listLogs(workspaceId: ID, targetId: ID): Promise<ExecutionLog[]>;

  addAudit(entry: Omit<AuditEntry, "id" | "at">): Promise<void>;
  listAudit(workspaceId: ID, limit?: number): Promise<AuditEntry[]>;
}

/**
 * Operações de sistema (worker / callbacks OAuth). Atravessam tenants e por isso
 * só podem rodar no servidor com credenciais privilegiadas (service role).
 */
export interface SystemRepository {
  promoteDueTargets(nowIso: string, limit: number): Promise<number>;
  /** Reivindica jobs prontos com lease; no máximo 1 job em execução por conta. */
  claimTargets(workerId: string, nowIso: string, leaseMs: number, limit: number): Promise<PublicationTarget[]>;
  /** Atualiza um target apenas se o worker ainda detiver o lease. */
  updateClaimedTarget(id: ID, workerId: string, patch: Partial<PublicationTarget>): Promise<boolean>;
  getPublication(id: ID): Promise<Publication | null>;
  getAccountById(id: ID): Promise<SocialAccount | null>;
  updateAccountSystem(id: ID, patch: Partial<SocialAccount>): Promise<void>;
  getMediaSystem(ids: ID[]): Promise<MediaAsset[]>;
  countPublishedSince(accountId: ID, sinceIso: string): Promise<number>;
  appendLog(entry: Omit<ExecutionLog, "id" | "at">): Promise<void>;

  saveCredential(accountId: ID, ciphertext: string, expiresAt: string | null): Promise<void>;
  getCredential(accountId: ID): Promise<EncryptedCredential | null>;
  deleteCredential(accountId: ID): Promise<void>;
}
