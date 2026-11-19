import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <main id="conteudo" className="relative grid min-h-dvh place-items-center px-4 text-center">
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
      <div className="relative">
        <Logo className="mb-10 justify-center text-lg" />
        <p className="font-mono text-6xl font-semibold text-brand">404</p>
        <h1 className="mt-4 text-xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-fg-muted">O endereço pode ter mudado ou não existir mais.</p>
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/app">Ir para o app</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Página inicial</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
