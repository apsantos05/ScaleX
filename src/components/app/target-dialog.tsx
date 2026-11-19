"use client";

import { CalendarClock, ExternalLink, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { Alert, Avatar, StatusBadge } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { FORMAT_LABEL, isCancellable, isReschedulable } from "@/lib/domain/status";
import type { ExecutionLog, TargetView } from "@/lib/domain/types";
import { cn, formatDateTime } from "@/lib/utils";
import { cancelTargetsAction, getTargetLogsAction, rescheduleTargetAction } from "@/app/app/_actions/publishing";

function toLocalInput(iso: string) {
  const d = new Date(Math.max(Date.parse(iso), Date.now() + 10 * 60_000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Detalhes de uma execução por conta: status, logs, cancelamento e reagendamento. */
export function TargetDialog({ target, canEdit, children }: { target: TargetView; canEdit: boolean; children: (open: () => void) => ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ExecutionLog[] | null>(null);
  const [when, setWhen] = useState(() => toLocalInput(target.scheduledAt));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getTargetLogsAction(target.id).then((r) => alive && setLogs(r.ok ? r.data : []));
    return () => {
      alive = false;
    };
  }, [open, target.id]);

  return (
    <>
      {children(() => setOpen(true))}
      <Dialog open={open} onOpenChange={setOpen} title="Detalhes da publicação" className="max-w-xl">
        <div className="grid gap-4 text-sm">
          <div className="flex items-center gap-3">
            <Avatar src={target.accountAvatarUrl} name={target.accountUsername} />
            <div className="flex-1">
              <p className="font-medium">@{target.accountUsername}</p>
              <p className="text-xs text-fg-subtle">{FORMAT_LABEL[target.format] ?? target.format} · agendado para {formatDateTime(target.scheduledAt)}</p>
            </div>
            <StatusBadge status={target.status} simulated={target.simulated} />
          </div>
          {target.caption && <p className="max-h-28 overflow-y-auto whitespace-pre-line rounded-lg bg-surface-2 p-3 text-xs text-fg-muted">{target.caption}</p>}
          {target.lastError && <Alert tone={target.status === "failed" ? "danger" : "warning"} title={target.status === "failed" ? "Falha" : "Último erro"}>{target.lastError}</Alert>}
          <dl className="grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-fg-subtle">Tentativas</dt><dd>{target.attempts}/{target.maxAttempts}</dd>
            <dt className="text-fg-subtle">Próxima tentativa</dt><dd>{formatDateTime(target.nextAttemptAt)}</dd>
            <dt className="text-fg-subtle">Publicado em</dt><dd>{formatDateTime(target.publishedAt)}</dd>
            <dt className="text-fg-subtle">ID na plataforma</dt><dd className="truncate font-mono">{target.providerMediaId ?? "—"}</dd>
          </dl>
          {target.permalink && (
            <a href={target.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
              Abrir no Instagram <ExternalLink className="size-3" />
            </a>
          )}

          <div>
            <p className="mb-2 text-xs font-medium text-fg-muted">Log de execução</p>
            <ol className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3 font-mono text-xs">
              {logs === null ? (
                <li className="text-fg-subtle">Carregando…</li>
              ) : logs.length === 0 ? (
                <li className="text-fg-subtle">Nenhum evento ainda. A execução começa quando o worker processar o item.</li>
              ) : (
                logs.map((l) => (
                  <li key={l.id} className={cn(l.level === "error" ? "text-danger" : l.level === "warn" ? "text-warning" : "text-fg-muted")}>
                    <span className="text-fg-subtle">{formatDateTime(l.at)}</span> {l.message}
                  </li>
                ))
              )}
            </ol>
          </div>

          {canEdit && (isReschedulable(target.status) || isCancellable(target.status)) && (
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end">
              {isReschedulable(target.status) && (
                <>
                  <Field label={target.status === "failed" ? "Tentar novamente em" : "Reagendar para"} htmlFor={`rs-${target.id}`} className="flex-1">
                    <Input id={`rs-${target.id}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                  </Field>
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={async () => {
                      setBusy(true);
                      const r = await rescheduleTargetAction(target.id, new Date(when).toISOString());
                      setBusy(false);
                      if (!r.ok) return toast.error(r.error);
                      toast.success("Reagendado.");
                      setOpen(false);
                      router.refresh();
                    }}
                  >
                    <CalendarClock /> Salvar
                  </Button>
                </>
              )}
              {isCancellable(target.status) && (
                <ConfirmButton
                  title="Cancelar esta publicação?"
                  description={`A publicação em @${target.accountUsername} não será executada. Outras contas do mesmo lote não são afetadas.`}
                  confirmLabel="Cancelar publicação"
                  onConfirm={async () => {
                    const r = await cancelTargetsAction([target.id]);
                    if (!r.ok) return void toast.error(r.error);
                    if (r.data.cancelled === 0) toast.error("Não foi possível cancelar: a execução já começou.");
                    else toast.success("Publicação cancelada.");
                    setOpen(false);
                    router.refresh();
                  }}
                  trigger={(o) => (
                    <Button variant="danger" onClick={o}>
                      <XCircle /> Cancelar
                    </Button>
                  )}
                />
              )}
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}
