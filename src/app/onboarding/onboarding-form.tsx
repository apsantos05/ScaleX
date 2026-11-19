"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { createWorkspaceAction } from "../app/_actions/workspace";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [seedDemo, setSeedDemo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="mt-6 grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await createWorkspaceAction({ name, seedDemo });
        setBusy(false);
        if (!r.ok) return setError(r.error);
        router.push("/app");
        router.refresh();
      }}
    >
      <Field label="Nome do workspace" htmlFor="ws-name" hint="Ex.: nome da sua agência, operação ou cliente.">
        <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} autoFocus />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4 text-sm">
        <Checkbox checked={seedDemo} onChange={(e) => setSeedDemo(e.target.checked)} className="mt-0.5" />
        <span>
          <span className="font-medium">Adicionar contas de demonstração</span>
          <span className="mt-0.5 block text-fg-muted">
            Cria 6 contas fictícias marcadas como <em>Demo</em> para testar o fluxo completo. Publicações nelas são
            apenas simuladas.
          </span>
        </span>
      </label>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="lg" loading={busy}>
        Criar workspace
      </Button>
    </form>
  );
}
