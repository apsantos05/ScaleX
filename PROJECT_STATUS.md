# ScaleX — PROJECT_STATUS

_Atualizado em 19/11/2026 · Fase 1 (fundação do MVP) + Supabase conectado + Rodada 1 da Auditoria Mestre (cron em produção, convites de membros) + Visual Atelier 2.0 (branch `feat/visual-atelier-2`, não publicada)_

Legenda: ✅ concluído e verificado · 🟡 parcial · 🧪 simulado (modo demo) · ⏳ pendente

## ✅ Funcionalidades concluídas

| Área | O que existe | Como foi verificado |
|---|---|---|
| Projeto | Next.js 16.4 (App Router), TS strict, Tailwind 4, ESLint, Vitest, CI GitHub Actions | `npm run lint/typecheck/test/build` verdes |
| Design system | Tokens dark (paleta do briefing), Geist, Button/Field/Select/Checkbox/Card/Badge/Alert/Dialog/Toast/EmptyState, estados hover/loading/empty/error/success, foco visível, skip-link, `prefers-reduced-motion` | Navegação manual + teclado |
| Landing page | Hero, recursos, como funciona, segurança, planos, FAQ, CTA (sem números ou depoimentos inventados) | Navegador, desktop e 375 px |
| Autenticação | Cadastro, login, logout, recuperação/redefinição de senha; validação Zod no cliente e no servidor; rate limit; mensagens sem enumeração de e-mail | Fluxo completo no modo demo; **login real via Supabase Auth** verificado |
| Workspaces | Onboarding, múltiplos workspaces, troca de workspace, papéis, auditoria | Navegador |
| Dashboard | KPIs, gráfico de 14 dias, próximas publicações, histórico, campanhas, alertas (contas a reconectar, falhas 24h, worker parado, integração ausente) — tudo a partir de dados reais | Navegador |
| Contas | Lista, busca, filtros (status/grupo/etiqueta), seleção múltipla, grupos e etiquetas em lote, sincronizar, desconectar com confirmação, permissões e expiração de token | Navegador (contas demo) |
| Biblioteca | Upload múltiplo com dimensões/duração, validação de tipo/tamanho + magic bytes, pastas, etiquetas, busca, filtros, seleção múltipla, prévia, confirmação de direitos de uso, legendas reutilizáveis, exclusão com bloqueio se usada em publicação pendente, cota do plano | Navegador + testes de upload inválido (rejeitados) |
| Estúdio | Formato → mídia → legenda → contas → data → prévia → confirmação; validação por formato (JPEG, proporção, duração, carrossel 2–10, 2200 caracteres, 30 hashtags); resultado individual por conta; idempotência | Navegador: lote de 6 contas |
| Calendário | Visões dia/semana/mês, filtros por conta/campanha/status (na URL), detalhes, logs, cancelar, reagendar | Navegador |
| Campanhas / Histórico / Analytics operacional | CRUD de campanhas com progresso; histórico paginado com cancelamento em lote e auditoria; analytics com comparação de períodos, por conta e por campanha | Navegador |
| Banco (Supabase) | Migração `supabase/migrations/20261119000000_init.sql` **aplicada** no projeto `Scalex` (`kiiramyrkhkeocirezit`, us-east-2): 14 tabelas, RLS, funções de claim/promote/criação idempotente, bucket privado | `npm run verify:supabase`: **19/19** (isolamento entre usuários, credenciais inacessíveis, storage por workspace, idempotência, funções do worker restritas) |
| Motor de jobs | Agendador e executor separados, lease, recuperação, 1 job/conta, backoff, erros classificados, limite diário, reuso de container, renovação de token | 12 testes do motor + worker executado no modo demo **e contra o Supabase** (6/6 simuladas publicadas, logs gravados) |
| Segurança | Tokens AES-256-GCM, state OAuth assinado + nonce, cookies httpOnly, headers de segurança, `redact` nos logs, autorização por papel no servidor, isolamento por workspace | Testes de segurança e isolamento |
| LGPD | Exportação JSON do workspace (proprietário), sem credenciais | Rota implementada |
| Visual Atelier 2.0 | Tokens com contraste AA (texto secundário, botão primário #E0142C, borda de campo), área de toque ≥44 px em telas de toque, diálogos como bottom sheet no celular, barra lateral recolhível (cookie), gaveta móvel com foco preso, dashboard com hierarquia (crítico → estado → indicadores clicáveis), Estúdio com rascunho automático + confirmação antes de agendar + progresso, ordenação em Contas, minicalendário móvel, auditoria legível. Detalhes em `docs/AUDITORIA-VISUAL-ATELIER-2-0.md` | lint/typecheck/37 testes/build verdes; medição no navegador: 0 overflow em 320 px e 0 textos < 12 px nas 10 páginas do app; 1 alvo < 44 px por página (skip-link) em 375 px |
| Cobrança (Cakto) | Botão Assinar (só proprietário) → sessão de checkout com token opaco → `pay.cakto.com.br/<oferta>?callback=`; webhook `/api/webhooks/cakto` com HMAC + anti-replay + idempotência; plano definido pela oferta paga; atraso/pausa/cancelamento (fim do período, job diário)/reembolso; faturas; cancelamento pela API. **Correção de segurança**: owner/admin podiam alterar `workspaces.plan` via PostgREST — agora só o nome | 15 testes (`tests/billing.test.ts`); `verify:supabase` 37/37; ponta a ponta local: webhook assinado ativou Pro, duplicata ignorada, assinatura inválida 401, reembolso voltou ao Trial, botão abriu `pay.cakto.com.br` |
| Motor em produção (cron) | Migração `20261119010000_publish_cron.sql`: `pg_cron` chama `GET /api/cron/tick` da Vercel **a cada minuto** via `pg_net`, com URL e `CRON_SECRET` guardados no **Vault** do Supabase (função `trigger_publish_tick`, sem acesso para anon/authenticated) | Job `scalex-publish-tick` ativo; execuções `succeeded`; respostas HTTP 200 `{"promoted":0,"results":[]}` |
| Membros e convites | Convite por link (token de 32 bytes, só o hash SHA-256 no banco, validade 7 dias, 1 convite ativo por e-mail, conta no limite do plano), revogação, aceite só com o **mesmo e-mail** convidado, troca de papel e remoção com regras (não altera a si mesmo, admin não mexe em proprietário, protege o último proprietário). Migração `20261119020000_invitations.sql` com funções `security definer`; tela em Configurações › Membros; página `/convite/[token]` | 9 testes unitários + **33/33** em `verify:supabase` (13 novas checagens) + fluxo no navegador: dono convida → convidado entra com outro e-mail (bloqueado) → sai, entra com o e-mail certo → aceita → cai no workspace como **Editor** |

## 🟡 Parciais

- **Supabase verificado ponta a ponta** (login → workspace → upload direto ao Storage → direitos → agendamento em lote → worker → histórico/logs). **Ainda não verificados**: cadastro com e-mail de confirmação (o domínio `.test` é rejeitado e o SMTP padrão só envia a membros da organização), recuperação de senha por e-mail, troca de workspace e exclusão no modo real.
- **OAuth Instagram** e **GraphInstagramAdapter**: implementados conforme documentação oficial; **nenhuma chamada real foi feita** (sem App ID/Secret). Requer App Review da Meta para escopos avançados.
- **Convites**: o link é gerado e copiado/compartilhado manualmente; **envio automático por e-mail** depende do SMTP próprio (ver `docs/EMAIL-SMTP.md`).
- **Rate limit** de endpoints é em memória (por instância).
- **Miniaturas de vídeo**: exibidas via `<video preload=metadata>`; não há geração de thumbnail no servidor.
- **Validação de mídia no modo real**: MIME/tamanho declarados + existência do objeto; magic bytes só no upload local.

## 🧪 Simulado (modo demo)

- Banco local (`.data/demo-db.json`) e uploads locais (`.data/uploads`).
- **Contas demo** (`isDemo = true`, badge “Demo”) usam `DemoInstagramAdapter`: **nada é publicado**; resultados aparecem como “Publicado (simulação)”. Legendas com `#demo-falha-temporaria` / `#demo-falha-permanente` simulam falhas para testar retentativas. Contas demo não contam no limite do plano.
- Recuperação de senha não envia e-mail no modo demo (avisado na tela).

## ⏳ Integrações pendentes / credenciais ausentes

| Item | Necessário |
|---|---|
| Supabase (Auth) | ✅ projeto e migrações prontos. Falta: **domínio + SMTP próprio (Resend)**, Site URL/Redirect URLs de produção e **religar "Confirm email"** — passo a passo em `docs/EMAIL-SMTP.md` |
| Meta / Instagram | App Meta com produto “Instagram API with Instagram Login”, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, redirect URI cadastrada, App Review + Business Verification |
| Criptografia | `TOKEN_ENCRYPTION_KEY` (32 bytes base64) e `SESSION_SECRET` |
| Worker | ✅ resolvido com `pg_cron` do Supabase chamando `/api/cron/tick` a cada minuto. Se o domínio de produção mudar, atualizar o segredo `scalex_app_url` no Vault |
| Pagamentos | **Cakto** implementada (branch `feat/cakto-billing`): checkout hospedado + webhook assinado. Falta criar produto/ofertas e webhook na Cakto e definir `CAKTO_*` na Vercel — ver `docs/BILLING-CAKTO.md` |
| Insights | Job de coleta periódica de métricas (adapter já pronto) |

## Problemas conhecidos

1. Página `/forgot-password` é estática: o aviso de “modo demo” é decidido no build.
2. Fuso do calendário fixo em `America/Sao_Paulo` (UTC−3); o Estúdio usa o fuso do navegador.
3. Driver demo relê o arquivo JSON a cada operação — adequado para testes, lento com milhares de registros.
4. Excluir conta remove (cascade) seus targets no Supabase; no demo eles ficam como “Cancelado”.
5. `img.decode()` não resolvia no navegador embutido de testes; trocado por `onload` com timeout.
6. Rotação de `TOKEN_ENCRYPTION_KEY` ainda não suportada (exige re-criptografar credenciais).
7. **Relógio da máquina**: com o relógio do computador errado, o `@supabase/ssr` considera a sessão expirada, renova em loop e desloga (`refresh_token_already_used`). Mantenha o horário automático ativado no ambiente de desenvolvimento.
8. Projeto Supabase em **us-east-2**; para usuários no Brasil, `sa-east-1` (São Paulo) teria menor latência.
9. Em dev, o log de Server Actions do Next foi desativado (`logging.serverFunctions: false`) porque expunha a senha do login no terminal.
10. **Corrigido na Rodada 1**: `listMembers` no Supabase usava um embed `profiles:user_id(...)` sem relação declarada e quebrava `/app/settings` e `/app/billing` no modo real (erro 500). Agora faz duas consultas.
11. Plano trial passou a permitir **2 membros** (dono + sócio).
12. Usuário de QA secundário (`QA2_*` no `.env.local`) existe no Supabase para testar convites; pode ser removido quando não for mais necessário.

## Próximas prioridades

1. ~~Supabase de staging + testes de RLS~~ ✅ feito. Configurar SMTP próprio no Supabase Auth (`docs/EMAIL-SMTP.md`).
2. Criar o app na Meta, testar OAuth + publicação real em uma conta profissional de teste; revisar números de limite.
3. ~~Worker em produção~~ ✅ `pg_cron` a cada minuto. Falta alerta externo de “fila parada”.
4. ~~Convites de membros e gestão de papéis~~ ✅ feito. Falta exclusão de workspace/conta (LGPD: direito ao esquecimento).
5. Job de insights + Analytics de alcance/visualizações/engajamento.
6. Gateway de pagamento com webhooks (após aprovação), limites por plano já aplicados.
7. Observabilidade: Sentry/OpenTelemetry, métricas da fila, painel interno.
8. Testes E2E (Playwright) das jornadas principais.
