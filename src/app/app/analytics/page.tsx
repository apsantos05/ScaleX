import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { dayBuckets, dayKey, StackedBars, StatCard } from "@/components/app/charts";
import { Alert, Avatar, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireWorkspace } from "@/lib/auth/context";
import type { TargetView } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Analytics" };

const PERIODS = [7, 30, 90] as const;

function summarize(list: TargetView[]) {
  const published = list.filter((t) => t.status === "published").length;
  const failed = list.filter((t) => t.status === "failed").length;
  return { published, failed, rate: published + failed ? Math.round((published / (published + failed)) * 100) : null };
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-xs text-fg-subtle">sem base anterior</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center text-xs", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />} {Math.abs(pct)}% vs. período anterior
    </span>
  );
}

const UNAVAILABLE = ["Alcance", "Visualizações", "Curtidas", "Comentários", "Salvamentos", "Compartilhamentos"];

export default async function AnalyticsPage({ searchParams }: PageProps<"/app/analytics">) {
  const { repo, workspace } = await requireWorkspace();
  const sp = await searchParams;
  const days = PERIODS.find((p) => String(p) === sp.period) ?? 30;
  const now = new Date().getTime();
  const from = new Date(now - days * 86_400_000).toISOString();
  const prevFrom = new Date(now - 2 * days * 86_400_000).toISOString();
  const [all, campaigns] = await Promise.all([repo.listTargets(workspace.id, { from: prevFrom }), repo.listCampaigns(workspace.id)]);
  const current = all.filter((t) => t.scheduledAt >= from && t.scheduledAt <= new Date(now).toISOString());
  const previous = all.filter((t) => t.scheduledAt < from);
  const cur = summarize(current);
  const prev = summarize(previous);
  const simulated = current.filter((t) => t.simulated && t.status === "published").length;

  const buckets = dayBuckets(Math.min(days, 30));
  const chart = buckets.map((b) => ({
    label: b.label,
    values: [
      { key: "published", value: current.filter((t) => t.status === "published" && t.publishedAt && dayKey(t.publishedAt) === b.key).length },
      { key: "failed", value: current.filter((t) => t.status === "failed" && dayKey(t.updatedAt) === b.key).length },
    ],
  }));

  const byAccount = Object.values(
    current.reduce<Record<string, { name: string; avatar: string | null; published: number; failed: number; total: number }>>((acc, t) => {
      const r = (acc[t.socialAccountId] ??= { name: t.accountUsername, avatar: t.accountAvatarUrl, published: 0, failed: 0, total: 0 });
      r.total++;
      if (t.status === "published") r.published++;
      if (t.status === "failed") r.failed++;
      return acc;
    }, {}),
  ).sort((a, b) => b.published - a.published);

  const byCampaign = campaigns.map((c) => ({ ...c, ...summarize(current.filter((t) => t.campaignId === c.id)) }));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Métricas operacionais calculadas a partir das execuções registradas."
        actions={
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <Link key={p} href={`/app/analytics?period=${p}`} aria-current={p === days ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-xs", p === days ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>
                {p} dias
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <StatCard label="Publicações realizadas" value={cur.published} hint={simulated ? `${simulated} simulada(s) em contas demo` : undefined} />
          <div className="mt-1.5 px-1"><Delta now={cur.published} before={prev.published} /></div>
        </div>
        <StatCard label="Falhas" value={cur.failed} tone="danger" />
        <StatCard label="Taxa de sucesso" value={cur.rate === null ? "—" : `${cur.rate}%`} />
        <StatCard label="Contas ativas no período" value={byAccount.length} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Execuções por dia" description={`Últimos ${Math.min(days, 30)} dias`} />
        <div className="p-5">
          <StackedBars data={chart} caption="Execuções por dia" series={[{ key: "published", label: "Publicadas" }, { key: "failed", label: "Falhas" }]} />
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Métricas de desempenho (Instagram Insights)" description="Alcance, visualizações e engajamento por publicação" />
        <div className="p-5">
          <Alert tone="info" title="Ainda não disponível nesta versão">
            A coleta de insights via API oficial (escopo <code className="font-mono">instagram_business_manage_insights</code>) está
            implementada no adapter, mas o job de sincronização periódica ainda não foi ativado. Contas demo nunca terão métricas —
            a ScaleX não exibe números estimados ou fictícios. Observação: desde a Graph API v22 a métrica &quot;impressões&quot; foi
            substituída por &quot;visualizações&quot;.
          </Alert>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {UNAVAILABLE.map((m) => (
              <li key={m} className="rounded-lg border border-dashed border-border p-3">
                <p className="text-xs text-fg-subtle">{m}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-fg-muted"><Info className="size-3.5" /> Indisponível</p>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Desempenho por conta" />
          <div className="overflow-x-auto p-2">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-fg-subtle"><tr><th className="p-2 font-medium">Conta</th><th className="p-2 font-medium">Publicadas</th><th className="p-2 font-medium">Falhas</th><th className="p-2 font-medium">Total</th></tr></thead>
              <tbody>
                {byAccount.length === 0 && <tr><td colSpan={4} className="p-4 text-fg-muted">Sem dados no período.</td></tr>}
                {byAccount.map((a) => (
                  <tr key={a.name} className="border-t border-border/50">
                    <td className="p-2"><span className="flex items-center gap-2"><Avatar src={a.avatar} name={a.name} size={22} />@{a.name}</span></td>
                    <td className="p-2 tabular-nums">{a.published}</td>
                    <td className="p-2 tabular-nums text-fg-muted">{a.failed}</td>
                    <td className="p-2 tabular-nums text-fg-muted">{a.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Desempenho por campanha" />
          <div className="overflow-x-auto p-2">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-fg-subtle"><tr><th className="p-2 font-medium">Campanha</th><th className="p-2 font-medium">Publicadas</th><th className="p-2 font-medium">Falhas</th><th className="p-2 font-medium">Sucesso</th></tr></thead>
              <tbody>
                {byCampaign.length === 0 && <tr><td colSpan={4} className="p-4 text-fg-muted">Nenhuma campanha.</td></tr>}
                {byCampaign.map((c) => (
                  <tr key={c.id} className="border-t border-border/50">
                    <td className="p-2"><span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: c.color }} />{c.name}</span></td>
                    <td className="p-2 tabular-nums">{c.published}</td>
                    <td className="p-2 tabular-nums text-fg-muted">{c.failed}</td>
                    <td className="p-2 tabular-nums text-fg-muted">{c.rate === null ? "—" : `${c.rate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
