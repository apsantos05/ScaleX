import { createHmac, timingSafeEqual } from "node:crypto";
import type { PlanId } from "@/lib/domain/types";

/**
 * Integração de cobrança com a Cakto (checkout hospedado + webhooks).
 * Módulo puro (sem banco) para ser testável: verificação de origem, leitura do payload
 * e decisão do que cada evento faz com a assinatura do workspace.
 *
 * Docs: https://docs.cakto.com.br/conceitos/webhooks
 */

export const CAKTO_CHECKOUT_BASE = "https://pay.cakto.com.br";
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type PaidPlan = Exclude<PlanId, "trial">;

/** Ofertas da Cakto por plano (IDs curtos das ofertas, ex.: "a8BcHrY"), vindos do ambiente. */
export function caktoOffers(): Partial<Record<PaidPlan, string>> {
  const out: Partial<Record<PaidPlan, string>> = {};
  const map: [PaidPlan, string | undefined][] = [
    ["starter", process.env.CAKTO_OFFER_STARTER],
    ["pro", process.env.CAKTO_OFFER_PRO],
    ["scale", process.env.CAKTO_OFFER_SCALE],
  ];
  for (const [plan, id] of map) if (id && /^[A-Za-z0-9_-]{3,64}$/.test(id)) out[plan] = id;
  return out;
}

export function planForOffer(offerId: string | null | undefined, offers = caktoOffers()): PaidPlan | null {
  if (!offerId) return null;
  const hit = (Object.entries(offers) as [PaidPlan, string][]).find(([, id]) => id === offerId);
  return hit ? hit[0] : null;
}

export function isBillingConfigured(): boolean {
  return !!process.env.CAKTO_WEBHOOK_SECRET && Object.keys(caktoOffers()).length > 0;
}

/** Link do checkout hospedado com o token opaco da sessão (sem dado pessoal na URL). */
export function checkoutUrl(offerId: string, token: string): string {
  return `${CAKTO_CHECKOUT_BASE}/${encodeURIComponent(offerId)}?callback=${encodeURIComponent(token)}`;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Valida a origem da entrega. Preferência: assinatura HMAC-SHA256 do header
 * (`X-Cakto-Signature: v1=<hex>` sobre `${timestamp}.${corpo cru}`), com janela anti-replay.
 * Sem headers de assinatura, cai para a comparação do campo `secret` do corpo (formato antigo).
 */
export function verifyCaktoDelivery(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  bodySecret: unknown;
  secret: string;
  nowSeconds?: number;
}): { ok: true; method: "signature" | "body-secret" } | { ok: false; reason: string } {
  const { rawBody, timestamp, signature, bodySecret, secret } = input;
  if (!secret) return { ok: false, reason: "secret-not-configured" };
  if (signature && timestamp) {
    const ts = Number(timestamp);
    const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: "stale-timestamp" };
    const expected = `v1=${createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex")}`;
    // Durante rotação de algoritmo o header pode trazer várias versões separadas por vírgula.
    const candidates = signature.split(",").map((s) => s.trim()).filter((s) => s.startsWith("v1="));
    return candidates.some((c) => safeEqual(c, expected)) ? { ok: true, method: "signature" } : { ok: false, reason: "bad-signature" };
  }
  if (typeof bodySecret === "string" && bodySecret && safeEqual(bodySecret, secret)) return { ok: true, method: "body-secret" };
  return { ok: false, reason: "missing-signature" };
}

/** Campos do pedido que a ScaleX usa (o payload real tem ~45 campos). */
export type CaktoOrder = {
  id: string;
  refId?: string;
  status?: string;
  offer_type?: string;
  amount?: number | null;
  baseAmount?: number;
  currency?: string;
  callback?: string | null;
  paymentMethod?: string;
  customer?: { email?: string; name?: string } | null;
  offer?: { id?: string; name?: string; price?: number } | null;
  product?: { id?: string; name?: string } | null;
  subscription?: { id?: string | number; status?: string; next_payment_date?: string; nextPaymentDate?: string } | null;
  paidAt?: string | null;
  createdAt?: string;
};

export type CaktoPayload = { secret?: unknown; event?: unknown; data?: unknown };

/** Webhook V2 entrega `data` como lista; V1 como objeto. Abandono de checkout não tem `id`. */
export function ordersOf(payload: CaktoPayload): CaktoOrder[] {
  const raw = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
  return raw.filter((d): d is CaktoOrder => !!d && typeof d === "object" && typeof (d as CaktoOrder).id === "string");
}

export type SubscriptionStatus = "active" | "past_due" | "paused" | "canceled";

export type BillingAction =
  | { kind: "activate"; status: "active" }
  | { kind: "status"; status: Exclude<SubscriptionStatus, "active" | "canceled"> }
  | { kind: "cancel"; immediate: boolean }
  | { kind: "ignore"; reason: string };

/**
 * O que cada evento faz. Só o pedido principal (offer_type "main") mexe no plano;
 * order bumps/upsells são ignorados.
 */
export function decideAction(event: string, order: CaktoOrder): BillingAction {
  if (order.offer_type && order.offer_type !== "main") return { kind: "ignore", reason: `offer_type:${order.offer_type}` };
  switch (event) {
    case "purchase_approved":
      return order.status && order.status !== "paid" ? { kind: "ignore", reason: `status:${order.status}` } : { kind: "activate", status: "active" };
    case "subscription_created":
    case "subscription_renewed":
    case "subscription_late_recovered":
    case "subscription_resumed":
      return { kind: "activate", status: "active" };
    case "subscription_late":
    case "subscription_renewal_refused":
      return { kind: "status", status: "past_due" };
    case "subscription_paused":
      return { kind: "status", status: "paused" };
    case "subscription_canceled":
      // Cancelamento normal: o acesso pago vale até o fim do período já pago.
      return { kind: "cancel", immediate: false };
    case "refund":
    case "chargeback":
      // Dinheiro devolvido/contestado: o plano pago termina na hora.
      return { kind: "cancel", immediate: true };
    default:
      return { kind: "ignore", reason: `event:${event}` };
  }
}

/** Chave de deduplicação: o mesmo pedido pode gerar eventos diferentes (aprovado → reembolso). */
export function eventKey(event: string, order: CaktoOrder): string {
  return `cakto:${event}:${order.id}`;
}

/** Fim do período pago: usa a próxima cobrança informada; senão, pagamento + 1 mês. */
export function periodEndFrom(order: CaktoOrder, now = new Date()): string {
  const next = order.subscription?.next_payment_date ?? order.subscription?.nextPaymentDate;
  if (next && !Number.isNaN(Date.parse(next))) return new Date(next).toISOString();
  const base = order.paidAt && !Number.isNaN(Date.parse(order.paidAt)) ? new Date(order.paidAt) : now;
  const end = new Date(base);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return end.toISOString();
}
