import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutUrl, decideAction, ordersOf, periodEndFrom, planForOffer, verifyCaktoDelivery, type CaktoOrder } from "@/lib/billing/cakto";

vi.mock("server-only", () => ({}));

const SECRET = "b3f1a9c2-7b4d-4a8e-9f01-2c6d5b8a4e37";
const sign = (ts: number, body: string, secret = SECRET) => `v1=${createHmac("sha256", secret).update(`${ts}.`).update(body).digest("hex")}`;

describe("verificação de origem do webhook Cakto", () => {
  const body = JSON.stringify({ event: "purchase_approved", data: { id: "x" } });
  const now = 1_800_000_000;

  it("aceita assinatura HMAC válida dentro da janela", () => {
    expect(verifyCaktoDelivery({ rawBody: body, timestamp: String(now), signature: sign(now, body), bodySecret: undefined, secret: SECRET, nowSeconds: now + 10 })).toEqual({ ok: true, method: "signature" });
  });

  it("aceita header com várias versões (rotação)", () => {
    const sig = `v2=abc, ${sign(now, body)}`;
    expect(verifyCaktoDelivery({ rawBody: body, timestamp: String(now), signature: sig, bodySecret: undefined, secret: SECRET, nowSeconds: now }).ok).toBe(true);
  });

  it("rejeita corpo adulterado, segredo errado e entrega antiga (replay)", () => {
    expect(verifyCaktoDelivery({ rawBody: body + " ", timestamp: String(now), signature: sign(now, body), bodySecret: undefined, secret: SECRET, nowSeconds: now }).ok).toBe(false);
    expect(verifyCaktoDelivery({ rawBody: body, timestamp: String(now), signature: sign(now, body, "outro"), bodySecret: undefined, secret: SECRET, nowSeconds: now }).ok).toBe(false);
    expect(verifyCaktoDelivery({ rawBody: body, timestamp: String(now), signature: sign(now, body), bodySecret: undefined, secret: SECRET, nowSeconds: now + 3600 })).toEqual({ ok: false, reason: "stale-timestamp" });
  });

  it("com assinatura presente, um secret correto no corpo NÃO salva assinatura inválida", () => {
    expect(verifyCaktoDelivery({ rawBody: body, timestamp: String(now), signature: "v1=deadbeef", bodySecret: SECRET, secret: SECRET, nowSeconds: now }).ok).toBe(false);
  });

  it("sem headers, cai para o secret do corpo", () => {
    expect(verifyCaktoDelivery({ rawBody: body, timestamp: null, signature: null, bodySecret: SECRET, secret: SECRET })).toEqual({ ok: true, method: "body-secret" });
    expect(verifyCaktoDelivery({ rawBody: body, timestamp: null, signature: null, bodySecret: "errado", secret: SECRET }).ok).toBe(false);
    expect(verifyCaktoDelivery({ rawBody: body, timestamp: null, signature: null, bodySecret: SECRET, secret: "" }).ok).toBe(false);
  });
});

describe("mapeamento de eventos", () => {
  const main: CaktoOrder = { id: "o1", status: "paid", offer_type: "main" };

  it("ativa no pagamento aprovado e nas renovações", () => {
    for (const e of ["purchase_approved", "subscription_created", "subscription_renewed", "subscription_late_recovered", "subscription_resumed"]) {
      expect(decideAction(e, main).kind).toBe("activate");
    }
  });
  it("atraso/pausa mudam status sem rebaixar; cancelamento respeita o período; estorno é imediato", () => {
    expect(decideAction("subscription_late", main)).toEqual({ kind: "status", status: "past_due" });
    expect(decideAction("subscription_renewal_refused", main)).toEqual({ kind: "status", status: "past_due" });
    expect(decideAction("subscription_paused", main)).toEqual({ kind: "status", status: "paused" });
    expect(decideAction("subscription_canceled", main)).toEqual({ kind: "cancel", immediate: false });
    expect(decideAction("refund", main)).toEqual({ kind: "cancel", immediate: true });
    expect(decideAction("chargeback", main)).toEqual({ kind: "cancel", immediate: true });
  });
  it("ignora order bump, pedido não pago e eventos sem efeito no plano", () => {
    expect(decideAction("purchase_approved", { ...main, offer_type: "orderbump" }).kind).toBe("ignore");
    expect(decideAction("purchase_approved", { ...main, status: "waiting_payment" }).kind).toBe("ignore");
    expect(decideAction("pix_gerado", main).kind).toBe("ignore");
  });
  it("lê data em objeto (V1) e em lista (V2) e descarta abandono sem id", () => {
    expect(ordersOf({ data: { id: "a" } })).toHaveLength(1);
    expect(ordersOf({ data: [{ id: "a" }, { id: "b" }] })).toHaveLength(2);
    expect(ordersOf({ data: { customerEmail: "x@y.z" } })).toHaveLength(0);
  });
  it("plano vem da oferta configurada; link de checkout leva só o token", () => {
    const offers = { starter: "offS", pro: "offP" };
    expect(planForOffer("offP", offers)).toBe("pro");
    expect(planForOffer("desconhecida", offers)).toBeNull();
    expect(checkoutUrl("offP", "tok_123")).toBe("https://pay.cakto.com.br/offP?callback=tok_123");
  });
  it("fim do período: próxima cobrança, senão pagamento + 1 mês", () => {
    expect(periodEndFrom({ id: "x", subscription: { next_payment_date: "2026-12-19T10:00:00Z" } })).toBe("2026-12-19T10:00:00.000Z");
    expect(periodEndFrom({ id: "x", paidAt: "2026-11-19T10:00:00Z" })).toBe("2026-12-19T10:00:00.000Z");
  });
});

