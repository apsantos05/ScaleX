"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { toast } from "@/components/ui/toast";
import { updateWorkspaceAction } from "../_actions/workspace";

export function WorkspaceForm({ name, canEdit }: { name: string; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await updateWorkspaceAction({ name: value });
        setBusy(false);
        if (!r.ok) return toast.error(r.error);
        toast.success("Workspace atualizado.");
        router.refresh();
      }}
    >
      <Field label="Nome" htmlFor="ws-name" className="flex-1">
        <Input id="ws-name" value={value} onChange={(e) => setValue(e.target.value)} disabled={!canEdit} minLength={2} maxLength={60} required />
      </Field>
      {canEdit && <Button type="submit" variant="secondary" loading={busy} disabled={value === name}>Salvar</Button>}
    </form>
  );
}
