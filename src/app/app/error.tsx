"use client";

import { RotateCcw, ServerCrash } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

/** Falha ao carregar uma página do app: mensagem clara + tentar novamente, sem expor detalhes internos. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card className="mx-auto mt-6 max-w-lg p-8 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-danger/30 bg-danger/10">
        <ServerCrash className="size-5 text-danger" aria-hidden />
      </div>
      <h1 className="text-lg font-semibold">Não foi possível carregar esta página</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Pode ser uma instabilidade momentânea de conexão com o servidor. Seus dados estão seguros.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-fg-subtle">Código: {error.digest}</p>}
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Button onClick={reset}>
          <RotateCcw /> Tentar novamente
        </Button>
        <Button asChild variant="secondary">
          <Link href="/app">Ir para o Dashboard</Link>
        </Button>
      </div>
    </Card>
  );
}
