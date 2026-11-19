"use server";

import { z } from "zod";
import { authorize } from "@/lib/auth/context";
import { caktoOffers, checkoutUrl, isBillingConfigured } from "@/lib/billing/cakto";
import { cancelCaktoSubscription, isCaktoApiConfigured } from "@/lib/billing/cakto-api";
import * as store from "@/lib/billing/store";
import { getDataMode } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { newToken } from "@/lib/security/tokens";
import { toError, type Result } from "./result";

const planSchema = z.enum(["starter", "pro", "scale"]);

/**
 * Abre uma sessão de checkout: gera um token opaco ligado ao workspace e devolve o link da
 * oferta na Cakto com ?callback=<token>. O plano só muda quando o webhook confirma o pagamento.
 */
export async function startCheckoutAction(plan: string): Promise<Result<{ url: string }>> {
  try {
    const ctx = await authorize("owner");
    if (getDataMode() !== "supabase" || !isBillingConfigured()) return { ok: false, error: "A cobrança ainda não está habilitada neste ambiente." };
    const parsed = planSchema.safeParse(plan);
    if (!parsed.success) return { ok: false, error: "Plano inválido." };
    const offerId = caktoOffers()[parsed.data];
    if (!offerId) return { ok: false, error: "Este plano não está disponível para assinatura online. Fale com a equipe ScaleX." };
    if (!rateLimit(`checkout:${ctx.user.id}`, 20, 60 * 60_000).ok) return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };

    const sub = await store.getSubscription(ctx.workspace.id);
    if (sub?.provider === "cakto" && sub.status === "active" && ctx.workspace.plan === parsed.data) {
      return { ok: false, error: "Este já é o seu plano atual." };
    }

    const token = newToken();
    await store.createCheckout({ token, workspaceId: ctx.workspace.id, plan: parsed.data, offerId, userId: ctx.user.id });
    await ctx.repo.addAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "billing.checkout_started", entity: "subscription", entityId: null, meta: { plan: parsed.data } });
    return { ok: true, data: { url: checkoutUrl(offerId, token) } };
  } catch (e) {
    return toError(e);
  }
}

/** Cancela as cobranças futuras na Cakto. O plano pago continua até o fim do período já pago. */
export async function cancelSubscriptionAction(): Promise<Result<{ message: string }>> {
  try {
    const ctx = await authorize("owner");
    const sub = await store.getSubscription(ctx.workspace.id);
    if (!sub || sub.provider !== "cakto" || !sub.providerSubscriptionId || sub.status === "canceled") {
      return { ok: false, error: "Não há assinatura ativa para cancelar." };
    }
    if (!isCaktoApiConfigured()) {
      return { ok: false, error: "Cancelamento online indisponível no momento. Use o link do e-mail da Cakto ou fale com a equipe ScaleX." };
    }
    const r = await cancelCaktoSubscription(sub.providerSubscriptionId);
    if (!r.ok && r.status !== 400) return { ok: false, error: "A Cakto não confirmou o cancelamento. Tente novamente em instantes." };
    await ctx.repo.addAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "billing.subscription_canceled", entity: "subscription", entityId: null, meta: null });
    return { ok: true, data: { message: "Assinatura cancelada. Seu plano continua ativo até o fim do período pago." } };
  } catch (e) {
    return toError(e);
  }
}
