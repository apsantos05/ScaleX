import { randomUUID } from "node:crypto";
import { assertCanChangeRole, assertCanRemove, invitationStatus, MemberError } from "@/lib/domain/members";
import type {
  ID,
  Invitation,
  InvitationPreview,
  Role,
  MediaAsset,
  Publication,
  PublicationTarget,
  SocialAccount,
  TargetView,
  Workspace, MediaInsightRow, AccountSnapshot } from "@/lib/domain/types";
import type { DemoDB, DemoStore } from "./demo-store";
import type {
  MediaFilter,
  NewAccount,
  NewMedia,
  SystemRepository,
  TargetFilter,
  WorkspaceRepository,
} from "./repository";

const now = () => new Date().toISOString();

export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "workspace"
  );
}

/** Remove campos internos (hash do token) antes de expor o convite. */
function publicInvitation(i: Invitation): Invitation {
  return {
    id: i.id,
    workspaceId: i.workspaceId,
    email: i.email,
    role: i.role,
    invitedBy: i.invitedBy,
    expiresAt: i.expiresAt,
    acceptedAt: i.acceptedAt,
    revokedAt: i.revokedAt,
    createdAt: i.createdAt,
  };
}

function toView(db: DemoDB, t: PublicationTarget): TargetView {
  const pub = db.publications.find((p) => p.id === t.publicationId);
  const acc = db.accounts.find((a) => a.id === t.socialAccountId);
  return {
    ...t,
    caption: pub?.caption ?? "",
    format: pub?.format ?? "FEED",
    campaignId: pub?.campaignId ?? null,
    mediaIds: pub?.mediaIds ?? [],
    accountUsername: acc?.username ?? "(conta removida)",
    accountAvatarUrl: acc?.avatarUrl ?? null,
  };
}

export class DemoRepository implements WorkspaceRepository, SystemRepository {
  constructor(private readonly store: DemoStore) {}

