import type { Workspace } from "./types";

export const TRIAL_DAYS = 3;

export type WorkspaceAccess =
  | { state: "paid" }
  | { state: "trial"; endsAt: string; msLeft: number }
  | { state: "locked"; reason: "trial_ended" | "no_plan" };

/**
 * Acesso do workspace: teste do Pro (com prazo), plano pago, ou bloqueado.
 * Mesma regra da função SQL public.workspace_locked: plano 'trial' (sem plano) ou teste vencido.
 */
export function workspaceAccess(ws: Pick<Workspace, "plan" | "trialEndsAt">, now = new Date()): WorkspaceAccess {
  if (ws.trialEndsAt) {
    const msLeft = Date.parse(ws.trialEndsAt) - now.getTime();
    return msLeft > 0 ? { state: "trial", endsAt: ws.trialEndsAt, msLeft } : { state: "locked", reason: "trial_ended" };
  }
  if (ws.plan === "trial") return { state: "locked", reason: "no_plan" };
  return { state: "paid" };
}

/** "2 dias", "5 horas", "menos de 1 hora". */
export function formatTimeLeft(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) {
    const d = Math.ceil(hours / 24);
    return `${d} dia${d > 1 ? "s" : ""}`;
  }
  if (hours >= 1) return `${hours} hora${hours > 1 ? "s" : ""}`;
  return "menos de 1 hora";
}
