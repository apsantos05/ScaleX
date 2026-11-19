import { cn } from "@/lib/utils";

export type BarDatum = { label: string; values: { key: string; value: number }[] };

const SERIES_COLOR: Record<string, string> = {
  published: "var(--brand)",
  failed: "var(--fg-subtle)",
  scheduled: "var(--info)",
};

/** Gráfico de barras empilhadas acessível (tabela oculta para leitores de tela). */
export function StackedBars({
  data,
  series,
  height = 180,
  caption,
}: {
  data: BarDatum[];
  series: { key: string; label: string }[];
  height?: number;
  caption: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.values.reduce((s, v) => s + v.value, 0)));
  return (
    <figure>
      <div className="flex items-end gap-1.5" style={{ height }} aria-hidden>
        {data.map((d) => {
          const total = d.values.reduce((s, v) => s + v.value, 0);
          return (
            <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
              <div className="flex flex-col-reverse overflow-hidden rounded-t-[3px]" style={{ height: `${(total / max) * 100}%` }}>
                {d.values.map((v) => (
                  <div key={v.key} style={{ flexGrow: v.value, background: SERIES_COLOR[v.key] ?? "var(--fg-muted)" }} />
                ))}
              </div>
              {total === 0 && <div className="h-px bg-border" />}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-3 px-2 py-1 text-[11px] group-hover:block">
                <p className="font-medium">{d.label}</p>
                {d.values.map((v) => (
                  <p key={v.key} className="text-fg-muted">
                    {series.find((s) => s.key === v.key)?.label}: {v.value}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-fg-subtle" aria-hidden>
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-fg-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: SERIES_COLOR[s.key] }} aria-hidden />
            {s.label}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th>Período</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              {series.map((s) => (
                <td key={s.key}>{d.values.find((v) => v.key === s.key)?.value ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = Math.min(100, (value / Math.max(1, max)) * 100);
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-surface-3", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className={cn("h-full rounded-full", pct > 90 ? "bg-danger" : pct > 70 ? "bg-warning" : "bg-brand")} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "danger" | "success";
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border/70 bg-surface p-4">
      <p className="text-xs text-fg-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "danger" && Number(value) > 0 && "text-danger",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

export function dayBuckets(days: number, now = new Date()): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
    out.push({ key, label });
  }
  return out;
}

export function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
