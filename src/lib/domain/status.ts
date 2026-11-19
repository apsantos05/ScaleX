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
