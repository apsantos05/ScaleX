import type { PlanId } from "./types";

export type PlanLimits = {
  id: PlanId;
  name: string;
  priceBRL: number | null;
  maxAccounts: number;
  maxScheduledPerMonth: number;
  maxStorageMb: number;
  maxMembers: number;
  features: string[];
};

/**
 * Catálogo de planos (valores provisórios — definir comercialmente).
 * Nenhuma cobrança real é feita: o gateway de pagamento ainda não está integrado.
 */
export const PLANS: Record<PlanId, PlanLimits> = {
  trial: {
    id: "trial",
    name: "Trial",
    priceBRL: 0,
    maxAccounts: 3,
    maxScheduledPerMonth: 60,
    maxStorageMb: 500,
    maxMembers: 2,
    features: ["Até 3 contas", "60 publicações/mês", "Biblioteca 500 MB"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceBRL: 197,
    maxAccounts: 10,
    maxScheduledPerMonth: 600,
    maxStorageMb: 5_000,
    maxMembers: 3,
    features: ["Até 10 contas", "600 publicações/mês", "Biblioteca 5 GB", "3 membros"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceBRL: 497,
    maxAccounts: 40,
    maxScheduledPerMonth: 3_000,
    maxStorageMb: 25_000,
    maxMembers: 10,
    features: ["Até 40 contas", "3.000 publicações/mês", "Biblioteca 25 GB", "10 membros"],
  },
  scale: {
    id: "scale",
    name: "Scale",
    priceBRL: null,
    maxAccounts: 150,
    maxScheduledPerMonth: 12_000,
    maxStorageMb: 100_000,
    maxMembers: 30,
    features: ["Até 150 contas", "12.000 publicações/mês", "Biblioteca 100 GB", "Suporte dedicado"],
  },
};

export function planLimits(plan: PlanId): PlanLimits {
  return PLANS[plan] ?? PLANS.trial;
}
