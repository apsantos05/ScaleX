import "server-only";
import { supabaseAdminClient } from "@/lib/data/supabase-admin";
import type { PlanId } from "@/lib/domain/types";
import type { PaidPlan, SubscriptionStatus } from "./cakto";

/**
 * Persistência da cobrança. Usa o cliente service role: as tabelas de cobrança não têm policies
 * de escrita para usuários, e o campo `workspaces.plan` só pode ser alterado por aqui.
 */

export type SubscriptionRow = {
  workspaceId: string;
  plan: PlanId;
  status: "trialing" | SubscriptionStatus;
  provider: string | null;
  providerSubscriptionId: string | null;
  providerOfferId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
};

export type InvoiceRow = { id: string; amountCents: number; currency: string; status: string; issuedAt: string; description: string | null; providerInvoiceId: string | null };

function db() {
  return supabaseAdminClient();
}

function must<T>(r: { data: T; error: { message: string; code?: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

export async function createCheckout(input: { token: string; workspaceId: string; plan: PaidPlan; offerId: string; userId: string }) {
  must(
    await db().from("billing_checkouts").insert({
      token: input.token,
      workspace_id: input.workspaceId,
      plan: input.plan,
      offer_id: input.offerId,
      created_by: input.userId,
    }),
  );
}

export async function findCheckout(token: string): Promise<{ workspaceId: string; plan: PaidPlan; offerId: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const row = must(await db().from("billing_checkouts").select("workspace_id, plan, offer_id").eq("token", token).maybeSingle()) as {
    workspace_id: string;
    plan: PaidPlan;
    offer_id: string;
  } | null;
  return row ? { workspaceId: row.workspace_id, plan: row.plan, offerId: row.offer_id } : null;
}

export async function markCheckoutCompleted(token: string) {
  must(await db().from("billing_checkouts").update({ completed_at: new Date().toISOString() }).eq("token", token).is("completed_at", null));
}

export async function eventAlreadyProcessed(key: string): Promise<boolean> {
  const row = must(await db().from("billing_events").select("id").eq("event_key", key).maybeSingle());
  return !!row;
}

/** Registra o evento; retorna false se outra entrega igual já foi registrada (corrida de retentativas). */
export async function recordEvent(input: { key: string; event: string; orderId: string | null; workspaceId: string | null; outcome: string; payload: unknown }): Promise<boolean> {
  const r = await db().from("billing_events").insert({
    event_key: input.key,
    event: input.event,
    order_id: input.orderId,
    workspace_id: input.workspaceId,
    outcome: input.outcome,
    payload: input.payload,
  });
  if (r.error?.code === "23505") return false;
  if (r.error) throw new Error(r.error.message);
  return true;
}

export async function findWorkspaceBySubscription(providerSubscriptionId: string): Promise<string | null> {
  const row = must(
    await db().from("subscriptions").select("workspace_id").eq("provider", "cakto").eq("provider_subscription_id", providerSubscriptionId).maybeSingle(),
  ) as { workspace_id: string } | null;
  return row?.workspace_id ?? null;
}

export async function getSubscription(workspaceId: string): Promise<SubscriptionRow | null> {
  const r = must(await db().from("subscriptions").select("*").eq("workspace_id", workspaceId).maybeSingle()) as Record<string, unknown> | null;
  if (!r) return null;
  return {
    workspaceId,
    plan: r.plan as PlanId,
    status: r.status as SubscriptionRow["status"],
    provider: (r.provider as string) ?? null,
    providerSubscriptionId: (r.provider_subscription_id as string) ?? null,
    providerOfferId: (r.provider_offer_id as string) ?? null,
    currentPeriodEnd: (r.current_period_end as string) ?? null,
    cancelAtPeriodEnd: !!r.cancel_at_period_end,
    updatedAt: r.updated_at as string,
  };
}

async function upsertSubscription(workspaceId: string, patch: Record<string, unknown>) {
  const now = new Date().toISOString();
  must(await db().from("subscriptions").upsert({ workspace_id: workspaceId, ...patch, updated_at: now, last_event_at: now }, { onConflict: "workspace_id" }));
}

async function setWorkspacePlan(workspaceId: string, plan: PlanId) {
  // Pagamento confirmado encerra o teste grátis (trial_ends_at = null); sem plano, o workspace fica bloqueado.
  must(await db().from("workspaces").update({ plan, trial_ends_at: null }).eq("id", workspaceId));
}

export async function activate(input: {
  workspaceId: string;
  plan: PaidPlan;
  offerId: string | null;
  providerSubscriptionId: string | null;
  customerEmail: string | null;
  periodEnd: string;
}) {
  await upsertSubscription(input.workspaceId, {
    plan: input.plan,
    status: "active",
    provider: "cakto",
    ...(input.providerSubscriptionId && { provider_subscription_id: input.providerSubscriptionId }),
    ...(input.offerId && { provider_offer_id: input.offerId }),
    ...(input.customerEmail && { provider_customer_id: input.customerEmail }),
    current_period_end: input.periodEnd,
    cancel_at_period_end: false,
  });
  await setWorkspacePlan(input.workspaceId, input.plan);
}

export async function setStatus(workspaceId: string, status: "past_due" | "paused") {
  // Atraso/pausa não rebaixam na hora: a Cakto ainda faz retentativas. Se a assinatura for
  // cancelada depois, o evento subscription_canceled encerra o plano.
  await upsertSubscription(workspaceId, { status });
}

export async function cancel(workspaceId: string, immediate: boolean) {
  const current = await getSubscription(workspaceId);
  const periodEnd = current?.currentPeriodEnd ? Date.parse(current.currentPeriodEnd) : 0;
  if (immediate || !periodEnd || periodEnd <= Date.now()) {
    await upsertSubscription(workspaceId, { status: "canceled", plan: "trial", cancel_at_period_end: false });
    await setWorkspacePlan(workspaceId, "trial");
  } else {
    // Mantém o plano até o fim do período pago; o job diário expire_canceled_subscriptions rebaixa depois.
    await upsertSubscription(workspaceId, { status: "canceled", cancel_at_period_end: true });
  }
}

export async function addInvoice(input: { workspaceId: string; orderId: string; amount: number | null | undefined; currency?: string; status: string; description: string }) {
  if (typeof input.amount !== "number") return;
  const r = await db()
    .from("invoices")
    .upsert(
      {
        workspace_id: input.workspaceId,
        amount_cents: Math.round(input.amount * 100),
        currency: input.currency ?? "BRL",
        status: input.status,
        provider_invoice_id: input.orderId,
        description: input.description,
      },
      { onConflict: "provider_invoice_id" },
    );
  if (r.error) throw new Error(r.error.message);
}

export async function listInvoices(workspaceId: string, limit = 12): Promise<InvoiceRow[]> {
  const rows = must(
    await db().from("invoices").select("id, amount_cents, currency, status, issued_at, description, provider_invoice_id").eq("workspace_id", workspaceId).order("issued_at", { ascending: false }).limit(limit),
  ) as { id: string; amount_cents: number; currency: string; status: string; issued_at: string; description: string | null; provider_invoice_id: string | null }[];
  return rows.map((r) => ({ id: r.id, amountCents: r.amount_cents, currency: r.currency, status: r.status, issuedAt: r.issued_at, description: r.description, providerInvoiceId: r.provider_invoice_id }));
}
