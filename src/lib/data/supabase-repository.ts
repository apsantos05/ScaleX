import type { SupabaseClient } from "@supabase/supabase-js";
import { MemberError, memberErrorFrom } from "@/lib/domain/members";
import type {
  AuditEntry,
  Campaign,
  CaptionTemplate,
  ExecutionLog,
  ID,
  Invitation,
  InvitationPreview,
  MediaAsset,
  Publication,
  PublicationTarget,
  Role,
  SocialAccount,
  TargetView,
  Workspace, MediaInsightRow, AccountSnapshot } from "@/lib/domain/types";
import { slugify } from "./demo-repository";
import type {
  MediaFilter,
  NewAccount,
  NewMedia,
  SystemRepository,
  TargetFilter,
  WorkspaceRepository,
} from "./repository";

/**
 * Implementação Supabase. ATENÇÃO: escrita contra o schema em supabase/migrations,
 * mas ainda NÃO validada contra um projeto Supabase real (ver PROJECT_STATUS.md).
 */
type Row = Record<string, unknown>;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function fromRow<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out as T;
}

function toRow(obj: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[toSnake(k)] = v;
  return out;
}

const TARGET_VIEW_SELECT =
  "*, publications!inner(caption, format, campaign_id, media_ids), social_accounts(username, avatar_url)";

