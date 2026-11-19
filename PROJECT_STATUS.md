# ScaleX — PROJECT_STATUS

_Atualizado em 19/11/2026 · Fase 1 (fundação do MVP)_

Legenda: ✅ concluído e verificado · 🟡 parcial · 🧪 simulado (modo demo) · ⏳ pendente

## ✅ Funcionalidades concluídas

| Área | O que existe | Como foi verificado |
|---|---|---|
| Projeto | Next.js 16.4 (App Router), TS strict, Tailwind 4, ESLint, Vitest, CI GitHub Actions | `npm run lint/typecheck/test/build` verdes |
| Design system | Tokens dark (paleta do briefing), Geist, Button/Field/Select/Checkbox/Card/Badge/Alert/Dialog/Toast/EmptyState, estados hover/loading/empty/error/success, foco visível, skip-link, `prefers-reduced-motion` | Navegação manual + teclado |
| Landing page | Hero, recursos, como funciona, segurança, planos, FAQ, CTA (sem números ou depoimentos inventados) | Navegador, desktop e 375 px |
| Autenticação | Cadastro, login, logout, recuperação/redefinição de senha; validação Zod no cliente e no servidor; rate limit; mensagens sem enumeração de e-mail | Fluxo completo no modo demo |
| Workspaces | Onboarding, múltiplos workspaces, troca de workspace, papéis, auditoria | Navegador |
| Dashboard | KPIs, gráfico de 14 dias, próximas publicações, histórico, campanhas, alertas (contas a reconectar, falhas 24h, worker parado, integração ausente) — tudo a partir de dados reais | Navegador |
| Contas | Lista, busca, filtros (status/grupo/etiqueta), seleção múltipla, grupos e etiquetas em lote, sincronizar, desconectar com confirmação, permissões e expiração de token | Navegador (contas demo) |
| Biblioteca | Upload múltiplo com dimensões/duração, validação de tipo/tamanho + magic bytes, pastas, etiquetas, busca, filtros, seleção múltipla, prévia, confirmação de direitos de uso, legendas reutilizáveis, exclusão com bloqueio se usada em publicação pendente, cota do plano | Navegador + testes de upload inválido (rejeitados) |
| Estúdio | Formato → mídia → legenda → contas → data → prévia → confirmação; validação por formato (JPEG, proporção, duração, carrossel 2–10, 2200 caracteres, 30 hashtags); resultado individual por conta; idempotência | Navegador: lote de 6 contas |
| Calendário | Visões dia/semana/mês, filtros por conta/campanha/status (na URL), detalhes, logs, cancelar, reagendar | Navegador |
| Campanhas / Histórico / Analytics operacional | CRUD de campanhas com progresso; histórico paginado com cancelamento em lote e auditoria; analytics com comparação de períodos, por conta e por campanha | Navegador |
| Banco | Migração `supabase/migrations/20261119000000_init.sql`: 14 tabelas, RLS, funções de claim/promote/criação idempotente, bucket privado | ⚠️ revisada, **não aplicada** em projeto Supabase real |
| Motor de jobs | Agendador e executor separados, lease, recuperação, 1 job/conta, backoff, erros classificados, limite diário, reuso de container, renovação de token | 12 testes do motor + execução real do worker no modo demo |
| Segurança | Tokens AES-256-GCM, state OAuth assinado + nonce, cookies httpOnly, headers de segurança, `redact` nos logs, autorização por papel no servidor, isolamento por workspace | Testes de segurança e isolamento |
| LGPD | Exportação JSON do workspace (proprietário), sem credenciais | Rota implementada |

## 🟡 Parciais

- **Driver Supabase** (`supabase-repository.ts`), upload direto ao Storage, Supabase Auth e callback de e-mail: código completo e tipado, **não executado contra um projeto real** (não há credenciais neste ambiente).
- **OAuth Instagram** e **GraphInstagramAdapter**: implementados conforme documentação oficial; **nenhuma chamada real foi feita** (sem App ID/Secret). Requer App Review da Meta para escopos avançados.
- **Membros**: listagem e papéis funcionam; **convite por e-mail e alteração de papel** ainda não.
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
| Supabase | Criar projeto, aplicar migração (`supabase db push`), preencher `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; configurar SMTP e URLs de redirect do Auth |
| Meta / Instagram | App Meta com produto “Instagram API with Instagram Login”, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, redirect URI cadastrada, App Review + Business Verification |
| Criptografia | `TOKEN_ENCRYPTION_KEY` (32 bytes base64) e `SESSION_SECRET` |
| Worker | Host Node para `npm run worker` (ou cron externo chamando `/api/cron/tick` com `CRON_SECRET`) |
| Pagamentos | Gateway (Stripe/Pagar.me) — **cobrança deliberadamente desativada** |
| Insights | Job de coleta periódica de métricas (adapter já pronto) |

## Problemas conhecidos

1. Página `/forgot-password` é estática: o aviso de “modo demo” é decidido no build.
2. Fuso do calendário fixo em `America/Sao_Paulo` (UTC−3); o Estúdio usa o fuso do navegador.
3. Driver demo relê o arquivo JSON a cada operação — adequado para testes, lento com milhares de registros.
4. Excluir conta remove (cascade) seus targets no Supabase; no demo eles ficam como “Cancelado”.
5. `img.decode()` não resolvia no navegador embutido de testes; trocado por `onload` com timeout.
6. Rotação de `TOKEN_ENCRYPTION_KEY` ainda não suportada (exige re-criptografar credenciais).

## Próximas prioridades

1. Provisionar Supabase de staging, aplicar migração e rodar a suíte contra ele (incluir testes de RLS com dois usuários).
2. Criar o app na Meta, testar OAuth + publicação real em uma conta profissional de teste; revisar números de limite.
3. Deploy do worker (Railway/Fly) com healthcheck e alerta de “fila parada”.
4. Convites de membros, gestão de papéis e exclusão de workspace/conta (LGPD: direito ao esquecimento).
5. Job de insights + Analytics de alcance/visualizações/engajamento.
6. Gateway de pagamento com webhooks (após aprovação), limites por plano já aplicados.
7. Observabilidade: Sentry/OpenTelemetry, métricas da fila, painel interno.
8. Testes E2E (Playwright) das jornadas principais.
