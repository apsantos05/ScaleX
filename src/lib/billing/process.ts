import "server-only";
import { decideAction, eventKey, ordersOf, periodEndFrom, planForOffer, type CaktoOrder, type CaktoPayload } from "./cakto";
import { cancelCaktoSubscription, isCaktoApiConfigured } from "./cakto-api";
import * as store from "./store";

export type ProcessedOrder = { orderId: string; outcome: string; workspaceId: string | null };

/** Descobre o workspace: primeiro pelo token do checkout (?callback=), depois pela assinatura já vinculada. */
async function resolveWorkspace(order: CaktoOrder): Promise<{ workspaceId: string; checkoutPlan: string | null; token: string | null } | null> {
  if (order.callback) {
    const c = await store.findCheckout(order.callback);
    if (c) return { workspaceId: c.workspaceId, checkoutPlan: c.plan, token: order.callback };
  }
  const subId = order.subscription?.id != null ? String(order.subscription.id) : null;
  if (subId) {
    const ws = await store.findWorkspaceBySubscription(subId);
    if (ws) return { workspaceId: ws, checkoutPlan: null, token: null };
  }
  return null;
}

/**
 * Processa uma entrega já autenticada. Idempotente: cada (evento, pedido) é aplicado uma vez;
 * reaplicar seria inofensivo de qualquer forma (mesmo plano/status, fatura com chave única).
 * Nunca lança por "evento desconhecido" ou "workspace não encontrado": registra o desfecho e segue,
 * porque a Cakto não reenvia entregas que receberam resposta (mesmo 4xx/5xx).
 */
export async function processCaktoPayload(payload: CaktoPayload): Promise<ProcessedOrder[]> {
  const event = typeof payload.event === "string" ? payload.event : "";
  const results: ProcessedOrder[] = [];
  // Para auditoria, o payload é guardado sem o segredo.
  const { secret: _secret, ...stored } = payload;
  void _secret;

  for (const order of ordersOf(payload)) {
    const key = eventKey(event, order);
    if (await store.eventAlreadyProcessed(key)) {
      results.push({ orderId: order.id, outcome: "duplicate", workspaceId: null });
      continue;
    }

    const action = decideAction(event, order);
    const target = action.kind === "ignore" ? null : await resolveWorkspace(order);
    let outcome: string;

    if (action.kind === "ignore") {
      outcome = `ignored:${action.reason}`;
    } else if (!target) {
      outcome = "unmatched"; // sem token nem assinatura conhecida: revisar manualmente no painel da Cakto
    } else if (action.kind === "activate") {
      // O plano vem da OFERTA paga (fonte de verdade do valor), não do que o cliente escolheu na tela.
      const plan = planForOffer(order.offer?.id) ?? null;
      if (!plan) {
        outcome = `unknown-offer:${order.offer?.id ?? "none"}`;
      } else {
        const previous = await store.getSubscription(target.workspaceId);
        const newSubId = order.subscription?.id != null ? String(order.subscription.id) : null;
        await store.activate({
          workspaceId: target.workspaceId,
          plan,
          offerId: order.offer?.id ?? null,
          providerSubscriptionId: order.subscription?.id != null ? String(order.subscription.id) : null,
          customerEmail: order.customer?.email ?? null,
          periodEnd: periodEndFrom(order),
        });
        if (event === "purchase_approved" || event === "subscription_renewed") {
          await store.addInvoice({
            workspaceId: target.workspaceId,
            orderId: order.id,
            amount: order.amount ?? order.baseAmount,
            currency: order.currency,
            status: "paid",
            description: `${order.product?.name ?? "ScaleX"} · ${order.offer?.name ?? plan}`,
          });
        }
        if (target.token) await store.markCheckoutCompleted(target.token);
        // Troca de plano = nova assinatura na Cakto. Cancela a anterior para não cobrar duas vezes.
        // (O webhook de cancelamento da antiga chega como "unmatched", sem afetar o workspace.)
        const oldSubId = previous?.provider === "cakto" ? previous.providerSubscriptionId : null;
        if (oldSubId && newSubId && oldSubId !== newSubId && previous?.status !== "canceled") {
          if (isCaktoApiConfigured()) {
            const r = await cancelCaktoSubscription(oldSubId).catch((e: Error) => ({ ok: false as const, status: 0, detail: e.message }));
            if (!r.ok) console.error(JSON.stringify({ svc: "billing", warn: "old-subscription-not-canceled", status: r.status }));
          } else {
            console.error(JSON.stringify({ svc: "billing", warn: "old-subscription-needs-manual-cancel" }));
          }
        }
        outcome = target.checkoutPlan && target.checkoutPlan !== plan ? `activated:${plan}:checkout-was-${target.checkoutPlan}` : `activated:${plan}`;
      }
    } else if (action.kind === "status") {
      await store.setStatus(target.workspaceId, action.status);
      outcome = `status:${action.status}`;
    } else {
      await store.cancel(target.workspaceId, action.immediate);
      if (event === "refund" || event === "chargeback") {
        await store.addInvoice({ workspaceId: target.workspaceId, orderId: order.id, amount: order.amount ?? order.baseAmount, currency: order.currency, status: event === "refund" ? "refunded" : "chargedback", description: "Pagamento estornado" });
      }
      outcome = action.immediate ? "canceled:immediate" : "canceled:end-of-period";
    }

    await store.recordEvent({ key, event, orderId: order.id, workspaceId: target?.workspaceId ?? null, outcome, payload: stored });
    results.push({ orderId: order.id, outcome, workspaceId: target?.workspaceId ?? null });
  }
  return results;
}
