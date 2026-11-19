"use client";

import { History, Search, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TargetDialog } from "@/components/app/target-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/dialog";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { Avatar, Card, CardHeader, EmptyState, StatusBadge } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ALL_STATUSES, AUDIT_LABEL, FORMAT_LABEL, isCancellable, STATUS_LABEL } from "@/lib/domain/status";
import type { AuditEntry, TargetView } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/utils";
import { cancelTargetsAction } from "../_actions/publishing";

const PAGE = 50;

export function HistoryTable({
  targets,
  accounts,
  initialStatus,
  canEdit,
  audit,
}: {
  targets: TargetView[];
  accounts: { id: string; username: string }[];
  initialStatus: string;
  canEdit: boolean;
  audit: AuditEntry[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [account, setAccount] = useState("");
  const [format, setFormat] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return targets.filter(
      (t) =>
        (!status || t.status === status) &&
        (!account || t.socialAccountId === account) &&
        (!format || t.format === format) &&
        (!s || t.caption.toLowerCase().includes(s) || t.accountUsername.toLowerCase().includes(s) || (t.lastError ?? "").toLowerCase().includes(s)),
    );
  }, [targets, q, status, account, format]);
  const rows = filtered.slice(page * PAGE, (page + 1) * PAGE);
  const cancellable = Array.from(selected).filter((id) => {
    const t = targets.find((x) => x.id === id);
    return t && isCancellable(t.status);
  });

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <div className="grid grid-cols-3 gap-2 border-b border-border p-4 md:grid-cols-[1fr_repeat(3,170px)]">
          <div className="relative col-span-3 md:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
            <Input className="pl-9" placeholder="Buscar legenda, conta ou erro" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Buscar" />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Status">
            <option value="">Status</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
          <Select value={account} onChange={(e) => { setAccount(e.target.value); setPage(0); }} aria-label="Conta">
            <option value="">Conta</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}
          </Select>
          <Select value={format} onChange={(e) => { setFormat(e.target.value); setPage(0); }} aria-label="Formato">
            <option value="">Formato</option>
            {["FEED", "REELS", "STORIES", "CAROUSEL"].map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
          </Select>
        </div>

        {canEdit && selected.size > 0 && (
          <div className="z-20 flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/95 px-4 py-2.5 text-sm backdrop-blur animate-fade-in max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:border-t max-md:shadow-[0_-12px_30px_-12px_rgb(0_0_0/0.8)] md:sticky md:top-0 md:bg-brand/[0.06]" role="region" aria-label="Ações em lote">
            <span className="font-medium">{selected.size} selecionado(s)</span>
            <span className="text-fg-muted">· {cancellable.length} podem ser cancelados</span>
            <ConfirmButton
              title={`Cancelar ${cancellable.length} publicação(ões)?`}
              description="Somente itens ainda não iniciados serão cancelados. Itens em processamento ou concluídos não são afetados."
              confirmLabel="Cancelar selecionados"
              onConfirm={async () => {
                const r = await cancelTargetsAction(cancellable);
                if (!r.ok) return void toast.error(r.error);
                toast.success(`${r.data.cancelled} cancelado(s)${r.data.skipped ? `, ${r.data.skipped} já haviam iniciado` : ""}.`);
                setSelected(new Set());
                router.refresh();
              }}
              trigger={(open) => (
                <Button size="sm" variant="danger" onClick={open} disabled={!cancellable.length} className="ml-auto">
                  <XCircle /> Cancelar selecionados
                </Button>
              )}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState icon={History} title="Nada por aqui" description="Nenhuma execução corresponde aos filtros." />
        ) : (
          <>
          <ul className="divide-y divide-border/60 md:hidden">
            {rows.map((t) => (
              <TargetDialog key={t.id} target={t} canEdit={canEdit}>
                {(open) => (
                  <li className="flex items-start gap-3 px-4 py-3">
                    {canEdit && (
                      <label className="-my-1 -ml-2 grid size-11 shrink-0 cursor-pointer place-items-center">
                        <Checkbox
                          checked={selected.has(t.id)}
                          aria-label={`Selecionar publicação em @${t.accountUsername}`}
                          onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
                        />
                      </label>
                    )}
                    <button type="button" onClick={open} className="flex min-w-0 flex-1 items-start gap-3 text-left" aria-label={`Abrir detalhes da publicação em @${t.accountUsername}`}>
                      <Avatar src={t.accountAvatarUrl} name={t.accountUsername} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">@{t.accountUsername}</span>
                          <StatusBadge status={t.status} simulated={t.simulated} />
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-fg-muted">{t.caption || "Sem legenda"}</span>
                        {t.lastError && <span className="block truncate text-xs text-danger">{t.lastError}</span>}
                        <span className="mt-1 block text-xs text-fg-subtle">{FORMAT_LABEL[t.format] ?? t.format} · {formatDateTime(t.scheduledAt)} · {t.attempts}/{t.maxAttempts} tentativas</span>
                      </span>
                    </button>
                  </li>
                )}
              </TargetDialog>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs text-fg-subtle">
                <tr className="border-b border-border">
                  {canEdit && <th className="w-10 px-4 py-2.5"><span className="sr-only">Selecionar</span></th>}
                  <th className="px-4 py-2.5 font-medium">Conta</th>
                  <th className="py-2.5 font-medium">Formato</th>
                  <th className="py-2.5 font-medium">Legenda</th>
                  <th className="py-2.5 font-medium">Agendado</th>
                  <th className="py-2.5 font-medium">Tentativas</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <TargetDialog key={t.id} target={t} canEdit={canEdit}>
                    {(open) => (
                      <tr className="cursor-pointer border-b border-border/50 hover:bg-surface-2/50" onClick={open}>
                        {canEdit && (
                          <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(t.id)}
                              aria-label={`Selecionar publicação em @${t.accountUsername}`}
                              onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
                            />
                          </td>
                        )}
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-2"><Avatar src={t.accountAvatarUrl} name={t.accountUsername} size={24} />@{t.accountUsername}</span>
                        </td>
                        <td className="py-2.5 text-xs text-fg-muted">{FORMAT_LABEL[t.format] ?? t.format}</td>
                        <td className="max-w-xs py-2.5">
                          <p className="truncate text-fg-muted">{t.caption || "—"}</p>
                          {t.lastError && <p className="truncate text-xs text-danger">{t.lastError}</p>}
                        </td>
                        <td className="py-2.5 text-xs text-fg-muted">{formatDateTime(t.scheduledAt)}</td>
                        <td className="py-2.5 text-xs tabular-nums text-fg-muted">{t.attempts}/{t.maxAttempts}</td>
                        <td className="py-2.5 pr-4">
                          <button type="button" onClick={(e) => { e.stopPropagation(); open(); }} className="rounded focus-visible:outline-2" aria-label={`Abrir detalhes da publicação em @${t.accountUsername}`}>
                            <StatusBadge status={t.status} simulated={t.simulated} />
                          </button>
                        </td>
                      </tr>
                    )}
                  </TargetDialog>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        {filtered.length > PAGE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-fg-muted">
            <span>{page * PAGE + 1}–{Math.min(filtered.length, (page + 1) * PAGE)} de {filtered.length}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Registro de auditoria" description="Ações administrativas recentes no workspace" />
        <ul className="divide-y divide-border/60 p-2 text-sm">
          {audit.length === 0 && <li className="p-3 text-fg-muted">Sem registros.</li>}
          {audit.map((a) => (
            <li key={a.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-sm">{AUDIT_LABEL[a.action] ?? a.action}</span>
                <span className="shrink-0 text-xs tabular-nums text-fg-muted">{formatDateTime(a.at)}</span>
              </div>
              {/* Detalhe técnico recolhido por padrão (sem JSON cru na tela). */}
              <details className="group mt-0.5">
                <summary className="w-fit cursor-pointer list-none text-xs text-fg-subtle hover:text-fg-muted [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Detalhes</span>
                  <span className="hidden group-open:inline">Ocultar detalhes</span>
                </summary>
                <p className="mt-1 break-all font-mono text-xs text-fg-subtle">
                  {a.action}
                  {a.meta ? ` · ${Object.entries(a.meta).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}` : ""}
                </p>
              </details>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
