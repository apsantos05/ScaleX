import type { TargetStatus } from "./types";

/**
 * Máquina de estados de uma publicação por conta.
 * Draft → Scheduled → Queued → Processing → Published | Failed | Cancelled
 * Processing → Queued é permitido para retentativas (falhas transitórias) e para
 * recuperação de leases expirados (worker reiniciado).
 */
const TRANSITIONS: Record<TargetStatus, readonly TargetStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["queued", "cancelled", "scheduled"],
  queued: ["processing", "cancelled"],
  processing: ["published", "failed", "queued"],
  published: [],
  failed: ["scheduled"],
  cancelled: [],
};

export function canTransition(from: TargetStatus, to: TargetStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TargetStatus, to: TargetStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Transição de status inválida: ${from} → ${to}`);
  }
}

/** Itens ainda não iniciados podem ser cancelados pelo usuário. */
export function isCancellable(status: TargetStatus): boolean {
  return status === "draft" || status === "scheduled" || status === "queued";
}

export function isReschedulable(status: TargetStatus): boolean {
  return status === "scheduled" || status === "failed";
}

export function isTerminal(status: TargetStatus): boolean {
  return status === "published" || status === "cancelled";
}

export const STATUS_LABEL: Record<TargetStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  queued: "Na fila",
  processing: "Processando",
  published: "Publicado",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export const ALL_STATUSES: TargetStatus[] = [
  "draft",
  "scheduled",
  "queued",
  "processing",
  "published",
  "failed",
  "cancelled",
];

/** Rótulos legíveis dos formatos de publicação (UI). */
export const FORMAT_LABEL: Record<string, string> = { FEED: "Feed", REELS: "Reels", STORIES: "Story", CAROUSEL: "Carrossel" };

/** Frases legíveis para o registro de auditoria (o código técnico continua disponível no detalhe). */
export const AUDIT_LABEL: Record<string, string> = {
  "account.connected": "Conectou conta(s)",
  "account.disconnected": "Desconectou conta(s)",
  "media.deleted": "Excluiu mídia(s)",
  "member.invite_revoked": "Revogou um convite",
  "member.invited": "Convidou um membro",
  "member.joined": "Novo membro entrou",
  "member.removed": "Removeu um membro",
  "member.role_changed": "Alterou o papel de um membro",
  "publication.scheduled": "Agendou publicação",
  "target.cancelled": "Cancelou publicação(ões)",
  "target.rescheduled": "Reagendou publicação",
  "workspace.created": "Criou o workspace",
  "workspace.exported": "Exportou os dados do workspace",
  "workspace.updated": "Atualizou o workspace",
  "billing.checkout_started": "Abriu o checkout de um plano",
  "billing.subscription_canceled": "Cancelou a assinatura",
};
