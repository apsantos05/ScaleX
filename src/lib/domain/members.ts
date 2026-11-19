import type { ID, Role } from "./types";

/**
 * Regras de convite e gestão de membros. Espelham as funções SQL
 * (supabase/migrations/20261119020000_invitations.sql) para o modo demo e os testes.
 */
export const INVITATION_TTL_DAYS = 7;

export type MemberErrorCode =
  | "not_authenticated"
  | "not_found"
  | "expired"
  | "revoked"
  | "accepted"
  | "email_mismatch"
  | "forbidden"
  | "last_owner"
  | "self";

export class MemberError extends Error {
  constructor(public readonly code: MemberErrorCode) {
    super(code);
    this.name = "MemberError";
  }
}

export const MEMBER_ERROR_MESSAGES: Record<MemberErrorCode, string> = {
  not_authenticated: "Entre na sua conta para continuar.",
  not_found: "Convite ou membro não encontrado.",
  expired: "Este convite expirou. Peça um novo link a quem convidou você.",
  revoked: "Este convite foi cancelado.",
  accepted: "Este convite já foi usado.",
  email_mismatch: "Este convite foi enviado para outro e-mail. Entre com o e-mail convidado.",
  forbidden: "Você não tem permissão para esta ação.",
  last_owner: "O workspace precisa de pelo menos um proprietário.",
  self: "Você não pode alterar o seu próprio papel ou se remover por aqui.",
};

/** Extrai o código de erro de uma exceção do Postgres (raise exception 'codigo'). */
export function memberErrorFrom(message: string): MemberErrorCode | null {
  const code = (Object.keys(MEMBER_ERROR_MESSAGES) as MemberErrorCode[]).find((c) => message.includes(c));
  return code ?? null;
}

export function assertCanChangeRole(input: {
  actorId: ID;
  actorRole: Role | null;
  targetId: ID;
  targetRole: Role | null;
  newRole: Role;
  ownerCount: number;
}): void {
  const { actorId, actorRole, targetId, targetRole, newRole, ownerCount } = input;
  if (!actorRole || (actorRole !== "owner" && actorRole !== "admin")) throw new MemberError("forbidden");
  if (actorId === targetId) throw new MemberError("self");
  if (!targetRole) throw new MemberError("not_found");
  if ((targetRole === "owner" || newRole === "owner") && actorRole !== "owner") throw new MemberError("forbidden");
  if (targetRole === "owner" && newRole !== "owner" && ownerCount <= 1) throw new MemberError("last_owner");
}

export function assertCanRemove(input: {
  actorId: ID;
  actorRole: Role | null;
  targetId: ID;
  targetRole: Role | null;
  ownerCount: number;
}): void {
  const { actorId, actorRole, targetId, targetRole, ownerCount } = input;
  if (!actorRole || (actorRole !== "owner" && actorRole !== "admin")) throw new MemberError("forbidden");
  if (actorId === targetId) throw new MemberError("self");
  if (!targetRole) throw new MemberError("not_found");
  if (targetRole === "owner") {
    if (actorRole !== "owner") throw new MemberError("forbidden");
    if (ownerCount <= 1) throw new MemberError("last_owner");
  }
}

export type InvitationStatus = "valid" | "expired" | "revoked" | "accepted";

export function invitationStatus(inv: { revokedAt: string | null; acceptedAt: string | null; expiresAt: string }, now = new Date()): InvitationStatus {
  if (inv.revokedAt) return "revoked";
  if (inv.acceptedAt) return "accepted";
  if (Date.parse(inv.expiresAt) < now.getTime()) return "expired";
  return "valid";
}
