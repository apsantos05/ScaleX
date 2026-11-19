import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireWorkspace, roleAtLeast } from "@/lib/auth/context";
import { ALL_STATUSES, STATUS_LABEL } from "@/lib/domain/status";
import type { TargetStatus, TargetView } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { CalendarFilters } from "./filters";
import { TargetChip } from "./target-chip";

export const metadata: Metadata = { title: "Calendário" };

type View = "month" | "week" | "day";
const TZ = "America/Sao_Paulo";
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Datas manipuladas em "dias civis" no fuso de São Paulo (UTC-3, sem horário de verão desde 2019). */
const OFFSET_MS = 3 * 3600_000;
function civil(date: Date) {
  const d = new Date(date.getTime() - OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() };
}
function fromCivil(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d) + OFFSET_MS);
}
function keyOf(date: Date) {
  const c = civil(date);
  return `${c.y}-${String(c.m + 1).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: PageProps<"/app/calendar">) {
  const { repo, workspace, role } = await requireWorkspace();
  const sp = await searchParams;
  const view: View = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const base = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? fromCivil(+sp.date.slice(0, 4), +sp.date.slice(5, 7) - 1, +sp.date.slice(8, 10)) : new Date();
  const c = civil(base);

  let start: Date;
  let days: number;
  if (view === "month") {
    const first = fromCivil(c.y, c.m, 1);
    start = fromCivil(c.y, c.m, 1 - civil(first).wd);
    days = 42;
  } else if (view === "week") {
    start = fromCivil(c.y, c.m, c.d - c.wd);
    days = 7;
  } else {
    start = fromCivil(c.y, c.m, c.d);
    days = 1;
  }
  const end = new Date(start.getTime() + days * 86_400_000);

  const accountId = typeof sp.account === "string" ? sp.account : "";
  const campaignId = typeof sp.campaign === "string" ? sp.campaign : "";
  const status = typeof sp.status === "string" && (ALL_STATUSES as string[]).includes(sp.status) ? (sp.status as TargetStatus) : "";

  const [targets, accounts, campaigns] = await Promise.all([
    repo.listTargets(workspace.id, {
      from: start.toISOString(),
      to: end.toISOString(),
      accountIds: accountId ? [accountId] : undefined,
      campaignId: campaignId || undefined,
      statuses: status ? [status] : undefined,
    }),
    repo.listAccounts(workspace.id),
    repo.listCampaigns(workspace.id),
  ]);
  const colorOf = Object.fromEntries(campaigns.map((x) => [x.id, x.color]));
  const byDay = new Map<string, TargetView[]>();
  for (const t of [...targets].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))) {
    const k = keyOf(new Date(t.scheduledAt));
    byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }

  const shift = view === "month" ? fromCivil(c.y, c.m + 1, 1) : new Date(base.getTime() + (view === "week" ? 7 : 1) * 86_400_000);
  const back = view === "month" ? fromCivil(c.y, c.m - 1, 1) : new Date(base.getTime() - (view === "week" ? 7 : 1) * 86_400_000);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ view, date: keyOf(base), ...(accountId && { account: accountId }), ...(campaignId && { campaign: campaignId }), ...(status && { status }), ...patch });
    return `/app/calendar?${p.toString()}`;
  };
  const title =
    view === "month"
      ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: TZ }).format(base)
      : view === "week"
        ? `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: TZ }).format(start)} – ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }).format(new Date(end.getTime() - 1))}`
        : new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: TZ }).format(base);
  const todayKey = keyOf(new Date());
  const canEdit = roleAtLeast(role, "editor");
  const dayList = Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86_400_000));

  return (
    <>
      <PageHeader title="Calendário editorial" description={`${targets.length} publicação(ões) no período · horário de Brasília`} />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center">
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="icon-sm" aria-label="Período anterior"><Link href={qs({ date: keyOf(back) })}><ChevronLeft /></Link></Button>
            <Button asChild variant="secondary" size="sm"><Link href={qs({ date: todayKey })}>Hoje</Link></Button>
            <Button asChild variant="secondary" size="icon-sm" aria-label="Próximo período"><Link href={qs({ date: keyOf(shift) })}><ChevronRight /></Link></Button>
            <h2 className="ml-2 text-sm font-semibold first-letter:uppercase">{title}</h2>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
            <CalendarFilters accounts={accounts.map((a) => ({ id: a.id, label: `@${a.username}` }))} campaigns={campaigns.map((x) => ({ id: x.id, label: x.name }))} statuses={ALL_STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s] }))} />
            <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5" role="group" aria-label="Visualização">
              {(["day", "week", "month"] as const).map((v) => (
                <Link key={v} href={qs({ view: v })} aria-current={view === v ? "page" : undefined} className={cn("rounded-md px-3 py-1 text-xs", view === v ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>
                  {v === "day" ? "Dia" : v === "week" ? "Semana" : "Mês"}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {view === "month" ? (
          <div>
            <div className="grid grid-cols-7 border-b border-border text-center text-[11px] text-fg-subtle">
              {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {dayList.map((d) => {
                const k = keyOf(d);
                const items = byDay.get(k) ?? [];
                const inMonth = civil(d).m === c.m;
                return (
                  <div key={k} className={cn("min-h-14 border-b border-r border-border/60 p-1 md:min-h-28 md:p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-bg/40")}>
                    <Link href={qs({ view: "day", date: k })} className={cn("mb-1 inline-grid size-6 place-items-center rounded-md text-xs", k === todayKey ? "bg-brand font-semibold text-white" : inMonth ? "text-fg-muted hover:bg-surface-2" : "text-fg-subtle")}>
                      {civil(d).d}
                    </Link>
                    {items.length > 0 && (
                      <Link href={qs({ view: "day", date: k })} className="flex items-center gap-1 px-1 md:hidden" aria-label={items.length + " publicação(ões)"}>
                        <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                        <span className="text-[10px] tabular-nums text-fg-muted">{items.length}</span>
                      </Link>
                    )}
                    <ul className="hidden space-y-1 md:block">
                      {items.slice(0, 3).map((t) => <li key={t.id}><TargetChip target={t} color={t.campaignId ? colorOf[t.campaignId] : undefined} canEdit={canEdit} compact /></li>)}
                      {items.length > 3 && <li><Link href={qs({ view: "day", date: k })} className="px-1 text-[11px] text-fg-muted hover:text-fg">+{items.length - 3} mais</Link></li>}
                    </ul>
                  </div>
                );
              })}
            </div>
            <section aria-label="Agenda do mês" className="border-t border-border md:hidden">
              {targets.length === 0 ? (
                <p className="p-6 text-center text-sm text-fg-muted">Sem publicações neste período.</p>
              ) : (
                Array.from(byDay.entries()).map(([k, items]) => (
                  <div key={k} className="border-b border-border/60 px-4 py-3 last:border-0">
                    <h3 className={cn("mb-2 text-xs font-medium", k === todayKey ? "text-brand" : "text-fg-muted")}>
                      {new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: TZ }).format(fromCivil(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)))}
                    </h3>
                    <ul className="space-y-1.5">
                      {items.map((t) => <li key={t.id}><TargetChip target={t} color={t.campaignId ? colorOf[t.campaignId] : undefined} canEdit={canEdit} /></li>)}
                    </ul>
                  </div>
                ))
              )}
            </section>
          </div>
        ) : (
          <div className={cn("grid", view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-1")}>
            {dayList.map((d) => {
              const k = keyOf(d);
              const items = byDay.get(k) ?? [];
              return (
                <section key={k} className="min-h-64 border-b border-border/60 p-3 md:border-r md:last:border-r-0" aria-label={k}>
                  <h3 className={cn("mb-3 text-xs font-medium", k === todayKey ? "text-brand" : "text-fg-muted")}>
                    {new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: TZ }).format(d)}
                  </h3>
                  {items.length === 0 ? <p className="text-xs text-fg-subtle">Sem publicações</p> : (
                    <ul className="space-y-1.5">
                      {items.map((t) => <li key={t.id}><TargetChip target={t} color={t.campaignId ? colorOf[t.campaignId] : undefined} canEdit={canEdit} /></li>)}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
