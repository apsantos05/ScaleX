"use client";

import { Copy, Link2, Send, Share2, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { Avatar, Badge, Card, CardHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import type { Invitation, Member, Role } from "@/lib/domain/types";
import { formatDate } from "@/lib/utils";
import { inviteMemberAction, removeMemberAction, revokeInvitationAction, setMemberRoleAction } from "../_actions/members";

const ROLE_LABEL: Record<Role, string> = { owner: "Proprietário", admin: "Administrador", editor: "Editor", viewer: "Leitor" };
const ROLE_HINT: Record<Role, string> = {
  owner: "Controle total, inclusive do plano e de outros proprietários",
  admin: "Gerencia membros, contas e conteúdo",
  editor: "Cria, agenda e cancela publicações",
  viewer: "Apenas visualiza",
};

export function MembersManager({
  members,
  invitations,
  currentUserId,
  myRole,
  limit,
}: {
  members: Member[];
  invitations: Invitation[];
  currentUserId: string;
  myRole: Role;
  limit: number;
}) {
  const router = useRouter();
  const canManage = myRole === "owner" || myRole === "admin";
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ link: string; email: string } | null>(null);
  const used = members.length + invitations.length;
  const owners = members.filter((m) => m.role === "owner").length;

  const canEdit = (m: Member) =>
    canManage && m.userId !== currentUserId && (m.role !== "owner" || myRole === "owner") && !(m.role === "owner" && owners <= 1);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <Card>
      <CardHeader
        title="Membros"
        description={`${members.length} membro(s)${invitations.length ? ` · ${invitations.length} convite(s) pendente(s)` : ""} · limite do plano: ${limit}`}
      />

      {canManage && (
        <form
          className="grid gap-3 border-b border-border p-5 sm:grid-cols-[1fr_160px_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await inviteMemberAction({ email, role });
            setBusy(false);
            if (!r.ok) return toast.error(r.error);
            setCreated(r.data);
            setEmail("");
            router.refresh();
          }}
        >
          <Field label="Convidar por e-mail" htmlFor="invite-email">
            <Input id="invite-email" type="email" autoComplete="off" placeholder="nome@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Papel" htmlFor="invite-role">
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="editor">Editor</option>
              <option value="viewer">Leitor</option>
              <option value="admin">Administrador</option>
            </Select>
          </Field>
          <Button type="submit" loading={busy} disabled={used >= limit}>
            <UserPlus /> Convidar
          </Button>
          <p className="text-xs text-fg-muted sm:col-span-3">
            {used >= limit
              ? "O limite de membros do plano foi atingido. Revogue um convite ou remova um membro."
              : `${ROLE_HINT[role]}. O link vale por 7 dias e só funciona para este e-mail.`}
          </p>
        </form>
      )}

      {invitations.length > 0 && (
        <div className="border-b border-border p-2">
          <p className="px-3 pb-1 pt-2 text-xs font-medium text-fg-muted">Convites pendentes</p>
          <ul className="divide-y divide-border/60">
            {invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Send className="size-4 shrink-0 text-fg-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{i.email}</p>
                  <p className="text-xs text-fg-muted">{ROLE_LABEL[i.role]} · expira em {formatDate(i.expiresAt)}</p>
                </div>
                {canManage && (
                  <ConfirmButton
                    title="Revogar convite?"
                    description={`O link enviado para ${i.email} deixará de funcionar.`}
                    confirmLabel="Revogar"
                    onConfirm={async () => {
                      const r = await revokeInvitationAction(i.id);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success("Convite revogado.");
                      router.refresh();
                    }}
                    trigger={(open) => (
                      <Button variant="ghost" size="sm" onClick={open}>
                        Revogar
                      </Button>
                    )}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="divide-y divide-border/60 p-2">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
            <Avatar src={null} name={m.name || m.email} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate">
                {m.name || m.email}
                {m.userId === currentUserId && <span className="text-fg-muted"> (você)</span>}
              </p>
              <p className="truncate text-xs text-fg-muted">{m.email}</p>
            </div>
            {canEdit(m) ? (
              <>
                <Select
                  aria-label={`Papel de ${m.name || m.email}`}
                  className="h-9 w-40 text-xs"
                  value={m.role}
                  onChange={async (e) => {
                    const r = await setMemberRoleAction(m.userId, e.target.value);
                    if (!r.ok) return toast.error(r.error);
                    toast.success("Papel atualizado.");
                    router.refresh();
                  }}
                >
                  {myRole === "owner" && <option value="owner">Proprietário</option>}
                  <option value="admin">Administrador</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Leitor</option>
                </Select>
                <ConfirmButton
                  title={`Remover ${m.name || m.email}?`}
                  description="A pessoa perde o acesso a este workspace imediatamente. As publicações já agendadas continuam."
                  confirmLabel="Remover"
                  onConfirm={async () => {
                    const r = await removeMemberAction(m.userId);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Membro removido.");
                    router.refresh();
                  }}
                  trigger={(open) => (
                    <Button variant="ghost" size="icon" onClick={open} aria-label={`Remover ${m.name || m.email}`}>
                      <Trash2 />
                    </Button>
                  )}
                />
              </>
            ) : (
              <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={created !== null}
        onOpenChange={(o) => !o && setCreated(null)}
        title="Convite criado"
        description={created ? `Envie este link para ${created.email}. Ele vale por 7 dias e só funciona com esse e-mail.` : undefined}
        footer={
          created && (
            <>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button variant="secondary" onClick={() => navigator.share({ title: "Convite ScaleX", url: created.link }).catch(() => undefined)}>
                  <Share2 /> Compartilhar
                </Button>
              )}
              <Button onClick={() => copy(created.link)}>
                <Copy /> Copiar link
              </Button>
            </>
          )
        }
      >
        {created && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 p-3">
            <Link2 className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <input
              readOnly
              value={created.link}
              aria-label="Link do convite"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 bg-transparent font-mono text-xs text-fg outline-none"
            />
          </div>
        )}
        <p className="mt-3 text-xs text-fg-muted">
          Por segurança o link é exibido só agora. Se perder, revogue e convide de novo.
        </p>
      </Dialog>
    </Card>
  );
}
