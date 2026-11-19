import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock,
  Plug,
  Send,
  SquarePen,
  Users,
  UserCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { dayBuckets, dayKey, StackedBars, StatCard } from "@/components/app/charts";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { requireWorkspace } from "@/lib/auth/context";
import { FORMAT_LABEL } from "@/lib/domain/status";
import { isInstagramConfigured } from "@/lib/integrations/instagram";
import { cn, formatDateTime, formatRelative } from "@/lib/utils";

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
  // Itens na fila há mais de 5 min indicam que o worker não está rodando. (Regra inalterada.)
  const stalled = targets.filter(
    (t) => (t.status === "queued" || t.status === "scheduled") && Date.parse(t.scheduledAt) < now.getTime() - 5 * 60_000 && t.attempts === 0,
  );
  const integrationReady = isInstagramConfigured();
  const critical = stalled.length + reauth.length + failed24h.length;

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
  const next = upcoming[0];
  const recent = [...targets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);

  const byCampaign = campaigns
    .map((c) => ({ ...c, total: targets.filter((t) => t.campaignId === c.id).length, done: targets.filter((t) => t.campaignId === c.id && t.status === "published").length }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow={`Operação · ${workspace.name}`}
        title={`Olá, ${user.name.split(" ")[0]}`}
        description={
          critical > 0
            ? `${critical} ${critical === 1 ? "item exige" : "itens exigem"} sua atenção agora.`
            : next
              ? `Operação em dia. Próxima publicação ${formatRelative(next.scheduledAt)} em @${next.accountUsername}.`
              : "Operação em dia. Nenhuma publicação agendada no momento."
        }
        actions={
          <Button asChild size="lg" className="max-sm:hidden">
            <Link href="/app/studio">
              <SquarePen /> Nova publicação
            </Link>
          </Button>
        }
      />

      {/* 1 · O que exige atenção: alertas críticos sempre visíveis, em ordem de impacto. */}
      {critical > 0 && (
        <section aria-label="Alertas operacionais" className="mb-6 grid gap-2">
          {stalled.length > 0 && (
            <Alert tone="warning" title={`${stalled.length} publicação(ões) atrasada(s) na fila`}>
              O worker de publicação parece não estar em execução. Rode <code className="font-mono">npm run worker</code> ou configure o cron.
            </Alert>
          )}
          {failed24h.length > 0 && (
            <Alert tone="danger" title={`${failed24h.length} falha(s) nas últimas 24h`}>
              <Link href="/app/history?status=failed" className="font-medium text-fg underline underline-offset-2">
                Ver detalhes no histórico
              </Link>{" "}
              e reagende o que for possível.
            </Alert>
          )}
          {reauth.length > 0 && (
            <Alert tone="warning" title={`${reauth.length} conta(s) precisam de atenção`}>
              <Link href="/app/accounts?status=needs_reauth" className="font-medium text-fg underline underline-offset-2">
                Reconecte as contas
              </Link>{" "}
              para retomar as publicações.
            </Alert>
          )}
        </section>
      )}

      {/* 2 · Estado da operação: faixa compacta (informativo não compete com o crítico). */}
      <section aria-label="Estado da operação" className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--radius-card)] border border-border/80 bg-surface/60 px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-2">
          <span className={cn("size-2 rounded-full", stalled.length ? "bg-warning" : "bg-success")} aria-hidden />
          <span className="text-fg-muted">Fila</span>
          <span className="font-medium">{stalled.length ? "Atrasada" : "Em dia"}</span>
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={cn("size-2 rounded-full", reauth.length ? "bg-warning" : active.length ? "bg-success" : "bg-fg-subtle")} aria-hidden />
          <span className="text-fg-muted">Contas aptas</span>
          <span className="font-medium tabular-nums">
            {active.length}/{accounts.length}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className={cn("size-2 shrink-0 rounded-full", integrationReady ? "bg-success" : "bg-info")} aria-hidden />
          <span className="text-fg-muted">Instagram</span>
          {integrationReady ? (
            <span className="font-medium">Integração oficial ativa</span>
          ) : (
            <span className="min-w-0">
              <span className="font-medium">Em ativação</span>
              <span className="text-fg-subtle"> · use contas </span>
              <Badge tone="warning">Demo</Badge>
              <span className="text-fg-subtle"> para testar<span className="max-sm:hidden"> (nada é publicado)</span></span>
            </span>
          )}
        </span>
        {!integrationReady && process.env.NODE_ENV === "development" && (
          <span className="w-full font-mono text-xs text-fg-subtle">dev: defina INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET e TOKEN_ENCRYPTION_KEY</span>
        )}
      </section>

      {/* 3 · Indicadores: cada um leva à lista filtrada correspondente. */}
      <section aria-label="Indicadores dos últimos 30 dias" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Contas conectadas"
          value={accounts.length}
          icon={Users}
          href="/app/accounts"
          hint={reauth.length ? `${reauth.length} precisam de atenção` : "Todas sem pendência"}
        />
        <StatCard label="Contas disponíveis" value={active.length} icon={UserCheck} href="/app/accounts?status=active" hint="Aptas a publicar" />
        <StatCard label="Agendadas / na fila" value={pending.length} icon={Clock} href="/app/calendar" hint={next ? `Próxima ${formatRelative(next.scheduledAt)}` : "Nada pendente"} />
        <StatCard
          label="Publicadas"
          value={published.length}
          icon={CheckCircle2}
          tone="success"
          href="/app/history?status=published"
          hint={published.some((t) => t.simulated) ? "Inclui simulações (demo)" : "Últimos 30 dias"}
        />
        <StatCard
          label="Com erro"
          value={failed.length}
          icon={CircleAlert}
          tone="danger"
          href="/app/history?status=failed"
          hint={failed24h.length ? `${failed24h.length} nas últimas 24h` : "Últimos 30 dias"}
          className="col-span-2 md:col-span-1"
        />
      </section>

      {/* 4 · Próximas ações e o que acabou de acontecer. */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="flex flex-col">
          <CardHeader
            title="Próximas publicações"
            description={upcoming.length ? `${pending.length} pendente(s) no total` : undefined}
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/calendar">
                  Calendário <ArrowRight />
                </Link>
              </Button>
            }
          />
          <div className="flex-1 p-3">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="Nada agendado"
                description="Programe publicações em lote no Estúdio."
                className="py-8"
                action={
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/app/studio">
                      <Send /> Abrir Estúdio
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-2 py-2.5">
                    <Avatar src={t.accountAvatarUrl} name={t.accountUsername} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">@{t.accountUsername}</p>
                      <p className="truncate text-xs text-fg-subtle">
                        {formatDateTime(t.scheduledAt)} · {FORMAT_LABEL[t.format] ?? t.format}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-surface-2 px-2 py-1 text-xs tabular-nums text-fg-muted">{formatRelative(t.scheduledAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Atividade recente"
            description="Últimas execuções e mudanças de status"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/history">
                  Histórico <ArrowRight />
                </Link>
              </Button>
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
                    <Avatar src={t.accountAvatarUrl} name={t.accountUsername} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-medium">@{t.accountUsername}</span>{" "}
                        <span className="text-fg-subtle">· {FORMAT_LABEL[t.format] ?? t.format} · {formatRelative(t.updatedAt)}</span>
                      </p>
                      <p className={cn("truncate text-xs", t.lastError ? "text-danger/90" : "text-fg-subtle")}>{t.lastError ?? (t.caption || "Sem legenda")}</p>
                    </div>
                    <StatusBadge status={t.status} simulated={t.simulated} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* 5 · Tendência e campanhas. */}
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

        <Card className="flex flex-col">
          <CardHeader
            title="Campanhas"
            description="Progresso no período"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/campaigns">
                  Todas <ArrowRight />
                </Link>
              </Button>
            }
          />
          <div className="flex-1 space-y-4 p-5">
            {byCampaign.length === 0 ? (
              <p className="text-sm text-fg-muted">
                Nenhuma campanha.{" "}
                <Link href="/app/campaigns" className="font-medium text-fg underline underline-offset-2">
                  Criar campanha
                </Link>
              </p>
            ) : (
              byCampaign.map((c) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-fg-muted">
                      {c.done}/{c.total}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
                    role="meter"
                    aria-label={`Progresso de ${c.name}`}
                    aria-valuemin={0}
                    aria-valuemax={c.total}
                    aria-valuenow={c.done}
                  >
                    <div className="h-full rounded-full" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%`, background: c.color }} />
                  </div>
                </div>
              ))
            )}
          </div>
          {reauth.length > 0 && (
            <div className="border-t border-border px-5 py-3 text-xs text-warning">
              <AlertTriangle className="mr-1 inline size-3.5" aria-hidden />
              {reauth.length} conta(s) com pendência podem atrasar campanhas
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
