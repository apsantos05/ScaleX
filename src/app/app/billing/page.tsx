import { Check, Receipt } from "lucide-react";
import type { Metadata } from "next";
import { Meter } from "@/components/app/charts";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireWorkspace } from "@/lib/auth/context";
import { formatBytes } from "@/lib/domain/media-rules";
import { PLANS, planLimits } from "@/lib/domain/plans";

export const metadata: Metadata = { title: "Assinatura" };

export default async function BillingPage() {
  const { repo, workspace } = await requireWorkspace();
  const limits = planLimits(workspace.plan);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [accounts, monthly, storage, members] = await Promise.all([
    repo.listAccounts(workspace.id),
    repo.countTargetsCreatedSince(workspace.id, monthStart),
    repo.storageUsedBytes(workspace.id),
    repo.listMembers(workspace.id),
  ]);
  const usage = [
    { label: "Contas reais conectadas", value: accounts.filter((a) => !a.isDemo).length, max: limits.maxAccounts, fmt: (n: number) => String(n) },
    { label: "Publicações no mês", value: monthly, max: limits.maxScheduledPerMonth, fmt: (n: number) => n.toLocaleString("pt-BR") },
    { label: "Armazenamento", value: storage, max: limits.maxStorageMb * 1024 * 1024, fmt: formatBytes },
    { label: "Membros", value: members.length, max: limits.maxMembers, fmt: (n: number) => String(n) },
  ];

  return (
    <>
      <PageHeader title="Assinatura" description="Plano, limites e consumo do workspace." />
      <Alert tone="info" className="mb-6" title="Cobrança ainda não habilitada">
        Nenhuma cobrança real é processada. A integração com gateway de pagamento (ex.: Stripe ou Pagar.me) será ativada somente após
        configuração e aprovação. Até lá, upgrades são feitos manualmente pela equipe ScaleX.
      </Alert>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={`Plano ${limits.name}`} description={limits.priceBRL ? `R$ ${limits.priceBRL}/mês (referência)` : limits.priceBRL === 0 ? "Gratuito" : "Sob consulta"} action={<Badge tone="brand">Atual</Badge>} />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            {usage.map((u) => (
              <div key={u.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-fg-muted">{u.label}</span>
                  <span className="tabular-nums">{u.fmt(u.value)} / {u.fmt(u.max)}</span>
                </div>
                <Meter value={u.value} max={u.max} className="mt-2" />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Histórico de cobrança" />
          <EmptyState icon={Receipt} title="Nenhuma fatura" description="Faturas aparecerão aqui quando a cobrança for habilitada." className="py-10" />
        </Card>
      </div>

      <h2 className="mb-3 mt-10 text-sm font-semibold">Planos disponíveis</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.values(PLANS).map((p) => (
          <Card key={p.id} className={p.id === workspace.plan ? "border-brand/50" : undefined}>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                {p.id === workspace.plan && <Badge tone="brand">Seu plano</Badge>}
              </div>
              <p className="mt-2 text-2xl font-semibold">{p.priceBRL === null ? "Sob consulta" : p.priceBRL === 0 ? "Grátis" : `R$ ${p.priceBRL}`}</p>
              <ul className="mt-4 space-y-2 text-sm text-fg-muted">
                {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 text-brand" />{f}</li>)}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5 text-sm text-fg-muted">
        <h2 className="mb-1 font-semibold text-fg">Cancelamento</h2>
        O plano Trial não gera cobranças e não precisa ser cancelado. Quando a cobrança estiver ativa, o cancelamento poderá ser feito
        aqui e valerá até o fim do período pago.
      </Card>
    </>
  );
}
