import { Check, MessageCircle, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { Meter } from "@/components/app/charts";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, type Tone } from "@/components/ui/primitives";
import { requireWorkspace, roleAtLeast } from "@/lib/auth/context";
import { caktoOffers, isBillingConfigured } from "@/lib/billing/cakto";
import { isCaktoApiConfigured } from "@/lib/billing/cakto-api";
import * as billing from "@/lib/billing/store";
import { formatBytes } from "@/lib/domain/media-rules";
import { PLANS, planLimits } from "@/lib/domain/plans";
import { getDataMode } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/utils";
import { CancelSubscriptionButton, SubscribeButton } from "./billing-actions";

export const metadata: Metadata = { title: "Assinatura" };

const STATUS: Record<string, { label: string; tone: Tone }> = {
  trialing: { label: "Trial", tone: "neutral" },
  active: { label: "Ativa", tone: "success" },
  past_due: { label: "Pagamento em atraso", tone: "warning" },
  paused: { label: "Pausada", tone: "warning" },
  canceled: { label: "Cancelada", tone: "neutral" },
};
const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  paid: { label: "Paga", tone: "success" },
  refunded: { label: "Reembolsada", tone: "neutral" },
  chargedback: { label: "Contestada", tone: "danger" },
};
const PLAN_ORDER = ["trial", "starter", "pro", "scale"] as const;

