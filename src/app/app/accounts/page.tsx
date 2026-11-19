import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/ui/primitives";
import { requireWorkspace, roleAtLeast } from "@/lib/auth/context";
import { planLimits } from "@/lib/domain/plans";
import { isInstagramConfigured } from "@/lib/integrations/instagram";
import { AccountsManager } from "./accounts-manager";
import { ConnectButtons } from "./connect-buttons";

export const metadata: Metadata = { title: "Contas conectadas" };

const ERRORS: Record<string, string> = {
  integracao_nao_configurada: "A integração oficial do Instagram ainda não foi configurada no servidor.",
  limite_de_contas: "Seu plano atingiu o limite de contas conectadas.",
  autorizacao_negada: "A autorização foi cancelada no Instagram.",
  state_invalido: "A sessão de conexão expirou ou é inválida. Tente novamente.",
  sessao_invalida: "Sua sessão mudou durante a conexão. Entre novamente e repita.",
  sem_permissao: "Você não tem permissão para conectar contas neste workspace.",
  conta_nao_profissional: "Apenas contas profissionais (Empresa ou Criador) podem ser conectadas.",
  falha_na_conexao: "Não foi possível concluir a conexão com o Instagram. Tente novamente.",
  falha_ao_iniciar: "Não foi possível iniciar a conexão.",
};

export default async function AccountsPage({ searchParams }: PageProps<"/app/accounts">) {
  const { repo, workspace, role } = await requireWorkspace();
  const sp = await searchParams;
  const accounts = await repo.listAccounts(workspace.id);
  const limits = planLimits(workspace.plan);
  const realCount = accounts.filter((a) => !a.isDemo).length;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const connected = typeof sp.connected === "string" ? sp.connected : undefined;

  return (
    <>
      <PageHeader
        title="Contas conectadas"
        description={`${realCount} de ${limits.maxAccounts} contas reais do plano ${limits.name}${accounts.length > realCount ? ` · ${accounts.length - realCount} demo (não contam no limite)` : ""}`}
        actions={
          roleAtLeast(role, "editor") ? (
            <ConnectButtons configured={isInstagramConfigured()} atLimit={realCount >= limits.maxAccounts} />
          ) : undefined
        }
      />
      {error && <Alert tone="danger" className="mb-4">{error}</Alert>}
      {connected && <Alert tone="success" className="mb-4">Conta @{connected} conectada com sucesso.</Alert>}
      {!isInstagramConfigured() && (
        <Alert tone="info" className="mb-4" title="Conexão real indisponível neste ambiente">
          Para conectar contas reais configure o app da Meta (Instagram API with Instagram Login) e as variáveis{" "}
          <code className="font-mono">INSTAGRAM_APP_ID</code>, <code className="font-mono">INSTAGRAM_APP_SECRET</code> e{" "}
          <code className="font-mono">TOKEN_ENCRYPTION_KEY</code>. Apenas contas profissionais (Empresa/Criador) são suportadas.
        </Alert>
      )}
      <AccountsManager accounts={accounts} canEdit={roleAtLeast(role, "editor")} canDisconnect={roleAtLeast(role, "admin")} initialStatus={typeof sp.status === "string" ? sp.status : ""} />
    </>
  );
}
