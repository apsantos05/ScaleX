import type { Metadata } from "next";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireWorkspace, roleAtLeast } from "@/lib/auth/context";
import { getDataMode } from "@/lib/env";
import { isInstagramConfigured } from "@/lib/integrations/instagram";
import { formatDate } from "@/lib/utils";
import { planLimits } from "@/lib/domain/plans";
import { MembersManager } from "./members-manager";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = { title: "Configurações" };

const ROLE_LABEL = { owner: "Proprietário", admin: "Administrador", editor: "Editor", viewer: "Leitor" } as const;

export default async function SettingsPage() {
  const { repo, workspace, role, user } = await requireWorkspace();
  const [members, invitations] = await Promise.all([
    repo.listMembers(workspace.id),
    roleAtLeast(role, "admin") ? repo.listInvitations(workspace.id) : Promise.resolve([]),
  ]);
  const mode = getDataMode();

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Perfil" description="Seus dados de acesso" />
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 p-5 text-sm">
            <dt className="text-fg-muted">Nome</dt><dd>{user.name}</dd>
            <dt className="text-fg-muted">E-mail</dt><dd>{user.email}</dd>
            <dt className="text-fg-muted">Papel</dt><dd>{ROLE_LABEL[role]}</dd>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Workspace" description={`Criado em ${formatDate(workspace.createdAt)}`} />
          <div className="p-5">
            <WorkspaceForm name={workspace.name} canEdit={roleAtLeast(role, "admin")} />
            <p className="mt-3 text-xs text-fg-subtle">Identificador: <span className="font-mono">{workspace.slug}</span></p>
          </div>
        </Card>

        <MembersManager
          members={members}
          invitations={invitations}
          currentUserId={user.id}
          myRole={role}
          limit={planLimits(workspace.plan).maxMembers}
        />

        <Card>
          <CardHeader title="Segurança e dados" />
          <dl className="grid grid-cols-[180px_1fr] gap-y-2.5 p-5 text-sm">
            <dt className="text-fg-muted">Modo de dados</dt>
            <dd>{mode === "supabase" ? <Badge tone="success">Supabase (real)</Badge> : <Badge tone="warning">Demonstração (local)</Badge>}</dd>
            <dt className="text-fg-muted">Autenticação</dt>
            <dd>{mode === "supabase" ? "Supabase Auth" : "Sessão local assinada (HMAC), senha com scrypt"}</dd>
            <dt className="text-fg-muted">Integração Instagram</dt>
            <dd>{isInstagramConfigured() ? <Badge tone="success">Configurada</Badge> : <Badge>Não configurada</Badge>}</dd>
            <dt className="text-fg-muted">Tokens OAuth</dt>
            <dd>Criptografados (AES-256-GCM), nunca enviados ao navegador</dd>
            <dt className="text-fg-muted">LGPD</dt>
            <dd>
              {roleAtLeast(role, "owner") ? (
                <a href="/api/workspace/export" className="text-brand hover:underline">Exportar dados do workspace (JSON)</a>
              ) : (
                "Exportação disponível para o proprietário"
              )}
            </dd>
          </dl>
        </Card>
      </div>
    </>
  );
}
