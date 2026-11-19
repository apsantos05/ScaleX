# Cobrança com a Cakto — como funciona e como ativar

## Fluxo
1. O **proprietário** do workspace clica em **Assinar** em `/app/billing`.
2. A ScaleX cria uma **sessão de checkout** (`billing_checkouts`) com um token opaco de 43 caracteres, sem dado pessoal. Em seguida envia a pessoa para `https://pay.cakto.com.br/<oferta>?callback=<token>`.
3. A pessoa paga na Cakto (cartão ou Pix).
4. A Cakto chama `POST /api/webhooks/cakto`. A ScaleX então:
   - valida a origem pela **assinatura HMAC** (`X-Cakto-Signature`), com janela de 5 min contra replay. O `secret` no corpo é aceito só quando a entrega não traz assinatura;
   - **ignora entregas repetidas** (`billing_events.event_key` único);
   - acha o workspace pelo `callback`. Nas renovações, acha pela assinatura já vinculada;
   - define o plano pela **oferta paga**, nunca pelo botão clicado;
   - atualiza `workspaces.plan` e `subscriptions` e registra a fatura em `invoices`.

| Evento Cakto | Efeito na ScaleX |
|---|---|
| `purchase_approved`, `subscription_created`, `subscription_renewed`, `subscription_late_recovered`, `subscription_resumed` | Plano da oferta ativo; renovação prevista atualizada |
| `subscription_late`, `subscription_renewal_refused` | Status "Pagamento em atraso". O plano continua, porque a Cakto faz retentativas |
| `subscription_paused` | Status "Pausada" |
| `subscription_canceled` | Mantém o plano até o fim do período pago. O job diário `expire_canceled_subscriptions` volta o workspace ao Trial |
| `refund`, `chargeback` | Volta ao Trial na hora; a fatura fica como estornada |
| Order bump, upsell, Pix gerado, abandono etc. | Ignorados (registrados para auditoria) |

**Troca de plano:** cria uma nova assinatura na Cakto. Quando o novo pagamento é aprovado, a ScaleX cancela a assinatura anterior pela API, se `CAKTO_CLIENT_ID`/`SECRET` estiverem configurados. Sem isso, o cancelamento da anterior precisa ser feito manualmente no painel da Cakto.

**Segurança:** usuários só conseguem alterar o **nome** do workspace. O plano muda apenas pelo servidor (migração `20261119030000`), e isso foi verificado em `npm run verify:supabase`. As tabelas de checkout e de eventos não têm policies, então só o servidor acessa.

## Ativação (uma vez)
1. **Na Cakto**, crie o produto de assinatura "ScaleX" com uma **oferta mensal por plano** (Starter e Pro; Scale é opcional). Anote o ID de cada oferta: é o final do link `pay.cakto.com.br/<ID>`.
2. **Na Cakto**, crie um webhook para `https://<seu-domínio>/api/webhooks/cakto` com os eventos:
   - `purchase_approved`, `refund`, `chargeback`;
   - `subscription_created`, `subscription_renewed`, `subscription_renewal_refused`, `subscription_late`, `subscription_late_recovered`, `subscription_paused`, `subscription_resumed`, `subscription_canceled`.

   Copie o **secret** gerado.
3. **Na Vercel**, em Settings › Environment Variables, adicione `CAKTO_WEBHOOK_SECRET`, `CAKTO_OFFER_STARTER`, `CAKTO_OFFER_PRO` e, opcionalmente, `CAKTO_OFFER_SCALE`, `CAKTO_CLIENT_ID` e `CAKTO_CLIENT_SECRET`. Depois faça um novo deploy.
4. Use **Testar Webhook** na Cakto: a entrega deve aparecer com status 200 no histórico.
5. Opcional: na oferta, configure a **página de obrigado** para `https://<seu-domínio>/app/billing?checkout=retorno`.

## Teste local
Com os valores de teste no `.env.local`, envie entregas assinadas para `http://localhost:3000/api/webhooks/cakto`. A suíte `tests/billing.test.ts` cobre:
- assinatura, replay e duplicidade;
- plano definido pela oferta paga;
- renovação e reembolso.
