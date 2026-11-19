import { Skeleton } from "@/components/ui/primitives";

/**
 * Esqueleto neutro exibido instantaneamente durante a navegação entre páginas do app.
 * Formato genérico (cabeçalho + barra de filtros + lista) para não "saltar" de layout
 * em páginas que não são o dashboard.
 */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="animate-fade-in">
      <div className="mb-6 space-y-2.5 lg:mb-8">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="rounded-[var(--radius-card)] border border-border/70 bg-surface">
        <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-64" />
        </div>
        <ul className="divide-y divide-border/60">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3.5">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40 max-w-full" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-5 w-16" />
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