// ── Processamento ponta a ponta com o banco simulado ──
const db = {
  checkouts: new Map<string, { workspaceId: string; plan: string; offerId: string }>(),
  events: new Set<string>(),
  subs: new Map<string, { plan: string; status: string; provider: string | null; providerSubscriptionId: string | null; currentPeriodEnd: string | null }>(),
  plans: new Map<string, string>(),
  invoices: new Map<string, string>(),
};
vi.mock("@/lib/billing/cakto-api", () => ({ isCaktoApiConfigured: () => false, cancelCaktoSubscription: vi.fn() }));
vi.mock("@/lib/billing/store", () => ({
  findCheckout: async (t: string) => db.checkouts.get(t) ?? null,
  markCheckoutCompleted: async () => undefined,
  eventAlreadyProcessed: async (k: string) => db.events.has(k),
  recordEvent: async (e: { key: string }) => (db.events.has(e.key) ? false : (db.events.add(e.key), true)),
  findWorkspaceBySubscription: async (id: string) => [...db.subs.entries()].find(([, s]) => s.providerSubscriptionId === id)?.[0] ?? null,
  getSubscription: async (ws: string) => (db.subs.has(ws) ? { workspaceId: ws, ...db.subs.get(ws)! } : null),
  activate: async (i: { workspaceId: string; plan: string; providerSubscriptionId: string | null; periodEnd: string }) => {
    db.subs.set(i.workspaceId, { plan: i.plan, status: "active", provider: "cakto", providerSubscriptionId: i.providerSubscriptionId, currentPeriodEnd: i.periodEnd });
    db.plans.set(i.workspaceId, i.plan);
  },
  setStatus: async (ws: string, status: string) => void (db.subs.get(ws)!.status = status),
  cancel: async (ws: string, immediate: boolean) => {
    db.subs.get(ws)!.status = "canceled";
    if (immediate) db.plans.set(ws, "trial");
  },
  addInvoice: async (i: { orderId: string; status: string }) => void db.invoices.set(i.orderId, i.status),
}));

describe("processamento do webhook", () => {
  beforeEach(() => {
    db.checkouts.clear();
    db.events.clear();
    db.subs.clear();
    db.plans.clear();
    db.invoices.clear();
    process.env.CAKTO_OFFER_STARTER = "offS";
    process.env.CAKTO_OFFER_PRO = "offP";
    db.checkouts.set("tok_aaaaaaaaaaaaaaaaaaaaaaa", { workspaceId: "ws1", plan: "pro", offerId: "offP" });
  });

  const approved = (over: Partial<CaktoOrder> = {}) => ({
    event: "purchase_approved",
    data: { id: "ord1", status: "paid", offer_type: "main", callback: "tok_aaaaaaaaaaaaaaaaaaaaaaa", amount: 497, offer: { id: "offP" }, subscription: { id: "sub1" }, ...over },
  });

  it("pagamento aprovado ativa o plano da oferta, gera fatura e é idempotente", async () => {
    const { processCaktoPayload } = await import("@/lib/billing/process");
    expect((await processCaktoPayload(approved()))[0]!.outcome).toBe("activated:pro");
    expect(db.plans.get("ws1")).toBe("pro");
    expect(db.invoices.get("ord1")).toBe("paid");
    expect((await processCaktoPayload(approved()))[0]!.outcome).toBe("duplicate");
  });

  it("o plano segue a oferta paga, não o que foi escolhido na tela", async () => {
    const { processCaktoPayload } = await import("@/lib/billing/process");
    const r = await processCaktoPayload(approved({ offer: { id: "offS" } }));
    expect(r[0]!.outcome).toBe("activated:starter:checkout-was-pro");
    expect(db.plans.get("ws1")).toBe("starter");
  });

  it("oferta desconhecida e pedido sem token/assinatura não alteram nenhum workspace", async () => {
    const { processCaktoPayload } = await import("@/lib/billing/process");
    expect((await processCaktoPayload(approved({ offer: { id: "outra" } })))[0]!.outcome).toBe("unknown-offer:outra");
    expect((await processCaktoPayload(approved({ id: "ord2", callback: null, subscription: null })))[0]!.outcome).toBe("unmatched");
    expect(db.plans.size).toBe(0);
  });

  it("renovação sem callback encontra o workspace pela assinatura; reembolso rebaixa na hora", async () => {
    const { processCaktoPayload } = await import("@/lib/billing/process");
    await processCaktoPayload(approved());
    const renewal = { event: "subscription_renewed", data: { id: "ord3", status: "paid", offer_type: "main", callback: null, amount: 497, offer: { id: "offP" }, subscription: { id: "sub1" } } };
    expect((await processCaktoPayload(renewal))[0]!.outcome).toBe("activated:pro");
    expect(db.invoices.get("ord3")).toBe("paid");
    const refund = { event: "refund", data: { id: "ord3", status: "refunded", offer_type: "main", subscription: { id: "sub1" }, amount: 497 } };
    expect((await processCaktoPayload(refund))[0]!.outcome).toBe("canceled:immediate");
    expect(db.plans.get("ws1")).toBe("trial");
    expect(db.invoices.get("ord3")).toBe("refunded");
  });
});
