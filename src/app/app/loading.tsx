/** Esqueleto exibido instantaneamente durante a navegação entre páginas do app. */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="animate-fade-in">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-surface-2/70" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[var(--radius-card)] border border-border/60 bg-surface" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="h-72 animate-pulse rounded-[var(--radius-card)] border border-border/60 bg-surface xl:col-span-2" />
        <div className="h-72 animate-pulse rounded-[var(--radius-card)] border border-border/60 bg-surface" />
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
