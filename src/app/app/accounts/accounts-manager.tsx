"use client";

import { FolderInput, RefreshCw, Search, Tag, Trash2, Unplug, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { AccountStatusBadge, Avatar, Badge, Card, EmptyState } from "@/components/ui/primitives";
import { SortableTh, type SortState } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { parseTags } from "@/lib/domain/schemas";
import type { SocialAccount } from "@/lib/domain/types";
import { formatNumber, formatRelative } from "@/lib/utils";
import { disconnectAccountsAction, organizeAccountsAction, syncAccountsAction } from "../_actions/accounts";

type Mode = "set-group" | "add-tags" | "remove-tags" | "clear-tags";
type SortKey = "username" | "followers" | "synced" | "status";
const STATUS_ORDER: Record<string, number> = { error: 0, needs_reauth: 1, disconnected: 2, active: 3 };

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
  const [sort, setSort] = useState<SortState<SortKey>>({ key: "status", dir: 1 });
  const activeFilters = [q.trim(), status, group, tag].filter(Boolean).length;
  const clearFilters = () => {
    setQ("");
    setStatus("");
    setGroup("");
    setTag("");
  };
  const sortBy = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === "followers" || key === "synced" ? -1 : 1 }));

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

  // Ordenação estável; padrão: contas com problema primeiro (o que exige atenção aparece no topo).
  const sorted = useMemo(() => {
    const val = (a: SocialAccount): string | number =>
      sort.key === "username" ? a.username.toLowerCase() : sort.key === "followers" ? (a.followersCount ?? -1) : sort.key === "synced" ? (a.lastSyncedAt ?? "") : (STATUS_ORDER[a.status] ?? 9);
    return [...filtered].sort((x, y) => {
      const a = val(x);
      const b = val(y);
      return (a < b ? -1 : a > b ? 1 : x.username.localeCompare(y.username)) * sort.dir;
    });
  }, [filtered, sort]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const someSelected = filtered.some((a) => selected.has(a.id));
  const ids = Array.from(selected);

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const a of filtered) {
        if (allVisibleSelected) next.delete(a.id);
        else next.add(a.id);
      }
      return next;
    });
  }

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
            <option value="">Status</option>
            <option value="active">Conectadas</option>
            <option value="needs_reauth">Reconectar</option>
            <option value="error">Com erro</option>
          </Select>
          <Select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Filtrar por grupo">
            <option value="">Grupo</option>
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
          <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filtrar por etiqueta">
            <option value="">Etiqueta</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex min-h-10 items-center gap-3 border-b border-border/60 px-4 py-2 text-xs text-fg-muted" aria-live="polite">
        <span>
          {filtered.length === accounts.length ? `${accounts.length} conta(s)` : `${filtered.length} de ${accounts.length} conta(s)`}
        </span>
        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="-my-1 h-7" onClick={clearFilters}>
            <X /> Limpar filtros ({activeFilters})
          </Button>
        )}
      </div>

      {selected.size > 0 && (
        <div
          className="z-20 flex flex-wrap items-center gap-2 border-b border-border bg-surface-2/95 px-4 py-2.5 backdrop-blur animate-fade-in max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:border-t max-md:shadow-[0_-12px_30px_-12px_rgb(0_0_0/0.8)] md:sticky md:top-0 md:bg-brand/[0.06]"
          role="region"
          aria-label="Ações em lote"
        >
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

      {filtered.length > 0 && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm text-fg-muted md:hidden">
          <Checkbox checked={allVisibleSelected} onChange={toggleAllVisible} />
          Selecionar todas ({filtered.length})
        </label>
      )}
      <ul className="divide-y divide-border/60 md:hidden">
        {sorted.map((a) => (
          // A linha inteira é o alvo de toque da seleção (label envolve o checkbox).
          <li key={a.id} className="has-[:checked]:bg-brand/[0.05]">
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3 active:bg-surface-2/60">
            <Checkbox className="mt-2.5" checked={selected.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Selecionar @${a.username}`} />
            <Avatar src={a.avatarUrl} name={a.username} size={36} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                <span className="truncate">@{a.username}</span>
                {a.isDemo && <Badge tone="warning">Demo</Badge>}
              </p>
              {/* Tempo relativo muda entre o servidor e o navegador: diferença esperada, não é erro. */}
              <p className="truncate text-xs text-fg-subtle" suppressHydrationWarning>{a.displayName} · sinc. {formatRelative(a.lastSyncedAt, undefined, true)}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <AccountStatusBadge status={a.status} />
                {a.group && <Badge tone="info">{a.group}</Badge>}
                {a.tags.map((t) => (
                  <Badge key={t}>#{t}</Badge>
                ))}
              </div>
            </div>
            </label>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
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
                  onChange={toggleAllVisible}
                />
              </th>
              <SortableTh sort={sort} onSort={sortBy} k="username">Conta</SortableTh>
              <SortableTh sort={sort} onSort={sortBy} k="status">Status</SortableTh>
              <th className="py-2.5 font-medium">Grupo / etiquetas</th>
              <SortableTh sort={sort} onSort={sortBy} k="followers">Seguidores</SortableTh>
              <SortableTh sort={sort} onSort={sortBy} k="synced">Última sincronização</SortableTh>
              <th className="py-2.5 pr-4 font-medium">Permissões</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
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
                    <p className="mt-1 text-xs text-warning" suppressHydrationWarning>Token expira {formatRelative(a.tokenExpiresAt)}</p>
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
                <td className="py-3 text-fg-muted" suppressHydrationWarning>{formatRelative(a.lastSyncedAt, undefined, true)}</td>
                <td className="py-3 pr-4 text-xs text-fg-muted">
                  {a.scopes.includes("instagram_business_content_publish") ? "Publicação" : <span className="text-warning">Sem publicação</span>}
                  {a.scopes.includes("instagram_business_manage_insights") && " · Insights"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <p className="p-8 text-center text-sm text-fg-muted">Nenhuma conta corresponde aos filtros.</p>}

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
