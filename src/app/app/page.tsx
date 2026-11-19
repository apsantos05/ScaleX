import { AlertTriangle, ArrowRight, CalendarClock, Plug, SquarePen, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { dayBuckets, dayKey, StackedBars, StatCard } from "@/components/app/charts";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { requireWorkspace } from "@/lib/auth/context";
import { isInstagramConfigured } from "@/lib/integrations/instagram";
import { formatDateTime, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { repo, workspace, user } = await requireWorkspace();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const [accounts, targets, campaigns] = await Promise.all([
    repo.listAccounts(workspace.id),
    repo.listTargets(workspace.id, { from: since }),
    repo.listCampaigns(workspace.id),
  ]);

  const active = accounts.filter((a) => a.status === "active");
  const reauth = accounts.filter((a) => a.status === "needs_reauth" || a.status === "error");
  const pending = targets.filter((t) => t.status === "scheduled" || t.status === "queued" || t.status === "processing");
  const published = targets.filter((t) => t.status === "published");
  const failed = targets.filter((t) => t.status === "failed");
  const failed24h = failed.filter((t) => Date.parse(t.updatedAt) > now.getTime() - 86_400_000);
  // Itens na fila há mais de 5 min indicam que o worker não está rodando.
  const stalled = targets.filter(
    (t) => (t.status === "queued" || t.status === "scheduled") && Date.parse(t.scheduledAt) < now.getTime() - 5 * 60_000 && t.attempts === 0,
  );

  const buckets = dayBuckets(14, now);
  const chart = buckets.map((b) => ({
    label: b.label,
    values: [
      { key: "published", value: published.filter((t) => t.publishedAt && dayKey(t.publishedAt) === b.key).length },
      { key: "failed", value: failed.filter((t) => dayKey(t.updatedAt) === b.key).length },
    ],
  }));

  const upcoming = pending
    .filter((t) => t.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .slice(0, 6);
  const recent = [...targets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);

  const byCampaign = campaigns
    .map((c) => ({ ...c, total: targets.filter((t) => t.campaignId === c.id).length, done: targets.filter((t) => t.campaignId === c.id && t.status === "published").length }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`Olá, ${user.name.split(" ")[0]}`}
        description={`Visão operacional de ${workspace.name} · últimos 30 dias`}
        actions={
          <Button asChild>
            <Link href="/app/studio">
              <SquarePen /> Nova publicação
            </Link>
          </Button>
        }
      />

      {(reauth.length > 0 || failed24h.length > 0 || stalled.length > 0 || !isInstagramConfigured()) && (
        <section aria-label="Alertas operacionais" className="mb-6 grid gap-2">
          {stalled.length > 0 && (
            <Alert tone="warning" title={`${stalled.length} publicação(ões) atrasada(s) na fila`}>
              O worker de publicação parece não estar em execução. Rode <code className="font-mono">npm run worker</code> ou
              configure o cron.
            </Alert>
          )}
          {reauth.length > 0 && (
            <Alert tone="warning" title={`${reauth.length} conta(s) precisam de atenção`}>
              <Link href="/app/accounts?status=needs_reauth" className="underline">Reconecte as contas</Link> para retomar as publicações.
            </Alert>
          )}
          {failed24h.length > 0 && (
            <Alert tone="danger" title={`${failed24h.length} falha(s) nas últimas 24h`}>
              <Link href="/app/history?status=failed" className="underline">Ver detalhes no histórico</Link>.
            </Alert>
          )}
          {!isInstagramConfigured() && (
            <Alert tone="info" title="Conexão com o Instagram em ativação">
              Enquanto a integração oficial é liberada, use as contas <strong>Demo</strong> para testar todo o fluxo — nada é publicado de verdade.
              {process.env.NODE_ENV === "development" && (
                <span className="mt-1 block font-mono text-[11px] text-fg-subtle">dev: defina INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET e TOKEN_ENCRYPTION_KEY</span>
              )}
            </Alert>
          )}
        </section>
      )}

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Contas conectadas" value={accounts.length} hint={`${reauth.length} precisam de atenção`} />
        <StatCard label="Contas disponíveis" value={active.length} hint="Aptas a publicar" />
        <StatCard label="Agendadas / na fila" value={pending.length} />
        <StatCard label="Publicadas" value={published.length} hint={published.some((t) => t.simulated) ? "Inclui simulações (demo)" : "Últimos 30 dias"} tone="success" />
        <StatCard label="Com erro" value={failed.length} tone="danger" className="col-span-2 md:col-span-1" />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Volume de publicações" description="Últimos 14 dias" />
          <div className="p-5">
            {published.length + failed.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Sem execuções ainda"
                description="Assim que o worker processar suas publicações, o volume diário aparece aqui."
                className="py-8"
              />
            ) : (
              <StackedBars
                data={chart}
                caption="Publicações por dia"
                series={[
                  { key: "published", label: "Publicadas" },
                  { key: "failed", label: "Falhas" },
                ]}
              />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Próximas publicações"
            action={
              <Link href="/app/calendar" className="text-xs text-fg-muted hover:text-fg">
                Calendário
              </Link>
            }
          />
          <div className="p-3">
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nada agendado" description="Crie uma publicação no Estúdio." className="py-8" />
            ) : (
              <ul className="divide-y divide-border/60">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-2 py-2.5">
                    <Avatar src={t.accountAvatarUrl} name={t.accountUsername} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">@{t.accountUsername}</p>
                      <p className="text-xs text-fg-subtle">{formatDateTime(t.scheduledAt)} · {t.format}</p>
                    </div>
                    <span className="text-xs text-fg-muted">{formatRelative(t.scheduledAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Histórico recente"
            action={
              <Link href="/app/history" className="text-xs text-fg-muted hover:text-fg">
                Ver tudo
              </Link>
            }
          />
          <div className="p-3">
            {recent.length === 0 ? (
              <EmptyState
                icon={accounts.length ? SquarePen : Plug}
                title={accounts.length ? "Nenhuma publicação ainda" : "Comece conectando uma conta"}
                description={accounts.length ? "Programe sua primeira publicação em lote." : "Conecte contas profissionais do Instagram para começar."}
                action={
                  <Button asChild size="sm">
                    <Link href={accounts.length ? "/app/studio" : "/app/accounts"}>
                      {accounts.length ? "Abrir Estúdio" : "Conectar conta"} <ArrowRight />
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-2 py-2.5">
                    <Avatar src={t.accountAvatarUrl} name={t.accountUsername} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        @{t.accountUsername} <span className="text-fg-subtle">· {t.format}</span>
                      </p>
                      <p className="truncate text-xs text-fg-subtle">{t.lastError ?? (t.caption || "Sem legenda")}</p>
                    </div>
                    <StatusBadge status={t.status} simulated={t.simulated} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Campanhas" description="Progresso no período" />
          <div className="space-y-4 p-5">
            {byCampaign.length === 0 ? (
              <p className="text-sm text-fg-muted">
                Nenhuma campanha. <Link href="/app/campaigns" className="text-fg underline">Criar campanha</Link>
              </p>
            ) : (
              byCampaign.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
                      {c.name}
                    </span>
                    <span className="tabular-nums text-fg-muted">
                      {c.done}/{c.total}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%`, background: c.color }} />
                  </div>
                </div>
              ))
            )}
          </div>
          {accounts.length > 0 && (
            <div className="border-t border-border px-5 py-3 text-xs text-fg-muted">
              <Users className="mr-1.5 inline size-3.5" aria-hidden />
              {active.length} de {accounts.length} contas aptas a publicar
              {reauth.length > 0 && (
                <span className="ml-2 text-warning">
                  <AlertTriangle className="mr-1 inline size-3.5" aria-hidden />
                  {reauth.length} com pendência
                </span>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
