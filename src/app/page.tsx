import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  FolderOpen,
  Layers,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge, Logo } from "@/components/ui/primitives";
import { PLANS } from "@/lib/domain/plans";
import { LEGAL_PAGES } from "@/lib/legal";

const FEATURES = [
  {
    icon: Users,
    title: "Multicontas sem caos",
    text: "Conecte dezenas de contas profissionais via OAuth oficial e organize por grupos e etiquetas.",
  },
  {
    icon: Layers,
    title: "Publicação em lote",
    text: "Um conteúdo, várias contas. Resultado individual por conta, sem duplicidade em falhas de rede.",
  },
  {
    icon: CalendarClock,
    title: "Calendário editorial",
    text: "Visões diária, semanal e mensal com filtros por conta, campanha e status.",
  },
  {
    icon: Workflow,
    title: "Motor de automação",
    text: "Fila com retentativas inteligentes, controle de concorrência e respeito aos limites oficiais.",
  },
  {
    icon: FolderOpen,
    title: "Biblioteca privada",
    text: "Imagens e vídeos em armazenamento privado, com pastas, etiquetas e validação por formato.",
  },
  {
    icon: BarChart3,
    title: "Métricas reais",
    text: "Alcance, visualizações e engajamento conforme disponibilidade da API — sem números inventados.",
  },
];

const STEPS = [
  { n: "01", title: "Conecte", text: "Autorize suas contas profissionais pelo login oficial do Instagram." },
  { n: "02", title: "Prepare", text: "Suba o conteúdo, escreva a legenda e escolha as contas e o formato." },
  { n: "03", title: "Escale", text: "Agende em lote e acompanhe cada execução em tempo real." },
];

const FAQ = [
  {
    q: "Quais contas posso conectar?",
    a: "Contas profissionais do Instagram (Empresa ou Criador de conteúdo). Contas pessoais não são suportadas pela API oficial da Meta.",
  },
  {
    q: "A ScaleX pede minha senha do Instagram?",
    a: "Nunca. A conexão é feita pelo OAuth oficial da Meta: você autoriza no próprio Instagram e pode revogar a qualquer momento.",
  },
  {
    q: "Existe limite de publicações?",
    a: "Sim. A Meta limita publicações via API por conta a cada 24h. A ScaleX respeita esse limite e aplica uma margem de segurança configurável.",
  },
  {
    q: "Que tipo de conteúdo posso publicar?",
    a: "Apenas conteúdo permitido pelas Diretrizes da Comunidade e Termos do Instagram, com direitos de uso confirmados por você.",
  },
];