  // ───────────── Workspaces ─────────────
  async listWorkspacesForUser(userId: ID) {
    const db = await this.store.read();
    return db.members
      .filter((m) => m.userId === userId)
      .map((m) => {
        const ws = db.workspaces.find((w) => w.id === m.workspaceId);
        return ws ? { ...ws, role: m.role } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  async createWorkspace(userId: ID, name: string): Promise<Workspace> {
    return this.store.mutate((db) => {
      const base = slugify(name);
      let slug = base;
      for (let i = 2; db.workspaces.some((w) => w.slug === slug); i++) slug = `${base}-${i}`;
      const ws: Workspace = { id: randomUUID(), name, slug, plan: "trial", createdAt: now() };
      db.workspaces.push(ws);
      db.members.push({ workspaceId: ws.id, userId, role: "owner", createdAt: now() });
      return ws;
    });
  }

  async getMembership(workspaceId: ID, userId: ID) {
    const db = await this.store.read();
    const m = db.members.find((x) => x.workspaceId === workspaceId && x.userId === userId);
    const ws = db.workspaces.find((w) => w.id === workspaceId);
    return m && ws ? { role: m.role, workspace: ws } : null;
  }

  async updateWorkspace(workspaceId: ID, patch: { name?: string }) {
    await this.store.mutate((db) => {
      const ws = db.workspaces.find((w) => w.id === workspaceId);
      if (ws && patch.name) ws.name = patch.name;
    });
  }

  async listMembers(workspaceId: ID) {
    const db = await this.store.read();
    return db.members
      .filter((m) => m.workspaceId === workspaceId)
      .map((m) => {
        const u = db.users.find((x) => x.id === m.userId);
        return {
          workspaceId,
          userId: m.userId,
          role: m.role,
          email: u?.email ?? "",
          name: u?.name ?? "",
          createdAt: m.createdAt,
        };
      });
  }

  // ───────────── Convites e membros ─────────────
  async listInvitations(workspaceId: ID) {
    const db = await this.store.read();
    return db.invitations
      .filter((i) => i.workspaceId === workspaceId && !i.acceptedAt && !i.revokedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(publicInvitation);
  }

  async createInvitation(
    workspaceId: ID,
    input: { email: string; role: Invitation["role"]; tokenHash: string; invitedBy: ID; expiresAt: string },
  ) {
    return this.store.mutate((db) => {
      const inv = {
        id: randomUUID(),
        workspaceId,
        email: input.email,
        role: input.role,
        invitedBy: input.invitedBy,
        expiresAt: input.expiresAt,
        acceptedAt: null,
        revokedAt: null,
        createdAt: now(),
        tokenHash: input.tokenHash,
        acceptedBy: null,
      };
      db.invitations.push(inv);
      return publicInvitation(inv);
    });
  }

  async revokeInvitation(workspaceId: ID, id: ID) {
    return this.store.mutate((db) => {
      const inv = db.invitations.find((i) => i.workspaceId === workspaceId && i.id === id);
      if (!inv || inv.acceptedAt || inv.revokedAt) return false;
      inv.revokedAt = now();
      return true;
    });
  }

  async previewInvitation(tokenHash: string): Promise<InvitationPreview | null> {
    const db = await this.store.read();
    const inv = db.invitations.find((i) => i.tokenHash === tokenHash);
    const ws = inv && db.workspaces.find((w) => w.id === inv.workspaceId);
    if (!inv || !ws) return null;
    return { workspaceName: ws.name, role: inv.role, email: inv.email, status: invitationStatus(inv) };
  }

  async acceptInvitation(tokenHash: string, user: { id: ID; email: string }) {
    return this.store.mutate((db) => {
      const inv = db.invitations.find((i) => i.tokenHash === tokenHash);
      if (!inv) throw new MemberError("not_found");
      const status = invitationStatus(inv);
      if (status !== "valid") throw new MemberError(status);
      if (inv.email.toLowerCase() !== user.email.toLowerCase()) throw new MemberError("email_mismatch");
      if (!db.members.some((m) => m.workspaceId === inv.workspaceId && m.userId === user.id)) {
        db.members.push({ workspaceId: inv.workspaceId, userId: user.id, role: inv.role, createdAt: now() });
      }
      inv.acceptedAt = now();
      inv.acceptedBy = user.id;
      db.audit.push({
        id: randomUUID(),
        workspaceId: inv.workspaceId,
        actorId: user.id,
        action: "member.joined",
        entity: "workspace_member",
        entityId: null,
        meta: { role: inv.role },
        at: now(),
      });
      return inv.workspaceId;
    });
  }

  async setMemberRole(workspaceId: ID, actorId: ID, userId: ID, role: Role) {
    await this.store.mutate((db) => {
      const members = db.members.filter((m) => m.workspaceId === workspaceId);
      const target = members.find((m) => m.userId === userId);
      assertCanChangeRole({
        actorId,
        actorRole: members.find((m) => m.userId === actorId)?.role ?? null,
        targetId: userId,
        targetRole: target?.role ?? null,
        newRole: role,
        ownerCount: members.filter((m) => m.role === "owner").length,
      });
      target!.role = role;
    });
  }

  async removeMember(workspaceId: ID, actorId: ID, userId: ID) {
    await this.store.mutate((db) => {
      const members = db.members.filter((m) => m.workspaceId === workspaceId);
      assertCanRemove({
        actorId,
        actorRole: members.find((m) => m.userId === actorId)?.role ?? null,
        targetId: userId,
        targetRole: members.find((m) => m.userId === userId)?.role ?? null,
        ownerCount: members.filter((m) => m.role === "owner").length,
      });
      db.members = db.members.filter((m) => !(m.workspaceId === workspaceId && m.userId === userId));
    });
  }

  // ───────────── Contas ─────────────
  async listAccounts(workspaceId: ID) {
    const db = await this.store.read();
    return db.accounts
      .filter((a) => a.workspaceId === workspaceId)
      .sort((a, b) => a.username.localeCompare(b.username));
  }

  async getAccount(workspaceId: ID, id: ID) {
    const db = await this.store.read();
    return db.accounts.find((a) => a.workspaceId === workspaceId && a.id === id) ?? null;
  }

  async upsertAccount(workspaceId: ID, input: NewAccount): Promise<SocialAccount> {
    return this.store.mutate((db) => {
      const existing = db.accounts.find(
        (a) =>
          a.workspaceId === workspaceId &&
          a.provider === input.provider &&
          a.providerAccountId === input.providerAccountId,
      );
      if (existing) {
        Object.assign(existing, { ...input, tags: existing.tags, group: existing.group });
        return existing;
      }
      const acc: SocialAccount = { ...input, id: randomUUID(), workspaceId, createdAt: now() };
      db.accounts.push(acc);
      return acc;
    });
  }

  async updateAccounts(workspaceId: ID, ids: ID[], patch: Partial<SocialAccount>) {
    await this.store.mutate((db) => {
      for (const a of db.accounts) {
        if (a.workspaceId === workspaceId && ids.includes(a.id)) Object.assign(a, patch);
      }
    });
  }

  async deleteAccount(workspaceId: ID, id: ID) {
    await this.store.mutate((db) => {
      db.accounts = db.accounts.filter((a) => !(a.workspaceId === workspaceId && a.id === id));
      db.credentials = db.credentials.filter((c) => c.accountId !== id);
      for (const t of db.targets) {
        if (t.socialAccountId === id && ["draft", "scheduled", "queued"].includes(t.status)) {
          t.status = "cancelled";
          t.lastError = "Conta desconectada";
          t.updatedAt = now();
        }
      }
    });
  }

  // ───────────── Mídia ─────────────
  async listMedia(workspaceId: ID, filter: MediaFilter = {}) {
    const db = await this.store.read();
    const q = filter.search?.toLowerCase().trim();
    return db.media
      .filter((m) => m.workspaceId === workspaceId)
      .filter((m) => !filter.kind || m.kind === filter.kind)
      .filter((m) => !filter.folder || m.folder === filter.folder)
      .filter((m) => !filter.tag || m.tags.includes(filter.tag))
      .filter(
        (m) =>
          !q || m.fileName.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getMediaByIds(workspaceId: ID, ids: ID[]) {
    const db = await this.store.read();
    return ids
      .map((id) => db.media.find((m) => m.id === id && m.workspaceId === workspaceId))
      .filter((m): m is MediaAsset => !!m);
  }

  async createMedia(workspaceId: ID, input: NewMedia) {
    return this.store.mutate((db) => {
      const m: MediaAsset = { ...input, id: randomUUID(), workspaceId, createdAt: now() };
      db.media.push(m);
      return m;
    });
  }

  async updateMedia(workspaceId: ID, ids: ID[], patch: Partial<MediaAsset>) {
    await this.store.mutate((db) => {
      for (const m of db.media) {
        if (m.workspaceId === workspaceId && ids.includes(m.id)) Object.assign(m, patch);
      }
    });
  }

  async deleteMedia(workspaceId: ID, ids: ID[]) {
    return this.store.mutate((db) => {
      const removed = db.media.filter((m) => m.workspaceId === workspaceId && ids.includes(m.id));
      db.media = db.media.filter((m) => !removed.includes(m));
      return removed;
    });
  }

  async storageUsedBytes(workspaceId: ID) {
    const db = await this.store.read();
    return db.media.filter((m) => m.workspaceId === workspaceId).reduce((s, m) => s + m.sizeBytes, 0);
  }

  // Contas demo nunca têm métricas reais.
  async listMediaInsights(): Promise<MediaInsightRow[]> {
    return [];
  }

  async listAccountSnapshots(): Promise<AccountSnapshot[]> {
    return [];
  }

  // ───────────── Legendas / Campanhas ─────────────
  async listCaptions(workspaceId: ID) {
    const db = await this.store.read();
    return db.captions.filter((c) => c.workspaceId === workspaceId);
  }
  async createCaption(workspaceId: ID, input: { title: string; body: string }) {
    return this.store.mutate((db) => {
      const c = { ...input, id: randomUUID(), workspaceId, createdAt: now() };
      db.captions.push(c);
      return c;
    });
  }
  async deleteCaption(workspaceId: ID, id: ID) {
    await this.store.mutate((db) => {
      db.captions = db.captions.filter((c) => !(c.workspaceId === workspaceId && c.id === id));
    });
  }
  async listCampaigns(workspaceId: ID) {
    const db = await this.store.read();
    return db.campaigns.filter((c) => c.workspaceId === workspaceId);
  }
  async createCampaign(workspaceId: ID, input: { name: string; color: string; description?: string | null }) {
    return this.store.mutate((db) => {
      const c = {
        name: input.name,
        color: input.color,
        description: input.description ?? null,
        id: randomUUID(),
        workspaceId,
        createdAt: now(),
      };
      db.campaigns.push(c);
      return c;
    });
  }
  async deleteCampaign(workspaceId: ID, id: ID) {
    await this.store.mutate((db) => {
      db.campaigns = db.campaigns.filter((c) => !(c.workspaceId === workspaceId && c.id === id));
      for (const p of db.publications) if (p.campaignId === id) p.campaignId = null;
    });
  }

  // ───────────── Publicações ─────────────
  async findPublicationByKey(workspaceId: ID, key: string) {
    const db = await this.store.read();
    return db.publications.find((p) => p.workspaceId === workspaceId && p.idempotencyKey === key) ?? null;
  }

  async createPublication(
    workspaceId: ID,
    input: Omit<Publication, "id" | "createdAt" | "workspaceId">,
    accountIds: ID[],
    status: "scheduled" | "draft",
  ) {
    return this.store.mutate((db) => {
      // Idempotência verificada dentro do lock: requisições repetidas retornam o mesmo resultado.
      const dup = db.publications.find(
        (p) => p.workspaceId === workspaceId && p.idempotencyKey === input.idempotencyKey,
      );
      if (dup) {
        return { publication: dup, targets: db.targets.filter((t) => t.publicationId === dup.id) };
      }
      const publication: Publication = { ...input, id: randomUUID(), workspaceId, createdAt: now() };
      db.publications.push(publication);
      const targets = accountIds.map<PublicationTarget>((accountId) => ({
        id: randomUUID(),
        workspaceId,
        publicationId: publication.id,
        socialAccountId: accountId,
        status,
        scheduledAt: publication.scheduledAt,
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: null,
        lockedBy: null,
        lockedUntil: null,
        providerContainerId: null,
        providerMediaId: null,
        permalink: null,
        lastError: null,
        errorKind: null,
        simulated: false,
        publishedAt: null,
        createdAt: now(),
        updatedAt: now(),
      }));
      db.targets.push(...targets);
      return { publication, targets };
    });
  }

  async listTargets(workspaceId: ID, f: TargetFilter = {}) {
    const db = await this.store.read();
    const list = db.targets
      .filter((t) => t.workspaceId === workspaceId)
      .filter((t) => !f.from || t.scheduledAt >= f.from)
      .filter((t) => !f.to || t.scheduledAt < f.to)
      .filter((t) => !f.statuses?.length || f.statuses.includes(t.status))
      .filter((t) => !f.accountIds?.length || f.accountIds.includes(t.socialAccountId))
      .map((t) => toView(db, t))
      .filter((t) => !f.campaignId || t.campaignId === f.campaignId)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    return f.limit ? list.slice(0, f.limit) : list;
  }

  async getTarget(workspaceId: ID, id: ID) {
    const db = await this.store.read();
    const t = db.targets.find((x) => x.workspaceId === workspaceId && x.id === id);
    return t ? toView(db, t) : null;
  }

  async updateTargetIf(workspaceId: ID, id: ID, expected: PublicationTarget["status"][], patch: Partial<PublicationTarget>) {
    return this.store.mutate((db) => {
      const t = db.targets.find((x) => x.workspaceId === workspaceId && x.id === id);
      if (!t || !expected.includes(t.status)) return false;
      Object.assign(t, patch, { updatedAt: now() });
      return true;
    });
  }

  async countTargetsCreatedSince(workspaceId: ID, sinceIso: string) {
    const db = await this.store.read();
    return db.targets.filter((t) => t.workspaceId === workspaceId && t.createdAt >= sinceIso).length;
  }

  async listLogs(workspaceId: ID, targetId: ID) {
    const db = await this.store.read();
    return db.logs
      .filter((l) => l.workspaceId === workspaceId && l.targetId === targetId)
      .sort((a, b) => a.at.localeCompare(b.at));
  }

  async addAudit(entry: Parameters<WorkspaceRepository["addAudit"]>[0]) {
    await this.store.mutate((db) => {
      db.audit.push({ ...entry, id: randomUUID(), at: now() });
    });
  }

  async listAudit(workspaceId: ID, limit = 50) {
    const db = await this.store.read();
    return db.audit
      .filter((a) => a.workspaceId === workspaceId)
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, limit);
  }

  // ───────────── Sistema (worker) ─────────────
  async promoteDueTargets(nowIso: string, limit: number) {
    return this.store.mutate((db) => {
      let n = 0;
      for (const t of db.targets) {
        if (n >= limit) break;
        if (t.status === "scheduled" && t.scheduledAt <= nowIso) {
          t.status = "queued";
          t.nextAttemptAt = nowIso;
          t.updatedAt = nowIso;
          n++;
        }
      }
      return n;
    });
  }

  async claimTargets(workerId: string, nowIso: string, leaseMs: number, limit: number) {
    return this.store.mutate((db) => {
      const busy = new Set(
        db.targets
          .filter((t) => t.status === "processing" && t.lockedUntil && t.lockedUntil > nowIso)
          .map((t) => t.socialAccountId),
      );
      const ready = db.targets
        .filter(
          (t) =>
            (t.status === "queued" && (!t.nextAttemptAt || t.nextAttemptAt <= nowIso)) ||
            (t.status === "processing" && (!t.lockedUntil || t.lockedUntil <= nowIso)),
        )
        .sort((a, b) => (a.nextAttemptAt ?? a.scheduledAt).localeCompare(b.nextAttemptAt ?? b.scheduledAt));
      const claimed: PublicationTarget[] = [];
      const until = new Date(Date.parse(nowIso) + leaseMs).toISOString();
      for (const t of ready) {
        if (claimed.length >= limit) break;
        if (busy.has(t.socialAccountId)) continue;
        busy.add(t.socialAccountId);
        t.status = "processing";
        t.lockedBy = workerId;
        t.lockedUntil = until;
        t.updatedAt = nowIso;
        claimed.push({ ...t });
      }
      return claimed;
    });
  }

  async updateClaimedTarget(id: ID, workerId: string, patch: Partial<PublicationTarget>) {
    return this.store.mutate((db) => {
      const t = db.targets.find((x) => x.id === id);
      if (!t || t.lockedBy !== workerId || t.status !== "processing") return false;
      Object.assign(t, patch, { updatedAt: now() });
      return true;
    });
  }

  async getPublication(id: ID) {
    const db = await this.store.read();
    return db.publications.find((p) => p.id === id) ?? null;
  }

  async getAccountById(id: ID) {
    const db = await this.store.read();
    return db.accounts.find((a) => a.id === id) ?? null;
  }

  async updateAccountSystem(id: ID, patch: Partial<SocialAccount>) {
    await this.store.mutate((db) => {
      const a = db.accounts.find((x) => x.id === id);
      if (a) Object.assign(a, patch);
    });
  }

  async getMediaSystem(ids: ID[]) {
    const db = await this.store.read();
    return ids.map((id) => db.media.find((m) => m.id === id)).filter((m): m is MediaAsset => !!m);
  }

  async countPublishedSince(accountId: ID, sinceIso: string) {
    const db = await this.store.read();
    return db.targets.filter(
      (t) => t.socialAccountId === accountId && t.status === "published" && (t.publishedAt ?? "") >= sinceIso,
    ).length;
  }

  async appendLog(entry: Parameters<SystemRepository["appendLog"]>[0]) {
    await this.store.mutate((db) => {
      db.logs.push({ ...entry, id: randomUUID(), at: now() });
    });
  }

  async saveCredential(accountId: ID, ciphertext: string, expiresAt: string | null) {
    await this.store.mutate((db) => {
      db.credentials = db.credentials.filter((c) => c.accountId !== accountId);
      db.credentials.push({ accountId, ciphertext, expiresAt, updatedAt: now() });
    });
  }

  async getCredential(accountId: ID) {
    const db = await this.store.read();
    return db.credentials.find((c) => c.accountId === accountId) ?? null;
  }

  async deleteCredential(accountId: ID) {
    await this.store.mutate((db) => {
      db.credentials = db.credentials.filter((c) => c.accountId !== accountId);
    });
  }
}
