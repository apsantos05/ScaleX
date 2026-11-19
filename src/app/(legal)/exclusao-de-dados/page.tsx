import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Exclusão de dados" };

/**
 * Instruções de exclusão de dados exigidas pela Meta para apps que usam login do Facebook/Instagram
 * (campo "URL de instruções de exclusão de dados" nas configurações básicas do app).
 */
export default function DataDeletionPage() {
  const L = LEGAL;
  return (
    <>
      <h1>Exclusão de dados</h1>
      <p className="lead">Versão vigente: {L.updatedAt}</p>

      <p>
        Você pode remover o acesso da {L.brand} às suas contas e pedir a exclusão dos seus dados a qualquer momento. Escolha abaixo o que você
        quer fazer.
      </p>

      <h2>1. Desconectar uma conta do Instagram</h2>
      <p>Apaga imediatamente o token de acesso daquela conta e cancela as publicações pendentes dela.</p>
      <ol>
        <li>Entre na {L.brand} e abra <strong>Contas</strong>.</li>
        <li>Marque a conta e clique em <strong>Desconectar</strong> (proprietário ou administrador do workspace).</li>
      </ol>

      <h2>2. Revogar o acesso direto na Meta</h2>
      <p>Funciona mesmo sem entrar na {L.brand}. A partir da revogação, nenhuma publicação nova é feita.</p>
      <ol>
        <li>
          No Facebook, abra <strong>Configurações e privacidade → Configurações → Integrações comerciais</strong> (ou, no Instagram,{" "}
          <strong>Configurações → Apps e sites</strong>).
        </li>
        <li>
          Encontre <strong>{L.brand}</strong> e clique em <strong>Remover</strong>.
        </li>
        <li>Na próxima tentativa de uso, a {L.brand} marca a conta como &quot;Reconectar&quot; e deixa de usá-la.</li>
      </ol>

      <h2>3. Excluir sua conta e todos os seus dados</h2>
      <ol>
        <li>
          Envie um e-mail para <strong>{L.privacyEmail}</strong> com o assunto <strong>&quot;Exclusão de dados&quot;</strong>, a partir do
          e-mail cadastrado na {L.brand}.
        </li>
        <li>Confirmaremos sua identidade e o pedido por e-mail.</li>
        <li>
          Em até <strong>15 dias</strong> apagamos: conta, workspaces dos quais você é o único proprietário, contas conectadas e tokens, mídias,
          legendas, agendamentos e registros de uso.
        </li>
        <li>Você recebe a confirmação da exclusão com um número de protocolo.</li>
      </ol>
      <p>
        <strong>O que fica guardado por obrigação legal:</strong> registros de acesso por 6 meses (Marco Civil da Internet) e registros de
        pagamento por 5 anos (legislação fiscal). Depois desses prazos, também são apagados.
      </p>
      <p>
        Antes de excluir, o proprietário do workspace pode baixar uma cópia dos dados em <strong>Configurações</strong>. Mais detalhes na{" "}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
    </>
  );
}