export default async function BillingPage({ searchParams }: PageProps<"/app/billing">) {
  const { repo, workspace, role } = await requireWorkspace();
  const sp = await searchParams;
  const limits = planLimits(workspace.plan);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const isOwner = roleAtLeast(role, "owner");
  const canSeeBilling = roleAtLeast(role, "admin");
  const realMode = getDataMode() === "supabase";
  const billingOn = realMode && isBillingConfigured();
  const offers = caktoOffers();

  const [accounts, monthly, storage, members, subscription, invoices] = await Promise.all([
    repo.listAccounts(workspace.id),
    repo.countTargetsCreatedSince(workspace.id, monthStart),
    repo.storageUsedBytes(workspace.id),
    repo.listMembers(workspace.id),
    // Status da assinatura é visível a todos os membros (como na RLS); valores pagos, só a owner/admin.
    realMode ? billing.getSubscription(workspace.id) : Promise.resolve(null),
    realMode && canSeeBilling ? billing.listInvoices(workspace.id) : Promise.resolve([]),
  ]);
  const usage = [
    { label: "Contas reais conectadas", value: accounts.filter((a) => !a.isDemo).length, max: limits.maxAccounts, fmt: (n: number) => String(n) },
    { label: "Publicações no mês", value: monthly, max: limits.maxScheduledPerMonth, fmt: (n: number) => n.toLocaleString("pt-BR") },
    { label: "Armazenamento", value: storage, max: limits.maxStorageMb * 1024 * 1024, fmt: formatBytes },
    { label: "Membros", value: members.length, max: limits.maxMembers, fmt: (n: number) => String(n) },
  ];
  const paidViaCakto = subscription?.provider === "cakto";
  const status = paidViaCakto ? STATUS[subscription.status] : undefined;
  const currentRank = PLAN_ORDER.indexOf(workspace.plan);
  const returning = sp.checkout === "retorno";

  return (
    <>
      <PageHeader title="Assinatura" description="Plano, limites, consumo e pagamentos do workspace." />

      {returning && (
        <Alert tone="info" className="mb-6" title="Pagamento em processamento">
          Assim que a Cakto confirmar o pagamento, seu plano é atualizado automaticamente — no cartão costuma levar segundos; no Pix, logo
          após o pagamento. Recarregue esta página para ver o novo plano.
        </Alert>
      )}
      {!billingOn && (
        <Alert tone="info" className="mb-6" title="Assinatura online ainda não habilitada">
          {realMode
            ? "O checkout pela Cakto será liberado em breve. Até lá, upgrades são feitos pela equipe ScaleX."
            : "No modo demonstração não há cobrança. Upgrades são simulados pela equipe ScaleX."}
        </Alert>
      )}
      {paidViaCakto && subscription.status === "past_due" && (
        <Alert tone="warning" className="mb-6" title="Pagamento em atraso">
          A última cobrança não foi aprovada e a Cakto fará novas tentativas. Atualize o meio de pagamento pelo link enviado por e-mail pela
          Cakto para não perder o plano.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={`Plano ${limits.name}`}
            description={
              paidViaCakto && subscription.currentPeriodEnd
                ? subscription.status === "canceled"
                  ? `Cancelado · ativo até ${formatDate(subscription.currentPeriodEnd)}`
                  : `Próxima renovação prevista: ${formatDate(subscription.currentPeriodEnd)}`
                : limits.priceBRL
                  ? `R$ ${limits.priceBRL}/mês`
                  : limits.priceBRL === 0
                    ? "Gratuito"
                    : "Plano personalizado"
            }
            action={status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge tone="brand">Atual</Badge>}
          />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            {usage.map((u) => (
              <div key={u.label}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-fg-muted">{u.label}</span>
                  <span className="tabular-nums">
                    {u.fmt(u.value)} / {u.fmt(u.max)}
                  </span>
                </div>
                <Meter value={u.value} max={u.max} className="mt-2" />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Pagamentos" description={paidViaCakto ? "Processados pela Cakto" : undefined} />
          {!canSeeBilling ? (
            <p className="p-5 text-sm text-fg-muted">Somente proprietários e administradores veem o histórico de pagamentos.</p>
          ) : invoices.length === 0 ? (
            <EmptyState icon={Receipt} title="Nenhum pagamento" description="Os pagamentos da assinatura aparecem aqui." className="py-10" />
          ) : (
            <ul className="divide-y divide-border/60 px-5 pb-3">
              {invoices.map((i) => {
                const st = INVOICE_STATUS[i.status] ?? { label: i.status, tone: "neutral" as Tone };
                return (
                  <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="tabular-nums">{(i.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: i.currency })}</p>
                      <p className="truncate text-xs text-fg-subtle">{formatDateTime(i.issuedAt)}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <h2 className="mb-1 mt-10 text-sm font-semibold">Planos</h2>
      <p className="mb-4 text-sm text-fg-muted">
        Pagamento seguro pela Cakto (cartão ou Pix). O plano é liberado automaticamente após a confirmação.
        {!isOwner && " Somente o proprietário do workspace pode assinar ou trocar de plano."}
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.values(PLANS).map((p) => {
          const current = p.id === workspace.plan;
          const rank = PLAN_ORDER.indexOf(p.id);
          const purchasable = p.id !== "trial" && !!offers[p.id as keyof typeof offers];
          return (
            <Card key={p.id} className={current ? "border-brand/50" : undefined}>
              <div className="flex h-full flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  {current && <Badge tone="brand">Seu plano</Badge>}
                </div>
                <p className="mt-2 text-2xl font-semibold">
                  {p.priceBRL === null ? "Sob consulta" : p.priceBRL === 0 ? "Grátis" : `R$ ${p.priceBRL}`}
                  {!!p.priceBRL && <span className="text-sm font-normal text-fg-muted">/mês</span>}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-fg-muted">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {current || p.id === "trial" ? null : isOwner && billingOn && purchasable ? (
                    <SubscribeButton plan={p.id} label={rank > currentRank ? `Assinar ${p.name}` : `Mudar para ${p.name}`} variant={rank > currentRank ? "primary" : "secondary"} />
                  ) : p.priceBRL === null ? (
                    <a
                      href="https://www.instagram.com/scalexspam/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2"
                    >
                      <MessageCircle className="size-4" aria-hidden /> Falar com vendas
                    </a>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 p-5 text-sm text-fg-muted">
        <h2 className="mb-1 font-semibold text-fg">Cancelamento</h2>
        {paidViaCakto && subscription.status !== "canceled" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Cancele quando quiser: não há multa. O plano continua ativo até o fim do período já pago e depois o workspace volta ao Trial.
              {!isCaktoApiConfigured() && " Você também pode cancelar pelo link do e-mail da Cakto."}
            </p>
            {isOwner && <CancelSubscriptionButton periodEnd={subscription.currentPeriodEnd} />}
          </div>
        ) : paidViaCakto ? (
          <p>Assinatura cancelada. Nenhuma nova cobrança será feita.</p>
        ) : workspace.plan !== "trial" ? (
          <p>Este plano é gerenciado diretamente pela equipe ScaleX. Para alterações, fale com a gente.</p>
        ) : (
          <p>O plano Trial não gera cobranças e não precisa ser cancelado.</p>
        )}
      </Card>
    </>
  );
}
