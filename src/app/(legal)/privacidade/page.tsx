import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LEGAL_IDENTITY } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  const L = LEGAL;
  return (
    <>
      <h1>Política de Privacidade</h1>
      <p className="lead">Versão vigente: {L.updatedAt}</p>

      <p>
        Esta política explica quais dados pessoais a {L.brand} trata, por que, com quem compartilha e como você exerce seus direitos, conforme a
        Lei Geral de Proteção de Dados (Lei 13.709/2018, &quot;LGPD&quot;). O controlador dos dados é <strong>{LEGAL_IDENTITY}</strong>.
      </p>

      <h2>1. Dados que coletamos</h2>
      <table>
        <thead>
          <tr>
            <th>Dado</th>
            <th>Origem</th>
            <th>Para que serve</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Nome, e-mail e senha (guardada apenas como hash, nunca em texto)</td>
            <td>Você, no cadastro</td>
            <td>Criar e proteger sua conta, enviar avisos do serviço</td>
          </tr>
          <tr>
            <td>Workspaces, membros, papéis e convites</td>
            <td>Você e sua equipe</td>
            <td>Organizar quem acessa o quê</td>
          </tr>
          <tr>
            <td>
              Dados das contas profissionais do Instagram conectadas: ID, nome de usuário, nome, foto de perfil, tipo de conta, número de
              seguidores e as permissões concedidas
            </td>
            <td>Meta, com sua autorização no login oficial</td>
            <td>Exibir as contas e publicar em nome delas</td>
          </tr>
          <tr>
            <td>Tokens de acesso da Meta</td>
            <td>Meta, com sua autorização</td>
            <td>Publicar e consultar dados das contas. Guardados criptografados (AES-256-GCM) e nunca exibidos no navegador</td>
          </tr>
          <tr>
            <td>Imagens, vídeos, legendas, agendamentos, campanhas e o resultado de cada publicação</td>
            <td>Você</td>
            <td>Prestar o serviço de agendamento e publicação</td>
          </tr>
          <tr>
            <td>Registros de auditoria e de execução (quem fez o quê e quando, erros de publicação)</td>
            <td>Gerados pelo uso do serviço</td>
            <td>Segurança, suporte e prevenção de abuso</td>
          </tr>
          <tr>
            <td>Dados de assinatura: plano, status, valores e identificadores de pedido</td>
            <td>Cakto, nossa processadora de pagamentos</td>
            <td>Liberar o plano contratado e emitir o histórico de pagamentos</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Não coletamos senhas do Instagram ou do Facebook</strong>: a conexão é feita exclusivamente pelo login oficial da Meta. Dados de
        cartão e Pix são tratados diretamente pela Cakto e não passam pela {L.brand}.
      </p>

      <h2>2. Bases legais</h2>
      <ul>
        <li>
          <strong>Execução de contrato</strong> (art. 7º, V): conta, contas conectadas, mídias, agendamentos e assinatura.
        </li>
        <li>
          <strong>Legítimo interesse</strong> (art. 7º, IX): registros de segurança, prevenção de fraude e melhoria do serviço.
        </li>
        <li>
          <strong>Cumprimento de obrigação legal</strong> (art. 7º, II): guarda de registros de acesso (Marco Civil da Internet) e de documentos
          fiscais.
        </li>
      </ul>

      <h2>3. Com quem compartilhamos</h2>
      <p>Somente com operadores necessários para prestar o serviço:</p>
      <ul>
        <li>
          <strong>Meta Platforms</strong> (Instagram): recebe o conteúdo que você manda publicar e devolve os dados das contas que você autorizou.
        </li>
        <li>
          <strong>Supabase</strong>: banco de dados, autenticação e armazenamento de mídias (servidores nos Estados Unidos).
        </li>
        <li>
          <strong>Vercel</strong>: hospedagem da aplicação.
        </li>
        <li>
          <strong>Cakto</strong>: processamento de pagamentos e assinaturas.
        </li>
      </ul>
      <p>
        Não vendemos dados pessoais nem os usamos para publicidade de terceiros. A transferência internacional para os Estados Unidos ocorre com
        fornecedores que adotam cláusulas contratuais e medidas de segurança compatíveis com a LGPD (art. 33).
      </p>

      <h2>4. Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta e do workspace: enquanto a conta estiver ativa.</li>
        <li>Tokens de acesso da Meta: até você desconectar a conta do Instagram ou revogar o acesso na Meta, quando são apagados.</li>
        <li>Mídias: até você excluí-las ou excluir o workspace.</li>
        <li>Registros de acesso: 6 meses (Marco Civil da Internet, art. 15).</li>
        <li>Registros de pagamento: 5 anos, por obrigação fiscal.</li>
      </ul>

      <h2>5. Segurança</h2>
      <p>
        Usamos conexão criptografada (HTTPS), criptografia dos tokens de acesso, isolamento de dados por workspace no banco (Row Level Security),
        armazenamento privado de mídias com links temporários e controle de acesso por papel (proprietário, administrador, editor e leitor).
      </p>

      <h2>6. Seus direitos</h2>
      <p>Pela LGPD (art. 18), você pode a qualquer momento:</p>
      <ul>
        <li>confirmar se tratamos seus dados e acessá-los;</li>
        <li>corrigir dados incompletos ou desatualizados;</li>
        <li>pedir a portabilidade: o proprietário do workspace pode exportar os dados em Configurações;</li>
        <li>pedir a eliminação dos dados, respeitadas as guardas obrigatórias por lei;</li>
        <li>revogar autorizações, inclusive o acesso às contas do Instagram.</li>
      </ul>
      <p>
        Como fazer: veja <Link href="/exclusao-de-dados">Exclusão de dados</Link> ou escreva para <strong>{L.privacyEmail}</strong>. Respondemos
        em até 15 dias.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Usamos apenas cookies essenciais: os de sessão de login e os que lembram o workspace selecionado e preferências da interface. Não usamos
        cookies de publicidade.
      </p>

      <h2>8. Menores de idade</h2>
      <p>A {L.brand} é destinada a maiores de 18 anos e não coleta dados de crianças ou adolescentes de forma intencional.</p>

      <h2>9. Encarregado e contato</h2>
      <p>
        Encarregado pelo tratamento de dados: <strong>{L.dpo}</strong> — {L.privacyEmail}. Você também pode reclamar à Autoridade Nacional de
        Proteção de Dados (ANPD).
      </p>

      <h2>10. Alterações</h2>
      <p>
        Mudanças relevantes serão avisadas no app e por e-mail antes de entrarem em vigor. A data da versão vigente fica no topo desta página.
      </p>
    </>
  );
}
