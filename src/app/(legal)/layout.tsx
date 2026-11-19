import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, Logo } from "@/components/ui/primitives";
import { LEGAL, LEGAL_IS_DRAFT, LEGAL_PAGES } from "@/lib/legal";

/** Layout das páginas legais: públicas, sem login, legíveis no celular e prontas para impressão. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" aria-label="ScaleX — início">
            <Logo />
          </Link>
          <Link href="/login" className="text-sm text-fg-muted hover:text-fg">
            Entrar
          </Link>
        </div>
      </header>
      <main id="conteudo" className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        {LEGAL_IS_DRAFT && (
          <Alert tone="warning" className="mb-8" title="Rascunho">
            Dados da empresa ainda não preenchidos. Este documento não deve ser publicado nem enviado à Meta até ser concluído.
          </Alert>
        )}
        <article className="legal">{children}</article>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-5 py-8 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Documentos legais" className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_PAGES.map((p) => (
              <Link key={p.href} href={p.href} className="hover:text-fg">
                {p.label}
              </Link>
            ))}
          </nav>
          <p>
            {LEGAL.brand} · {LEGAL.company}
          </p>
        </div>
      </footer>
    </div>
  );
}
