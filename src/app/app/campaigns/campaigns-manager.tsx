"use client";

import { CalendarDays, Flag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Card, EmptyState } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import type { Campaign } from "@/lib/domain/types";
import { createCampaignAction, deleteCampaignAction } from "../_actions/publishing";

const COLORS = ["#FF3045", "#5AA8FF", "#2FD27F", "#F5B33F", "#B57BFF", "#FF7AC6"];
type Stats = { total: number; published: number; pending: number; failed: number; accounts: number };

export function CampaignsManager({ campaigns, stats, canEdit, canDelete }: { campaigns: Campaign[]; stats: Record<string, Stats>; canEdit: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]!);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {canEdit && (
        <Card className="h-fit p-5">
          <h2 className="mb-4 text-sm font-semibold">Nova campanha</h2>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await createCampaignAction({ name, color, description });
              setBusy(false);
              if (!r.ok) return toast.error(r.error);
              setName("");
              setDescription("");
              toast.success("Campanha criada.");
              router.refresh();
            }}
          >
            <Field label="Nome" htmlFor="c-name"><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} /></Field>
            <Field label="Descrição (opcional)" htmlFor="c-desc"><Input id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} /></Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Cor</legend>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button type="button" key={c} onClick={() => setColor(c)} aria-label={`Cor ${c}`} aria-pressed={color === c} className="size-7 rounded-full ring-offset-2 ring-offset-surface transition aria-pressed:ring-2 aria-pressed:ring-fg" style={{ background: c }} />
                ))}
              </div>
            </fieldset>
            <Button type="submit" loading={busy}>Criar campanha</Button>
          </form>
        </Card>
      )}
      <div className="grid content-start gap-3 sm:grid-cols-2">
        {campaigns.length === 0 && (
          <Card className="sm:col-span-2"><EmptyState icon={Flag} title="Nenhuma campanha" description="Crie campanhas e selecione-as no Estúdio ao programar publicações." /></Card>
        )}
        {campaigns.map((c) => {
          const s = stats[c.id] ?? { total: 0, published: 0, pending: 0, failed: 0, accounts: 0 };
          return (
            <Card key={c.id} className="p-5" style={{ borderTop: `3px solid ${c.color}` }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{c.name}</h3>
                  {c.description && <p className="mt-0.5 text-sm text-fg-muted">{c.description}</p>}
                </div>
                {canDelete && (
                  <ConfirmButton
                    title={`Excluir a campanha "${c.name}"?`}
                    description="As publicações vinculadas não serão apagadas; apenas deixarão de pertencer à campanha."
                    confirmLabel="Excluir"
                    onConfirm={async () => {
                      const r = await deleteCampaignAction(c.id);
                      if (!r.ok) return void toast.error(r.error);
                      router.refresh();
                    }}
                    trigger={(open) => <Button variant="ghost" size="icon-sm" onClick={open} aria-label={`Excluir ${c.name}`}><Trash2 /></Button>}
                  />
                )}
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[["Total", s.total], ["Publicadas", s.published], ["Pendentes", s.pending], ["Falhas", s.failed]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-surface-2 py-2">
                    <dd className="text-lg font-semibold tabular-nums">{v}</dd>
                    <dt className="text-[10px] text-fg-subtle">{k}</dt>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-center justify-between text-xs text-fg-muted">
                <span>{s.accounts} conta(s) envolvidas</span>
                <Link href={`/app/calendar?campaign=${c.id}`} className="inline-flex items-center gap-1 hover:text-fg"><CalendarDays className="size-3.5" /> Calendário</Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
