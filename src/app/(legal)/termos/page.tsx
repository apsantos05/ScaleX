import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Termos de Uso" };

export default function TermsPage() {
  const L = LEGAL;
  return (
    <>
      <h1>Termos de Uso</h1>
      <p className="lead">Versão vigente: {L.updatedAt}</p>

      <p>
        Estes termos regem o uso da {L.brand}, serviço oferecido por <strong>{L.company}</strong>, CNPJ {L.cnpj}, com sede em {L.city}. Ao criar
        uma conta, você declara que leu e aceita estes termos e a <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>1. O serviço</h2>
      <p>
        A {L.brand} é uma ferramenta para organizar, agendar e publicar conteúdo em contas profissionais do Instagram, usando exclusivamente a
        API oficial da Meta. Ela não automatiza curtidas, comentários, seguidores ou mensagens e não acessa contas por senha.
      </p>
      <p>
        A {L.brand} não é afiliada, patrocinada nem endossada pela Meta Platforms, Inc. A disponibilidade das funções depende da API da Meta, que
        pode mudar ou suspender recursos sem aviso.
      </p>

      <h2>2. Quem pode usar</h2>
      <ul>
        <li>Pessoas maiores de 18 anos, com capacidade para contratar.</li>
        <li>Apenas contas do Instagram das quais você é titular ou para as quais tem autorização expressa do titular.</li>
        <li>Você responde pelo sigilo da sua senha e por tudo o que for feito na sua conta e no seu workspace.</li>
      </ul>

      <h2>3. Regras de conteúdo e de uso</h2>
      <p>
        Você é o único responsável pelo conteúdo que publica. Todo conteúdo enviado pela {L.brand} deve respeitar as Diretrizes da Comunidade e
        os Termos de Uso do Instagram e a legislação brasileira. <strong>É proibido usar a {L.brand} para:</strong>
      </p>
      <ul>
        <li>publicar nudez, atividade sexual ou oferta/solicitação de serviços sexuais;</li>
        <li>publicar conteúdo sem direito de uso, que viole marca, direito autoral ou imagem de terceiros;</li>
        <li>enviar spam, publicar em volume abusivo ou tentar contornar limites, restrições ou penalidades aplicados pela Meta;</li>
        <li>operar contas compradas, falsas, de terceiros sem autorização ou criadas para burlar suspensões;</li>
        <li>conteúdo enganoso, discriminatório, que envolva menores de idade de forma inadequada ou qualquer outra prática ilegal.</li>
      </ul>
      <p>
        Negócios de conteúdo adulto podem usar a {L.brand} somente com conteúdo permitido no Instagram. A {L.brand} pode exigir a confirmação
        dos direitos de uso das mídias antes da publicação.
      </p>
      <p>
        Em caso de violação, podemos remover conteúdo agendado, suspender ou encerrar a conta, sem prejuízo de outras medidas cabíveis.
      </p>

      <h2>4. Planos, pagamento e cancelamento</h2>
      <ul>
        <li>Os planos e limites estão na página de Assinatura do app. O plano Trial é gratuito e limitado.</li>
        <li>
          Os planos pagos são assinaturas mensais renovadas automaticamente e processadas pela <strong>Cakto</strong>, que também emite os
          comprovantes.
        </li>
        <li>
          Você pode cancelar a qualquer momento, pelo app ou pelo link enviado pela Cakto. O plano continua ativo até o fim do período já pago e
          não há multa.
        </li>
        <li>
          <strong>Direito de arrependimento:</strong> na primeira contratação, você pode pedir reembolso integral em até 7 dias (Código de
          Defesa do Consumidor, art. 49).
        </li>
        <li>Em caso de estorno, reembolso ou chargeback, o workspace volta ao plano Trial.</li>
        <li>Mudanças de preço serão avisadas com pelo menos 30 dias de antecedência e valem a partir da renovação seguinte.</li>
      </ul>

      <h2>5. Seu conteúdo</h2>
      <p>
        O conteúdo que você envia continua sendo seu. Você nos concede apenas a licença necessária para armazená-lo, processá-lo e publicá-lo nas
        contas que você indicar, enquanto usar o serviço.
      </p>

      <h2>6. Disponibilidade e responsabilidade</h2>
      <ul>
        <li>Trabalhamos para manter o serviço disponível, mas não garantimos funcionamento ininterrupto ou livre de falhas.</li>
        <li>
          Não respondemos por suspensões, bloqueios ou perda de alcance aplicados pela Meta às suas contas, nem por publicações que falhem por
          causa da Meta, de conteúdo fora das regras ou de autorizações revogadas.
        </li>
        <li>
          Respeitado o Código de Defesa do Consumidor, nossa responsabilidade total fica limitada ao valor pago nos 12 meses anteriores ao
          fato.
        </li>
      </ul>

      <h2>7. Encerramento</h2>
      <p>
        Você pode encerrar sua conta quando quiser (veja <Link href="/exclusao-de-dados">Exclusão de dados</Link>). Podemos encerrar contas
        que violem estes termos ou que fiquem inativas por mais de 12 meses no plano Trial, com aviso prévio por e-mail.
      </p>

      <h2>8. Alterações e lei aplicável</h2>
      <p>
        Podemos atualizar estes termos. Mudanças relevantes serão avisadas no app e por e-mail com antecedência. Aplica-se a lei brasileira, e
        fica eleito o foro de {L.city}, ressalvado o direito do consumidor de ajuizar ação no seu domicílio.
      </p>

      <h2>9. Contato</h2>
      <p>Dúvidas sobre estes termos: {L.privacyEmail}.</p>
    </>
  );
}