function ProductPreview() {
  const bars = [38, 52, 44, 70, 62, 88, 76, 94, 81, 99, 90, 110];
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div className="absolute -inset-x-10 -top-10 h-64 rounded-full bg-brand/20 blur-[100px]" aria-hidden />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-2xl backdrop-blur" aria-hidden>
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="ml-3 text-xs text-fg-subtle">app.scalex / dashboard</span>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-[180px_1fr]">
          <div className="hidden space-y-1.5 md:block">
            {["Dashboard", "Contas", "Biblioteca", "Estúdio", "Calendário", "Analytics"].map((l, i) => (
              <div key={l} className={`rounded-md px-3 py-2 text-xs ${i === 0 ? "bg-surface-2 text-fg" : "text-fg-subtle"}`}>
                {l}
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Contas ativas", "48"],
                ["Agendadas", "312"],
                ["Publicadas (7d)", "1.204"],
                ["Com erro", "3"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border bg-surface-2 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-fg-subtle">{k}</p>
                  <p className="mt-1 text-xl font-semibold">{v}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex h-36 items-end gap-2">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-to-t from-brand/30 to-brand"
                    style={{ height: `${(h / 110) * 100}%`, opacity: 0.45 + (i / bars.length) * 0.55 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-fg-subtle">Ilustração da interface com dados fictícios.</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label="Principal">
          <Link href="/" aria-label="ScaleX — início">
            <Logo />
          </Link>
          <div className="hidden items-center gap-7 text-sm text-fg-muted md:flex">
            <a href="#recursos" className="hover:text-fg">Recursos</a>
            <a href="#como-funciona" className="hover:text-fg">Como funciona</a>
            <a href="#seguranca" className="hover:text-fg">Segurança</a>
            <a href="#planos" className="hover:text-fg">Planos</a>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Começar agora</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main id="conteudo">
        <section className="relative bg-grid">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/60 to-bg" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-20 text-center sm:pt-28">
            <Badge tone="brand" className="mb-6 px-2.5 py-1 text-xs">
              <Zap className="size-3" /> Operações orgânicas em escala
            </Badge>
            <h1 className="mx-auto max-w-4xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              A central de comando para quem opera <span className="text-brand">dezenas de contas</span>.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-fg-muted text-balance sm:text-lg">
              Conecte contas profissionais do Instagram, organize sua biblioteca e programe publicações em lote —
              com integrações oficiais, fila confiável e visibilidade total de cada execução.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="glow-brand">
                <Link href="/signup">
                  Criar conta gratuita <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-fg-subtle">Sem cartão de crédito. Teste completo em modo demonstração.</p>
            <ProductPreview />
          </div>
        </section>

        <section id="recursos" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-brand">Recursos</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Feito para operação de alto volume.</h2>
            <p className="mt-3 text-fg-muted">Cada recurso pensado para quem gerencia muitas contas sem perder controle.</p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="group bg-surface p-7 transition-colors hover:bg-surface-2">
                <div className="grid size-10 place-items-center rounded-lg border border-border bg-bg text-brand transition-transform group-hover:-translate-y-0.5">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 border-y border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <h2 className="text-3xl font-semibold tracking-tight">Três passos. Escala infinita.</h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="relative rounded-2xl border border-border bg-bg p-7">
                  <span className="font-mono text-sm text-brand">{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-fg-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="seguranca" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-brand">Segurança e conformidade</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Escala sem atalhos arriscados.</h2>
              <p className="mt-4 text-fg-muted">
                A ScaleX usa exclusivamente as APIs oficiais da Meta e as permissões que você concede. Nada de
                automação de login, proxies ou simulação de comportamento humano — o que protege suas contas a longo prazo.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, t: "OAuth oficial", d: "Sem senhas do Instagram armazenadas." },
                { icon: LockKeyhole, t: "Tokens criptografados", d: "AES-256-GCM, acessíveis só no servidor." },
                { icon: Users, t: "Isolamento por workspace", d: "Row Level Security em todas as tabelas." },
                { icon: RefreshCcw, t: "Execução idempotente", d: "Sem posts duplicados em falhas de rede." },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="rounded-xl border border-border bg-surface p-5">
                  <Icon className="size-5 text-brand" aria-hidden />
                  <p className="mt-3 text-sm font-semibold">{t}</p>
                  <p className="mt-1 text-sm text-fg-muted">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="planos" className="scroll-mt-20 border-t border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-5 py-24">
            <h2 className="text-3xl font-semibold tracking-tight">Planos que acompanham sua operação.</h2>
            <p className="mt-3 text-fg-muted">Valores de referência. Cobrança ainda não habilitada — comece pelo trial.</p>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Object.values(PLANS).map((p) => (
                <div
                  key={p.id}
                  className={`flex flex-col rounded-2xl border p-6 ${p.id === "pro" ? "border-brand/50 bg-surface glow-brand" : "border-border bg-bg"}`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.id === "pro" && <Badge tone="brand">Popular</Badge>}
                  </div>
                  <p className="mt-4 text-3xl font-semibold">
                    {p.priceBRL === null ? "Sob consulta" : p.priceBRL === 0 ? "Grátis" : `R$ ${p.priceBRL}`}
                    {p.priceBRL ? <span className="text-sm font-normal text-fg-muted">/mês</span> : null}
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm text-fg-muted">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant={p.id === "pro" ? "primary" : "secondary"} className="mt-6">
                    <Link href="/signup">Começar</Link>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-24">
          <h2 className="text-3xl font-semibold tracking-tight">Perguntas frequentes</h2>
          <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.q}
                  <span className="text-fg-subtle transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm text-fg-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-5 pb-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-border bg-surface px-8 py-16 text-center">
            <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
            <div className="absolute left-1/2 top-0 h-40 w-2/3 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" aria-hidden />
            <div className="relative">
              <h2 className="text-3xl font-semibold tracking-tight text-balance">Pronto para operar em outro nível?</h2>
              <p className="mx-auto mt-3 max-w-lg text-fg-muted">Crie seu workspace e explore tudo em modo demonstração.</p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/signup">
                  Criar conta <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-fg-subtle sm:flex-row">
          <Logo className="text-fg-muted" />
          <nav aria-label="Documentos legais" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {LEGAL_PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="hover:text-fg">
                {p.label}
              </Link>
            ))}
          </nav>
          <p>© {new Date().getFullYear()} ScaleX. Não afiliada à Meta Platforms, Inc.</p>
        </div>
      </footer>
    </div>
  );
}