function toTargetView(row: Row): TargetView {
  const { publications, social_accounts, ...rest } = row as Row & {
    publications: Row;
    social_accounts: Row | null;
  };
  const t = fromRow<PublicationTarget>(rest);
  return {
    ...t,
    caption: (publications?.caption as string) ?? "",
    format: (publications?.format as TargetView["format"]) ?? "FEED",
    campaignId: (publications?.campaign_id as string) ?? null,
    mediaIds: (publications?.media_ids as string[]) ?? [],
    accountUsername: (social_accounts?.username as string) ?? "(conta removida)",
    accountAvatarUrl: (social_accounts?.avatar_url as string) ?? null,
  };
}

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listWorkspacesForUser(userId: ID) {
    const rows = check(
      await this.db.from("workspace_members").select("role, workspaces(*)").eq("user_id", userId),
    ) as unknown as { role: Role; workspaces: Row }[];
    return rows.map((r) => ({ ...fromRow<Workspace>(r.workspaces), role: r.role }));
  }

  async createWorkspace(_userId: ID, name: string) {
    const row = check(await this.db.rpc("create_workspace", { p_name: name, p_slug: slugify(name) }));
    return fromRow<Workspace>(row as Row);
  }

  async getMembership(workspaceId: ID, userId: ID) {
    const row = check(
      await this.db
        .from("workspace_members")
        .select("role, workspaces(*)")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle(),
    ) as unknown as { role: Role; workspaces: Row } | null;
    return row ? { role: row.role, workspace: fromRow<Workspace>(row.workspaces) } : null;
  }

  async updateWorkspace(workspaceId: ID, patch: { name?: string }) {
    check(await this.db.from("workspaces").update(patch).eq("id", workspaceId));
  }

  async listMembers(workspaceId: ID) {
    // workspace_members.user_id referencia auth.users (não profiles), então não há relação
    // para o PostgREST embutir: buscamos os perfis numa segunda consulta (RLS permite ver colegas).
    const rows = check(
      await this.db.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", workspaceId).order("created_at"),
    ) as { user_id: string; role: Role; created_at: string }[];
    const ids = rows.map((r) => r.user_id);
    const profiles = ids.length
      ? (check(await this.db.from("profiles").select("id, name, email").in("id", ids)) as { id: string; name: string; email: string }[])
      : [];
    return rows.map((r) => {
      const p = profiles.find((x) => x.id === r.user_id);
      return { workspaceId, userId: r.user_id, role: r.role, createdAt: r.created_at, name: p?.name ?? "", email: p?.email ?? "" };
    });
  }

  async listInvitations(workspaceId: ID) {
    const rows = check(
      await this.db
        .from("workspace_invitations")
        .select("id, workspace_id, email, role, invited_by, expires_at, accepted_at, revoked_at, created_at")
        .eq("workspace_id", workspaceId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .order("created_at", { ascending: false }),
    );
    return (rows as Row[]).map((r) => fromRow<Invitation>(r));
  }

  async createInvitation(
    workspaceId: ID,
    input: { email: string; role: Invitation["role"]; tokenHash: string; invitedBy: ID; expiresAt: string },
  ) {
    const row = check(
      await this.db
        .from("workspace_invitations")
        .insert({
          workspace_id: workspaceId,
          email: input.email,
          role: input.role,
          token_hash: input.tokenHash,
          invited_by: input.invitedBy,
          expires_at: input.expiresAt,
        })
        .select("id, workspace_id, email, role, invited_by, expires_at, accepted_at, revoked_at, created_at")
        .single(),
    );
    return fromRow<Invitation>(row as Row);
  }

  async revokeInvitation(workspaceId: ID, id: ID) {
    const rows = check(
      await this.db
        .from("workspace_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("workspace_id", workspaceId)
        .eq("id", id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .select("id"),
    );
    return (rows as Row[]).length > 0;
  }

  async previewInvitation(tokenHash: string): Promise<InvitationPreview | null> {
    const rows = check(await this.db.rpc("get_invitation_preview", { p_token_hash: tokenHash })) as Row[] | null;
    const r = rows?.[0];
    return r
      ? { workspaceName: r.workspace_name as string, role: r.role as Role, email: r.email as string, status: r.status as InvitationPreview["status"] }
      : null;
  }

  private async rpcMember<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const res = await this.db.rpc(fn, args);
    if (res.error) {
      const code = memberErrorFrom(res.error.message);
      if (code) throw new MemberError(code);
      throw new Error(`Supabase: ${res.error.message}`);
    }
    return res.data as T;
  }

  async acceptInvitation(tokenHash: string) {
    return this.rpcMember<string>("accept_invitation", { p_token_hash: tokenHash });
  }

  async setMemberRole(workspaceId: ID, _actorId: ID, userId: ID, role: Role) {
    await this.rpcMember("set_member_role", { p_workspace: workspaceId, p_user: userId, p_role: role });
  }

  async removeMember(workspaceId: ID, _actorId: ID, userId: ID) {
    await this.rpcMember("remove_member", { p_workspace: workspaceId, p_user: userId });
  }

  async listAccounts(workspaceId: ID) {
    const rows = check(
      await this.db.from("social_accounts").select("*").eq("workspace_id", workspaceId).order("username"),
    );
    return (rows as Row[]).map((r) => fromRow<SocialAccount>(r));
  }

  async getAccount(workspaceId: ID, id: ID) {
    const row = check(
      await this.db.from("social_accounts").select("*").eq("workspace_id", workspaceId).eq("id", id).maybeSingle(),
    );
    return row ? fromRow<SocialAccount>(row as Row) : null;
  }

  async upsertAccount(workspaceId: ID, input: NewAccount) {
    const rest: Partial<NewAccount> = { ...input };
    delete rest.tags;
    delete rest.group;
    const row = check(
      await this.db
        .from("social_accounts")
        .upsert(toRow({ ...rest, workspaceId }), { onConflict: "workspace_id,provider,provider_account_id" })
        .select("*")
        .single(),
    );
    return fromRow<SocialAccount>(row as Row);
  }

  async updateAccounts(workspaceId: ID, ids: ID[], patch: Partial<SocialAccount>) {
    check(await this.db.from("social_accounts").update(toRow(patch)).eq("workspace_id", workspaceId).in("id", ids));
  }

  async deleteAccount(workspaceId: ID, id: ID) {
    // Cancela pendentes antes; cascade remove targets ao excluir a conta, então registramos via cancelamento.
    check(
      await this.db
        .from("publication_targets")
        .update({ status: "cancelled", last_error: "Conta desconectada" })
        .eq("workspace_id", workspaceId)
        .eq("social_account_id", id)
        .in("status", ["draft", "scheduled", "queued"]),
    );
    check(await this.db.from("social_accounts").delete().eq("workspace_id", workspaceId).eq("id", id));
  }

  async listMedia(workspaceId: ID, f: MediaFilter = {}) {
    let q = this.db.from("media_assets").select("*").eq("workspace_id", workspaceId);
    if (f.kind) q = q.eq("kind", f.kind);
    if (f.folder) q = q.eq("folder", f.folder);
    if (f.tag) q = q.contains("tags", [f.tag]);
    if (f.search) q = q.ilike("file_name", `%${f.search.replace(/[%_]/g, "")}%`);
    const rows = check(await q.order("created_at", { ascending: false }).limit(500));
    return (rows as Row[]).map((r) => fromRow<MediaAsset>(r));
  }

  async getMediaByIds(workspaceId: ID, ids: ID[]) {
    if (!ids.length) return [];
    const rows = check(await this.db.from("media_assets").select("*").eq("workspace_id", workspaceId).in("id", ids));
    const list = (rows as Row[]).map((r) => fromRow<MediaAsset>(r));
    return ids.map((id) => list.find((m) => m.id === id)).filter((m): m is MediaAsset => !!m);
  }

  async createMedia(workspaceId: ID, input: NewMedia) {
    const row = check(
      await this.db.from("media_assets").insert(toRow({ ...input, workspaceId })).select("*").single(),
    );
    return fromRow<MediaAsset>(row as Row);
  }

  async updateMedia(workspaceId: ID, ids: ID[], patch: Partial<MediaAsset>) {
    check(await this.db.from("media_assets").update(toRow(patch)).eq("workspace_id", workspaceId).in("id", ids));
  }

  async deleteMedia(workspaceId: ID, ids: ID[]) {
    const rows = check(
      await this.db.from("media_assets").delete().eq("workspace_id", workspaceId).in("id", ids).select("*"),
    );
    return (rows as Row[]).map((r) => fromRow<MediaAsset>(r));
  }

  async storageUsedBytes(workspaceId: ID) {
    const rows = check(await this.db.from("media_assets").select("size_bytes").eq("workspace_id", workspaceId));
    return (rows as { size_bytes: number }[]).reduce((s, r) => s + Number(r.size_bytes), 0);
  }

  async listMediaInsights(workspaceId: ID) {
    const rows = check(await this.db.from("media_insights").select("*").eq("workspace_id", workspaceId)) as Row[];
    return rows.map((r) => fromRow<MediaInsightRow>(r));
  }

  async listAccountSnapshots(workspaceId: ID, sinceDay: string) {
    const rows = check(
      await this.db.from("account_snapshots").select("social_account_id, day, followers_count").eq("workspace_id", workspaceId).gte("day", sinceDay).order("day"),
    ) as Row[];
    return rows.map((r) => fromRow<AccountSnapshot>(r));
  }

  async listCaptions(workspaceId: ID) {
    const rows = check(await this.db.from("caption_templates").select("*").eq("workspace_id", workspaceId));
    return (rows as Row[]).map((r) => fromRow<CaptionTemplate>(r));
  }
  async createCaption(workspaceId: ID, input: { title: string; body: string }) {
    const row = check(
      await this.db.from("caption_templates").insert({ ...input, workspace_id: workspaceId }).select("*").single(),
    );
    return fromRow<CaptionTemplate>(row as Row);
  }
  async deleteCaption(workspaceId: ID, id: ID) {
    check(await this.db.from("caption_templates").delete().eq("workspace_id", workspaceId).eq("id", id));
  }
  async listCampaigns(workspaceId: ID) {
    const rows = check(await this.db.from("campaigns").select("*").eq("workspace_id", workspaceId).order("name"));
    return (rows as Row[]).map((r) => fromRow<Campaign>(r));
  }
  async createCampaign(workspaceId: ID, input: { name: string; color: string; description?: string | null }) {
    const row = check(
      await this.db.from("campaigns").insert({ ...input, workspace_id: workspaceId }).select("*").single(),
    );
    return fromRow<Campaign>(row as Row);
  }
  async deleteCampaign(workspaceId: ID, id: ID) {
    check(await this.db.from("campaigns").delete().eq("workspace_id", workspaceId).eq("id", id));
  }

  async findPublicationByKey(workspaceId: ID, key: string) {
    const row = check(
      await this.db
        .from("publications")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("idempotency_key", key)
        .maybeSingle(),
    );
    return row ? fromRow<Publication>(row as Row) : null;
  }

  async createPublication(
    workspaceId: ID,
    pub: Omit<Publication, "id" | "createdAt" | "workspaceId">,
    accountIds: ID[],
    status: "scheduled" | "draft",
  ) {
    const id = check(
      await this.db.rpc("create_publication", {
        p_workspace: workspaceId,
        p_campaign: pub.campaignId,
        p_media: pub.mediaIds,
        p_caption: pub.caption,
        p_format: pub.format,
        p_scheduled_at: pub.scheduledAt,
        p_key: pub.idempotencyKey,
        p_accounts: accountIds,
        p_status: status,
      }),
    ) as string;
    const publication = fromRow<Publication>(
      check(await this.db.from("publications").select("*").eq("id", id).single()) as Row,
    );
    const targets = (
      check(await this.db.from("publication_targets").select("*").eq("publication_id", id)) as Row[]
    ).map((r) => fromRow<PublicationTarget>(r));
    return { publication, targets };
  }

  async listTargets(workspaceId: ID, f: TargetFilter = {}) {
    let q = this.db.from("publication_targets").select(TARGET_VIEW_SELECT).eq("workspace_id", workspaceId);
    if (f.from) q = q.gte("scheduled_at", f.from);
    if (f.to) q = q.lt("scheduled_at", f.to);
    if (f.statuses?.length) q = q.in("status", f.statuses);
    if (f.accountIds?.length) q = q.in("social_account_id", f.accountIds);
    if (f.campaignId) q = q.eq("publications.campaign_id", f.campaignId);
    const rows = check(await q.order("scheduled_at", { ascending: false }).limit(f.limit ?? 1000));
    return (rows as Row[]).map(toTargetView);
  }

  async getTarget(workspaceId: ID, id: ID) {
    const row = check(
      await this.db
        .from("publication_targets")
        .select(TARGET_VIEW_SELECT)
        .eq("workspace_id", workspaceId)
        .eq("id", id)
        .maybeSingle(),
    );
    return row ? toTargetView(row as Row) : null;
  }

  async updateTargetIf(workspaceId: ID, id: ID, expected: PublicationTarget["status"][], patch: Partial<PublicationTarget>) {
    const rows = check(
      await this.db
        .from("publication_targets")
        .update(toRow({ ...patch, updatedAt: new Date().toISOString() }))
        .eq("workspace_id", workspaceId)
        .eq("id", id)
        .in("status", expected)
        .select("id"),
    );
    return (rows as Row[]).length > 0;
  }

  async countTargetsCreatedSince(workspaceId: ID, sinceIso: string) {
    const res = await this.db
      .from("publication_targets")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", sinceIso);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  }

  async listLogs(workspaceId: ID, targetId: ID) {
    const rows = check(
      await this.db
        .from("execution_logs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("target_id", targetId)
        .order("at"),
    );
    return (rows as Row[]).map((r) => ({ ...fromRow<ExecutionLog>(r), id: String(r.id) }));
  }

  async addAudit(entry: Omit<AuditEntry, "id" | "at">) {
    check(await this.db.from("audit_logs").insert(toRow(entry)));
  }

  async listAudit(workspaceId: ID, limit = 50) {
    const rows = check(
      await this.db
        .from("audit_logs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("at", { ascending: false })
        .limit(limit),
    );
    return (rows as Row[]).map((r) => ({ ...fromRow<AuditEntry>(r), id: String(r.id) }));
  }
}

export class SupabaseSystemRepository implements SystemRepository {
  constructor(private readonly db: SupabaseClient) {}

  async promoteDueTargets(nowIso: string, limit: number) {
    return check(await this.db.rpc("promote_due_targets", { p_now: nowIso, p_limit: limit })) as number;
  }

  async claimTargets(workerId: string, nowIso: string, leaseMs: number, limit: number) {
    const rows = check(
      await this.db.rpc("claim_publication_targets", {
        p_worker: workerId,
        p_now: nowIso,
        p_lease_ms: leaseMs,
        p_limit: limit,
      }),
    );
    return (rows as Row[]).map((r) => fromRow<PublicationTarget>(r));
  }

  async updateClaimedTarget(id: ID, workerId: string, patch: Partial<PublicationTarget>) {
    const rows = check(
      await this.db
        .from("publication_targets")
        .update(toRow({ ...patch, updatedAt: new Date().toISOString() }))
        .eq("id", id)
        .eq("locked_by", workerId)
        .eq("status", "processing")
        .select("id"),
    );
    return (rows as Row[]).length > 0;
  }

  async getPublication(id: ID) {
    const row = check(await this.db.from("publications").select("*").eq("id", id).maybeSingle());
    return row ? fromRow<Publication>(row as Row) : null;
  }

  async getAccountById(id: ID) {
    const row = check(await this.db.from("social_accounts").select("*").eq("id", id).maybeSingle());
    return row ? fromRow<SocialAccount>(row as Row) : null;
  }

  async updateAccountSystem(id: ID, patch: Partial<SocialAccount>) {
    check(await this.db.from("social_accounts").update(toRow(patch)).eq("id", id));
  }

  async getMediaSystem(ids: ID[]) {
    if (!ids.length) return [];
    const rows = check(await this.db.from("media_assets").select("*").in("id", ids));
    const list = (rows as Row[]).map((r) => fromRow<MediaAsset>(r));
    return ids.map((id) => list.find((m) => m.id === id)).filter((m): m is MediaAsset => !!m);
  }

  async countPublishedSince(accountId: ID, sinceIso: string) {
    const res = await this.db
      .from("publication_targets")
      .select("id", { count: "exact", head: true })
      .eq("social_account_id", accountId)
      .eq("status", "published")
      .gte("published_at", sinceIso);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  }

  async appendLog(entry: Omit<ExecutionLog, "id" | "at">) {
    check(await this.db.from("execution_logs").insert(toRow(entry)));
  }

  async saveCredential(accountId: ID, ciphertext: string, expiresAt: string | null) {
    check(
      await this.db
        .from("social_account_credentials")
        .upsert({ account_id: accountId, ciphertext, expires_at: expiresAt, updated_at: new Date().toISOString() }),
    );
  }

  async getCredential(accountId: ID) {
    const row = check(
      await this.db.from("social_account_credentials").select("*").eq("account_id", accountId).maybeSingle(),
    );
    return row ? fromRow<{ accountId: string; ciphertext: string; expiresAt: string | null; updatedAt: string }>(row as Row) : null;
  }

  async deleteCredential(accountId: ID) {
    check(await this.db.from("social_account_credentials").delete().eq("account_id", accountId));
  }
}
