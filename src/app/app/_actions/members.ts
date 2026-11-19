"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize, WORKSPACE_COOKIE } from "@/lib/auth/context";
import { getCurrentUser } from "@/lib/auth/session";
import { getRepo } from "@/lib/data";
import { INVITATION_TTL_DAYS, MEMBER_ERROR_MESSAGES, MemberError } from "@/lib/domain/members";
import { planLimits } from "@/lib/domain/plans";
import { emailSchema } from "@/lib/domain/schemas";
import { requestOrigin } from "@/lib/request";
import { rateLimit } from "@/lib/security/rate-limit";
import { hashToken, isWellFormedToken, newToken } from "@/lib/security/tokens";
import { toError, type Result } from "./result";

const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["admin", "editor", "viewer"]),
});

export async function inviteMemberAction(input: { email: string; role: string }): Promise<Result<{ link: string; email: string }>> {
  try {
    const ctx = await authorize("admin");
    const rl = rateLimit(`invite:${ctx.user.id}`, 30, 60 * 60_000);
    if (!rl.ok) return { ok: false, error: "Muitos convites em pouco tempo. Tente mais tarde." };
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const { email, role } = parsed.data;
    const ws = ctx.workspace.id;

    const [members, pending] = await Promise.all([ctx.repo.listMembers(ws), ctx.repo.listInvitations(ws)]);
    if (members.some((m) => m.email.toLowerCase() === email)) return { ok: false, error: "Esta pessoa já é membro do workspace." };
    // Um convite pendente por e-mail: reenviar invalida o link anterior.
    const previous = pending.filter((i) => i.email.toLowerCase() === email);
    const limit = planLimits(ctx.workspace.plan).maxMembers;
    if (members.length + pending.length - previous.length >= limit) {
      return { ok: false, error: `O plano ${planLimits(ctx.workspace.plan).name} permite até ${limit} membros (incluindo convites pendentes).` };
    }
    for (const p of previous) await ctx.repo.revokeInvitation(ws, p.id);

    const token = newToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000).toISOString();
    await ctx.repo.createInvitation(ws, { email, role, tokenHash: hashToken(token), invitedBy: ctx.user.id, expiresAt });
    await ctx.repo.addAudit({ workspaceId: ws, actorId: ctx.user.id, action: "member.invited", entity: "workspace_invitation", entityId: null, meta: { role } });
    revalidatePath("/app/settings");
    return { ok: true, data: { link: `${await requestOrigin()}/convite/${token}`, email } };
  } catch (e) {
    return toError(e);
  }
}

export async function revokeInvitationAction(id: string): Promise<Result> {
  try {
    const ctx = await authorize("admin");
    const ok = await ctx.repo.revokeInvitation(ctx.workspace.id, id);
    if (!ok) return { ok: false, error: "Convite não encontrado ou já utilizado." };
    await ctx.repo.addAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "member.invite_revoked", entity: "workspace_invitation", entityId: id, meta: null });
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

const roleSchema = z.enum(["owner", "admin", "editor", "viewer"]);

export async function setMemberRoleAction(userId: string, role: string): Promise<Result> {
  try {
    const ctx = await authorize("admin");
    const parsed = roleSchema.safeParse(role);
    if (!parsed.success) return { ok: false, error: "Papel inválido." };
    await ctx.repo.setMemberRole(ctx.workspace.id, ctx.user.id, userId, parsed.data);
    await ctx.repo.addAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "member.role_changed", entity: "workspace_member", entityId: null, meta: { role: parsed.data } });
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function removeMemberAction(userId: string): Promise<Result> {
  try {
    const ctx = await authorize("admin");
    await ctx.repo.removeMember(ctx.workspace.id, ctx.user.id, userId);
    await ctx.repo.addAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "member.removed", entity: "workspace_member", entityId: null, meta: null });
    revalidatePath("/app/settings");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function acceptInvitationAction(token: string): Promise<Result> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: MEMBER_ERROR_MESSAGES.not_authenticated };
    if (!isWellFormedToken(token)) return { ok: false, error: MEMBER_ERROR_MESSAGES.not_found };
    const repo = await getRepo();
    const workspaceId = await repo.acceptInvitation(hashToken(token), { id: user.id, email: user.email });
    (await cookies()).set(WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 3600,
    });
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof MemberError) return { ok: false, error: MEMBER_ERROR_MESSAGES[e.code] };
    return toError(e);
  }
}
