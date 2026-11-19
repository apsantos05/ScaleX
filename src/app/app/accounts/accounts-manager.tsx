"use client";

import { FolderInput, RefreshCw, Search, Tag, Trash2, Unplug, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { AccountStatusBadge, Avatar, Badge, Card, EmptyState } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { parseTags } from "@/lib/domain/schemas";
import type { SocialAccount } from "@/lib/domain/types";
import { formatNumber, formatRelative } from "@/lib/utils";
import { disconnectAccountsAction, organizeAccountsAction, syncAccountsAction } from "../_actions/accounts";

type Mode = "set-group" | "add-tags" | "remove-tags" | "clear-tags";

export function AccountsManager({
  accounts,
  canEdit,
  canDisconnect,
  initialStatus,
}: {
  accounts: SocialAccount[];
  canEdit: boolean;
  canDisconnect: boolean;
  initialStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [group, setGroup] = useState("");
  const [tag, setTag] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [organize, setOrganize] = useState<Mode | null>(null);
  const [organizeValue, setOrganizeValue] = useState("");

  const groups = useMemo(() => Array.from(new Set(accounts.map((a) => a.group).filter(Boolean))) as string[], [accounts]);
  const tags = useMemo(() => Array.from(new Set(accounts.flatMap((a) => a.tags))).sort(), [accounts]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/^@/, "");
    return accounts.filter(
      (a) =>
        (!s || a.username.toLowerCase().includes(s) || a.displayName.toLowerCase().includes(s)) &&
        (!status || a.status === status) &&
        (!group || a.group === group) &&
        (!tag || a.tags.includes(tag)),
    );
  }, [accounts, q, status, group, tag]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const someSelected = filtered.some((a) => selected.has(a.id));
  const ids = Array.from(selected);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run<T>(p: Promise<{ ok: true; data?: T } | { ok: false; error: string }>, success: string | ((d: T) => string)) {
    startTransition(async () => {
      const r = await p;
      if (!r.ok) return toast.error(r.error);
      toast.success(typeof success === "string" ? success : success(r.data as T));
      router.refresh();
    });
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Users}
          title="Nenhuma conta conectada"
          description="Conecte contas profissionais do Instagram via OAuth oficial ou adicione contas demo para explorar a plataforma."
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input placeholder="Buscar por @username ou nome" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Buscar contas" />
        </div>
        <div className="grid grid-cols-3 gap-2 lg:w-[480px]">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status">
            <option value="">Todos status</option>
            <option value="active">Conectadas</option>
            <option value="needs_reauth">Reconectar</option>
            <option value="error">Com erro</option>
          </Select>
          <Select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filtrar por grupo">
            <option value="">Todos grupos</option>
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
          <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filtrar por etiqueta">
            <option value="">Todas etiquetas</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand/5 px-4 py-2.5 animate-fade-in" role="region" aria-label="Ações em lote">
          <span className="mr-2 text-sm font-medium">
            {selected.size} selecionada{selected.size > 1 ? "s" : ""}
          </span>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(syncAccountsAction(ids), (d: { synced: number; failed: string[] }) => `${d.synced} sincronizada(s)${d.failed.length ? ` · falhas: ${d.failed.join(", ")}` : ""}`)}>
            <RefreshCw /> Sincronizar
          </Button>
          {canEdit && (
            <>
              <Button size="sm" variant="secondary" onClick={() => { setOrganize("set-group"); setOrganizeValue(""); }}>
                <FolderInput /> Definir grupo
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setOrganize("add-tags"); setOrganizeValue(""); }}>
                <Tag /> Etiquetas
              </Button>
            </>
          )}
          {canDisconnect && (
            <ConfirmButton
              title={`Desconectar ${selected.size} conta(s)?`}
              description="As credenciais serão apagadas e publicações pendentes destas contas serão canceladas. Para revogar o acesso também no Instagram, remova a ScaleX em Configurações › Apps e sites."
              confirmLabel="Desconectar"
              onConfirm={async () => {
                const r = await disconnectAccountsAction(ids);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Contas desconectadas.");
                setSelected(new Set());
                router.refresh();
              }}
              trigger={(open) => (
                <Button size="sm" variant="danger" onClick={open}>
                  <Unplug /> Desconectar
                </Button>
              )}
            />
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-fg-subtle">
            <tr className="border-b border-border">
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  aria-label="Selecionar todas as contas visíveis"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allVisibleSelected;
                  }}
                  onChange={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const a of filtered) {
                        if (allVisibleSelected) next.delete(a.id);
                        else next.add(a.id);
                      }
                      return next;
                    })
                  }
                />
              </th>
              <th className="py-2.5 font-medium">Conta</th>
              <th className="py-2.5 font-medium">Status</th>
              <th className="py-2.5 font-medium">Grupo / etiquetas</th>
              <th className="py-2.5 font-medium">Seguidores</th>
              <th className="py-2.5 font-medium">Última sincronização</th>
              <th className="py-2.5 pr-4 font-medium">Permissões</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-surface-2/50 has-[:checked]:bg-brand/[0.04]">
                <td className="px-4 py-3">
                  <Checkbox checked={selected.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Selecionar @${a.username}`} />
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={a.avatarUrl} name={a.username} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium">
                        @{a.username}
                        {a.isDemo && <Badge tone="warning">Demo</Badge>}
                      </p>
                      <p className="truncate text-xs text-fg-subtle">
                        {a.displayName} · ID {a.providerAccountId.slice(0, 14)}
                        {a.accountType ? ` · ${a.accountType === "MEDIA_CREATOR" ? "Criador" : "Empresa"}` : ""}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <AccountStatusBadge status={a.status} />
                  {a.tokenExpiresAt && Date.parse(a.tokenExpiresAt) - new Date().getTime() < 7 * 86_400_000 && (
                    <p className="mt-1 text-[11px] text-warning">Token expira {formatRelative(a.tokenExpiresAt)}</p>
                  )}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {a.group && <Badge tone="info">{a.group}</Badge>}
                    {a.tags.map((t) => (
                      <Badge key={t}>#{t}</Badge>
                    ))}
                    {!a.group && !a.tags.length && <span className="text-fg-subtle">—</span>}
                  </div>
                </td>
                <td className="py-3 tabular-nums text-fg-muted">{formatNumber(a.followersCount)}</td>
                <td className="py-3 text-fg-muted">{formatRelative(a.lastSyncedAt)}</td>
                <td className="py-3 pr-4 text-xs text-fg-muted">
                  {a.scopes.includes("instagram_business_content_publish") ? "Publicação" : <span className="text-warning">Sem publicação</span>}
                  {a.scopes.includes("instagram_business_manage_insights") && " · Insights"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-8 text-center text-sm text-fg-muted">Nenhuma conta corresponde aos filtros.</p>}
      </div>

      <Dialog
        open={organize !== null}
        onOpenChange={(o) => !o && setOrganize(null)}
        title={organize === "set-group" ? "Definir grupo" : "Etiquetas"}
        description={`${selected.size} conta(s) selecionada(s)`}
        footer={
          <>
            {organize !== "set-group" && (
              <>
                <Button variant="ghost" onClick={() => { run(organizeAccountsAction({ accountIds: ids, mode: "clear-tags" }), "Etiquetas removidas."); setOrganize(null); }}>
                  <Trash2 /> Limpar todas
                </Button>
                <Button variant="secondary" onClick={() => { run(organizeAccountsAction({ accountIds: ids, tags: parseTags(organizeValue), mode: "remove-tags" }), "Etiquetas removidas."); setOrganize(null); }}>
                  Remover
                </Button>
              </>
            )}
            <Button
              loading={pending}
              onClick={() => {
                run(
                  organize === "set-group"
                    ? organizeAccountsAction({ accountIds: ids, group: organizeValue || null, mode: "set-group" })
                    : organizeAccountsAction({ accountIds: ids, tags: parseTags(organizeValue), mode: "add-tags" }),
                  "Contas atualizadas.",
                );
                setOrganize(null);
              }}
            >
              {organize === "set-group" ? "Salvar grupo" : "Adicionar"}
            </Button>
          </>
        }
      >
        <Field
          label={organize === "set-group" ? "Nome do grupo" : "Etiquetas (separadas por vírgula)"}
          htmlFor="organize-value"
          hint={organize === "set-group" ? "Deixe vazio para remover do grupo." : "Ex.: nicho-fitness, cliente-a"}
        >
          <Input id="organize-value" value={organizeValue} onChange={(e) => setOrganizeValue(e.target.value)} list={organize === "set-group" ? "groups-list" : undefined} autoFocus />
        </Field>
        <datalist id="groups-list">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </Dialog>
    </Card>
  );
}
