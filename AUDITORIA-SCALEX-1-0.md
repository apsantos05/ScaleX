# ScaleX — Auditoria Mestre 1.0

_Data: 19/11/2026 · Escopo: código do repositório `apsantos05/ScaleX` (commit `85a4c30` + alterações locais do kit de Instagram) e aplicação rodando localmente contra o Supabase de staging. **Nenhuma alteração foi feita na aplicação nesta rodada.**_

> **Atualização pós-Rodada 1 (19/11/2026):** #2 e #12 **resolvidos**; #3 com guia pronto (`docs/EMAIL-SMTP.md`), aguardando domínio/SMTP; #1 segue bloqueado na Meta. Achado novo #23 (abaixo) encontrado e corrigido durante a Rodada 1. Os detalhes estão em `PROJECT_STATUS.md`.

---

## 1. Resumo executivo

A ScaleX tem uma **fundação técnica sólida**: Next.js 16, TypeScript estrito, RLS verificada no Supabase (19/19 checagens), motor de publicação com idempotência e lease, 28 testes unitários passando, build e lint limpos e 0 vulnerabilidades nas dependências de produção. A identidade dark/underground está aplicada de forma coerente.

O que impede a ScaleX de ser usada comercialmente **hoje** não é a interface, e sim três bloqueios de jornada (P0):

1. **Publicação real é impossível**: a integração oficial do Instagram não pode ser ativada (trava de portfólio empresarial na Meta).
2. **Agendamentos não executam em produção**: não há worker nem cron configurado no ambiente da Vercel.
3. **Cadastro sem confirmação de e-mail** no Supabase (desligado para teste): qualquer pessoa pode criar conta com e-mail de terceiros.

No uso diário, os problemas de maior impacto (P1) são **lentidão de navegação (1,4–4,0 s por página)**, **contraste abaixo do WCAG AA** em textos secundários, botão primário e bordas de campos, **fontes de 9–11 px e alvos de toque < 44 px** no mobile, **transbordo horizontal em 320 px** em duas páginas, **foco que escapa do menu móvel** e um **Estúdio no celular longo demais** (4 telas, 2 botões de envio).

---

## 2. Estado atual do projeto

### 2.1 Stack e versões (verificado em `package.json` / `npm ls`)
| Camada | Tecnologia |
|---|---|
| Runtime | Node 24.22.1 |
| Framework | Next.js **16.4.6** (App Router, Turbopack, `proxy.ts`), React **19.3.0** |
| Linguagem | TypeScript 5.9.3 (strict) |
| Estilo | Tailwind CSS 4.3.3 (tokens em `src/app/globals.css`), componentes próprios estilo shadcn, `radix-ui` 1.8.1, `lucide-react` 1.75.0 |
| Formulários/validação | react-hook-form 7, zod 4.6.7 |
| Dados/Auth/Storage | Supabase (`@supabase/supabase-js` 2.119, `@supabase/ssr` 0.12.7) + driver demo em JSON local |
| Testes | Vitest 5.1.1 |
| CI | GitHub Actions (`.github/workflows/ci.yml`: lint, typecheck, test, build) |

### 2.2 Verificações técnicas executadas
| Verificação | Resultado |
|---|---|
| `npm test` | **28/28 testes** passando (3 arquivos) |
| `eslint` | 0 erros, 0 avisos |
| `next typegen && tsc --noEmit` | sem erros |
| `next build` | compilado com sucesso, 30 rotas |
| `npm audit --omit=dev` | **0 vulnerabilidades** |
| `npm outdated` | apenas patches/minors (react 19.3.1, tailwind 4.3.5) e majors de dev (eslint 10, TS 7) |
| `npm run verify:supabase` (rodada anterior) | 19/19 checagens de RLS, storage e fila |

### 2.3 Estrutura e tamanho
| Pasta | Linhas | Arquivos | Conteúdo |
|---|---|---|---|
| `src/app` | 4.325 | 52 | rotas, server actions (`app/_actions`), route handlers (`api/*`) |
| `src/components` | 1.266 | 12 | `ui/` (design system), `app/` (shell, gráficos, uploader…), `brand/` |
| `src/lib` | 3.191 | 28 | domínio, repositórios (Supabase + demo), jobs, integrações, segurança, storage |
| `scripts` | 548 | 5 | worker, verificação Supabase, usuário QA, exportação de marca/social |
| `tests` | 449 | 3 | motor, domínio/segurança, isolamento |
| `supabase/migrations` | 394 | 1 | schema, RLS, funções do worker, bucket |

17 componentes client, 22 server actions, 9 route handlers.

### 2.4 Autenticação e permissões
- Supabase Auth (modo real) ou sessão HMAC + scrypt (modo demo). `proxy.ts` faz checagem otimista e renova sessão; autorização real em `requireWorkspace()` / `authorize(role)` (`src/lib/auth/context.ts`).
- Papéis owner > admin > editor > viewer, aplicados no servidor e nas políticas RLS.
- Tokens OAuth criptografados (AES-256-GCM), tabela de credenciais sem política RLS para usuários.

### 2.5 Integrações
| Integração | Estado |
|---|---|
| Supabase (DB/Auth/Storage) | **Real e verificada** (staging `kiiramyrkhkeocirezit`, us-east-2) |
| Instagram (Graph API, login do Instagram) | **Código pronto, não ativável** (portfólio Meta bloqueado; nunca chamado de verdade) |
| Insights (métricas) | Adapter pronto, **sem job de coleta** |
| Pagamentos | **Desativado por decisão** (apenas estrutura) |
| E-mail transacional (SMTP próprio) | **Ausente** (SMTP padrão do Supabase, limitado) |

### 2.6 Funcionalidades: real × simulado × incompleto
| Real e funcional | Simulado (modo demo / contas Demo) | Incompleto / ausente |
|---|---|---|
| Cadastro, login, logout, troca de workspace | Publicação em contas Demo (adapter simulado) | Conexão de contas reais do Instagram |
| Upload direto ao Storage, biblioteca, direitos de uso | Banco local JSON quando sem Supabase | Worker/cron em produção |
| Estúdio, agendamento em lote idempotente, cancelar, reagendar | | Convite de membros e troca de papel |
| Calendário, histórico, campanhas, analytics operacional | | Coleta de insights, cobrança, exclusão de conta/workspace |
| Exportação LGPD (JSON) | | Testes E2E/UI |

---

## 3. Inventário de páginas

| Rota | Arquivo | Tipo | Observação |
|---|---|---|---|
| `/` | `src/app/page.tsx` | estática | Landing |
| `/login`, `/signup` | `src/app/(auth)/*` | dinâmica | Formulários RHF + zod |
| `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | **estática** | aviso de modo demo decidido no build |
| `/reset-password`, `/auth/callback` | `src/app/(auth)/…`, `src/app/auth/callback` | dinâmica | fluxo Supabase |
| `/onboarding` | `src/app/onboarding/*` | dinâmica | cria workspace (+ seed demo) |
| `/app` | `src/app/app/page.tsx` | dinâmica | Dashboard |
| `/app/accounts` | `src/app/app/accounts/*` | dinâmica | Contas |
| `/app/library` | `src/app/app/library/*` | dinâmica | Biblioteca + legendas |
| `/app/studio` | `src/app/app/studio/*` | dinâmica | Estúdio |
| `/app/calendar` | `src/app/app/calendar/*` | dinâmica | Dia/Semana/Mês |
| `/app/campaigns` | `src/app/app/campaigns/*` | dinâmica | Campanhas |
| `/app/history` | `src/app/app/history/*` | dinâmica | Histórico + auditoria |
| `/app/analytics` | `src/app/app/analytics/page.tsx` | dinâmica | Métricas operacionais |
| `/app/billing` | `src/app/app/billing/page.tsx` | dinâmica | Plano (somente leitura) |
| `/app/settings` | `src/app/app/settings/*` | dinâmica | Perfil, workspace, membros |
| 404 / erro / carregamento | `src/app/not-found.tsx`, `src/app/app/error.tsx`, `src/app/app/loading.tsx` | — | — |

---

## 4. Diagnóstico desktop (1280 / 1440 / 1920)

**Método:** navegador embutido com emulação de viewport; script de medição (overflow, alvos, fontes, rótulos, largura útil) em cada página; teclado testado com Tab/Esc.

| Medida | 1280 | 1440 | 1920 |
|---|---|---|---|
| Sidebar | 248 px fixa | 248 px | 248 px |
| Largura útil do conteúdo | ~1.022–1.032 px | ~1.150 px | **1.400 px (teto)**, ~130 px de margem vazia de cada lado |
| Overflow horizontal | nenhum | nenhum | nenhum |
| Histórico: linha da tabela | — | — | 45 px de altura, tabela 1.334 px |
| Estúdio: painel de prévia | sticky, 360 px | sticky | sticky, botão de envio visível na dobra |

**Pontos fortes**
- Sem quebras ou cortes em nenhuma largura; grade do dashboard escala bem; Estúdio com prévia sticky ao lado.
- Foco visível em todos os controles (`outline 2px #FF3045`), link "Pular para o conteúdo" funcional.
- Hierarquia clara: título de página, cartões, tabelas com cabeçalhos discretos.

**Problemas**
- **Densidade e produtividade (P2):** sem atalhos de teclado nem paleta de comandos; **15 Tabs** do topo até a primeira ação da página (o skip link mitiga); tabelas sem ordenação por coluna e sem ações por linha (tudo via diálogo); sidebar não recolhível.
- **Tempo de resposta (P1):** cada navegação no `/app` levou **1,4–4,0 s** no servidor (logs: `proxy.ts` 180–1.456 ms + aplicação 745–1.844 ms). Numa sessão longa, isso cansa mais que qualquer detalhe visual.
- **1920 px (P2):** o teto de 1.400 px é saudável para leitura, mas o dashboard poderia usar a largura extra (ex.: histórico e próximas publicações lado a lado com mais linhas).
- **Esqueleto de carregamento genérico (P2):** `loading.tsx` tem o formato do dashboard e aparece em todas as páginas (Contas, Calendário…), gerando "salto" de layout.

---

## 5. Diagnóstico mobile (320 / 375 / 390 / 430)

| Página | 320 | 375 | 390 | 430 | Alvos < 44 px (320) | Fontes < 12 px (320) |
|---|---|---|---|---|---|---|
| Dashboard | ok | ok | ok | ok | 6/11 | 29 (mín. 9 px) |
| Contas | ok | ok | ok | ok | 15/20 | 34 |
| Biblioteca | ok | ok | ok | ok | 13/20 | 8 |
| Estúdio | ok | ok | ok | ok | 19/32 | 25 (mín. 9 px) |
| Calendário (mês) | ok | ok | ok | ok | **61/66** | 20 |
| Calendário (semana) | ok | ok | ok | ok | 18/23 | 12 |
| Campanhas | ok | ok | ok | ok | 16/21 | 14 |
| Histórico | **+7 px** | ok | ok | ok | 13/24 | 18 |
| Analytics | **+47 px** | ok | ok | ok | 6/11 | 20 (mín. 9 px) |
| Assinatura / Configurações | ok | ok | ok | ok | 5/10 | 7 |
| Landing | ok | ok | ok | ok | 8/11 | 5 |

**Pontos fortes (experiência própria, não um desktop encolhido):** barra de navegação inferior (Início, Contas, Publicar, Agenda, Mais), Contas e Histórico em cartões, Calendário com grade compacta e agenda em lista, Estúdio com barra fixa de ação, diálogos com rolagem interna e trava de fundo, campos com 16 px para evitar zoom do iOS.

**Problemas**
- **Transbordo em 320 px (P1):** Analytics (`instagram_business_manage_insights` sem quebra dentro do aviso + "Compartilhamentos" em bloco estreito) e Histórico (linhas do registro de auditoria com nome técnico + JSON + data numa única linha).
- **Alvos de toque (P1):** checkboxes de 16 px (`src/components/ui/form.tsx`), botões `icon-sm` de 32 px (fechar diálogo, excluir), links de dia do calendário de 24 px.
- **Estúdio longo (P1):** 2.696 px de altura em 375×667 (**4 telas**); formulário único de 5 etapas; **dois botões de envio** (barra fixa + painel); barras fixas somam **114 px (17% da tela)**.
- **Menu lateral sem focus trap (P1):** com o menu aberto, 25 Tabs levaram o foco para "Selecionar visíveis" na página de trás, apesar de `aria-modal="true"`.
- **Diálogos (P2):** centralizados (não em "bottom sheet"), botão fechar de 32 px; o log de execução mostra "Carregando…" por alguns segundos.
- **Landing (P2):** no celular, as âncoras (Recursos, Como funciona, Segurança, Planos) somem; não há menu.
- **Select com 16 px (P2):** a regra anti-zoom deixa selects visivelmente maiores que os demais textos em cartões compactos (ex.: "Todos" no Estúdio).

---

## 6. Diagnóstico visual

**Identidade:** coerente com "dark premium underground": preto quase puro, vermelho #FF3045 só como acento, símbolo "Lâmina", tipografia Geist, grade sutil na landing. Sem neon nem efeitos exagerados.

**Contraste (WCAG 2.2), medido sobre a paleta real:**
| Par | Contraste | Mínimo | Situação |
|---|---|---|---|
| Texto principal #F5F5F7 / fundo | 18,27 | 4,5 | ✅ |
| `fg-muted` #9898A3 / fundo e superfície | 6,44–6,97 | 4,5 | ✅ |
| **`fg-subtle` #6B6B76** / fundo, superfície, superfície-2 | **3,78 / 3,49 / 3,22** | 4,5 | ❌ (dicas, rótulos de eixo, datas, metadados) |
| Vermelho #FF3045 como texto / fundo | 5,46 | 4,5 | ✅ |
| **Branco sobre botão #FF3045** | **3,65** | 4,5 (texto 14 px) | ❌ |
| **Borda de campo #292930** / fundo | **1,38** | 3,0 (componente de UI) | ❌ |

**Tipografia:** escala boa nos títulos, mas uso frequente de **9–11 px** (`text-[9px]`×2, `text-[10px]`×10, `text-[11px]`×20 no código), incluindo rótulos da barra inferior (10 px) e badges (11 px).

**Componentes:** cartões, badges e tabelas consistentes; estados vazios presentes e úteis; ícones Lucide consistentes. Badges de status usam cor **e** texto (bom para daltonismo).

**Indicadores operacionais:** KPIs claros; gráfico com grade e escala arredondada; alertas operacionais (fila atrasada, contas a reconectar, falhas 24h) bem posicionados no dashboard.

---

## 7. Diagnóstico de interações

| Fluxo | Situação (evidência) |
|---|---|
| Cadastro | Funciona com validação inline; mensagens de erro do provedor traduzidas (rodadas anteriores). Sem confirmação de e-mail ativa (config). |
| Login / sessão | Funciona; sessão cai em loop se o relógio do cliente estiver errado (documentado). |
| Contas | Seleção múltipla, grupos/etiquetas em lote, sincronizar, desconectar com confirmação. **Sem "Conectar Instagram"** (integração inativa). |
| Biblioteca | Upload múltiplo com status por arquivo, rejeição de arquivo disfarçado, direitos de uso em lote. Sem percentual de progresso. |
| Estúdio | Validação por formato em tempo real, idempotência, resultado por conta. Duplo botão de envio no mobile. |
| Agendamento → execução | Funciona localmente com `npm run worker`; **não executa em produção** (sem worker/cron). |
| Cancelar / reagendar | Com confirmação e auditoria. |
| Filtros e busca | Client-side (rápidos), mas operam sobre listas truncadas no servidor (500/1000 itens). |
| Configurações | Renomear workspace; membros só leitura (**sem convite**). |

**Estados:** hover ✅, focus ✅, active ✅ (`translate-y-px`), loading ✅ (spinner em botões, esqueleto de página), disabled ✅ (opacidade 50%; contraste baixo), success/error ✅ (toasts `aria-live`), empty ✅, confirmação destrutiva ✅ (`ConfirmButton`).

**Botões sem ação / jornadas interrompidas:** nenhum botão "morto" encontrado. Jornadas interrompidas por dependência externa: conectar conta real e publicar de verdade.

---

## 8. Problemas encontrados

### 8.1 Comprovados

| # | Sev. | Tela / componente | Arquivo | Descrição | Impacto | Solução | Critério de aceitação |
|---|---|---|---|---|---|---|---|
| 1 | **P0** | Contas / Estúdio | `src/app/api/integrations/instagram/*`, env Vercel | Conexão oficial do Instagram não pode ser ativada (Meta exige portfólio; conta Facebook nova bloqueada) | Nenhuma publicação real possível | Destravar portfólio; validar OAuth + publicação numa conta de teste | Conta real conectada e 1 post publicado e confirmado pelo worker |
| 2 | ~~**P0**~~ ✅ resolvido | Motor de publicação (produção) | `scripts/worker.ts`, `src/app/api/cron/tick/route.ts` | Não há worker hospedado nem cron chamando `/api/cron/tick` | Agendamentos feitos no site nunca executam | Hospedar o worker (Railway/Fly/Render) ou cron externo a cada minuto | Post agendado no site de produção publica sem ação manual; alerta "fila atrasada" não aparece |
| 3 | **P0** (lançamento) | Cadastro | Config do Supabase Auth | "Confirm email" desligado e sem SMTP próprio | Contas com e-mail de terceiros; impossível confirmar e-mails de clientes | Configurar SMTP (ex.: Resend) e religar a confirmação | Cadastro com e-mail externo recebe e confirma o link |
| 4 | P1 | Todas as páginas `/app` | `src/proxy.ts`, `src/lib/auth/context.ts`, região do projeto | 1,4–4,0 s por navegação (proxy 180–1.456 ms + app 745–1.844 ms) | Lentidão perceptível em sessões longas | Projeto em `sa-east-1`; evitar `getUser` duplo (proxy + página); reduzir idas ao banco | Navegação p95 < 800 ms em produção |
| 5 | P1 | Design tokens | `src/app/globals.css` | `fg-subtle` 3,2–3,8:1; branco no botão 3,65:1; borda de campo 1,38:1 | Falha WCAG AA, leitura difícil em sessões longas | `fg-subtle` → **#83838F** (≥4,5:1 em todas as superfícies); borda de campo → **#62626D** (≥3:1); botão primário → fundo **#E0142C** (4,88:1) ou texto escuro sobre #FF3045 (5,46:1) | Todos os pares de texto ≥4,5:1 e bordas de campo ≥3:1 (axe sem violações de contraste) |
| 6 | P1 | Tipografia global | vários (`text-[9–11px]`) | 32 usos de 9–11 px; 7–34 elementos < 12 px por página | Legibilidade ruim no celular | Mínimo de 12 px (11 px só para legendas de eixo) | 0 textos < 12 px fora de eixos de gráfico |
| 7 | P1 | Alvos de toque (mobile) | `src/components/ui/form.tsx`, `button.tsx`, `calendar/page.tsx` | Checkboxes 16 px, `icon-sm` 32 px, dias 24 px | Toques errados, operação com uma mão difícil | Área de toque ≥44 px (padding ou pseudo-elemento) mantendo o visual | ≤10% dos alvos < 44 px por página no mobile |
| 8 | P1 | Analytics e Histórico em 320 px | `analytics/page.tsx`, `history/history-table.tsx` | Transbordo de 47 px e 7 px | Rolagem lateral em telas pequenas | `break-words`/`break-all` em códigos, ocultar JSON no mobile, quebrar linhas da auditoria | `scrollWidth == innerWidth` em 320 px em todas as páginas |
| 9 | P1 | Menu lateral móvel | `src/components/app/shell.tsx` | Sem focus trap (foco escapa com o menu aberto) | Usuários de teclado/leitor de tela se perdem | Usar `Dialog` do Radix para a gaveta | Tab cicla apenas dentro do menu aberto |
| 10 | P1 | Estúdio no mobile | `src/app/app/studio/studio.tsx` | 4 telas, 2 botões de envio, 114 px de barras fixas | Fluxo principal cansativo no celular | Assistente por etapas no mobile (Formato → Mídia → Legenda → Contas → Quando → Revisar), 1 único CTA | Publicar em ≤5 telas curtas, um só botão de envio |
| 11 | P1 | Dados em escala | `supabase-repository.ts` (limit 1000), `history/page.tsx` (500), `studio/page.tsx`, `services/publishing.ts` | Listas truncadas silenciosamente; dashboard/analytics/campanhas calculam sobre listas parciais; Estúdio gera URL assinada de toda a biblioteca; caminho idempotente carrega todos os targets | Números errados e lentidão com volume | Agregações em SQL (RPC), paginação server-side, busca de mídia paginada, consulta direta por `publication_id` | Contagens corretas com 10 mil targets; Estúdio < 1 s com 2 mil mídias |
| 12 | ~~P1~~ ✅ resolvido | Membros | `src/app/app/settings/page.tsx` | Sem convite nem troca de papel | Sócio/equipe não colaboram no mesmo workspace | Convite por e-mail + aceite + gestão de papéis | Segundo usuário entra no workspace com papel escolhido |
| 13 | P1 | Segurança | `next.config.ts`, `src/lib/security/rate-limit.ts` | Sem Content-Security-Policy; rate limit em memória (ineficaz em serverless) | Superfície de XSS maior; força bruta não contida entre instâncias | CSP com nonce; rate limit em Redis/Upstash ou Postgres | Header CSP presente; limite vale entre instâncias |
| 14 | P1 | Qualidade | `tests/` | Só testes unitários (28); sem E2E nem regressão visual | Regressões de UI passam despercebidas | Playwright + axe nas 7 larguras auditadas, no CI | Jornadas principais cobertas e rodando no CI |
| 15 | P2 | Carregamento | `src/app/app/loading.tsx` | Esqueleto único no formato do dashboard | Salto de layout | Esqueletos por página | Sem mudança brusca de layout ao carregar |
| 16 | P2 | Registro de auditoria | `history/history-table.tsx` | Mostra `publication.scheduled` + JSON cru | Pouco compreensível | Frases humanas ("Agendou 6 publicações") e detalhe expansível | Nenhum JSON visível por padrão |
| 17 | P2 | Landing mobile | `src/app/page.tsx` | Âncoras de seção somem no celular | Navegação mais difícil na landing | Menu compacto ou âncoras roláveis | Seções acessíveis em 375 px |
| 18 | P2 | Produtividade desktop | shell, tabelas | Sem atalhos/paleta de comandos, ordenação ou ações por linha | Operação lenta para usuários avançados | `⌘K`, `N` (nova publicação), `/` (busca), colunas ordenáveis, menu "…" por linha | Ações frequentes em ≤2 interações |
| 19 | P2 | Diálogos mobile | `src/components/ui/dialog.tsx` | Centralizados, fechar 32 px | Alcance com polegar | Bottom sheet no mobile, fechar 44 px | Diálogos ancorados na base em < 640 px |
| 20 | P2 | Formato no Estúdio | `studio.tsx` | `role="radio"` sem navegação por setas | Padrão ARIA incompleto | `RadioGroup` do Radix | Setas trocam o formato |
| 21 | P2 | Calendário | `calendar/*` | Sem criar a partir do dia nem arrastar para reagendar | Fluxo editorial menos direto | "+" no dia e arrastar e soltar (desktop) | Reagendar por arraste com confirmação |
| 22 | P2 | `/forgot-password` | arquivo estático | Aviso de modo demo decidido no build | Mensagem incorreta se o ambiente mudar | Tornar dinâmica ou remover aviso | Aviso reflete o ambiente atual |
| 23 | **P0** ✅ corrigido na Rodada 1 | Configurações e Plano (modo Supabase) | `src/lib/data/supabase-repository.ts` (`listMembers`) | Embed `profiles:user_id(...)` sem relação no PostgREST: `/app/settings` e `/app/billing` retornavam erro 500 no modo real | Dono não conseguia ver membros nem plano | Duas consultas (membros + perfis) | Páginas carregam no Supabase com membros e papéis corretos |

> **Correção de medição:** nesta auditoria, as medições de `/app/settings` e `/app/billing` foram feitas sobre a **página de erro** causada pelo #23, e não sobre o conteúdo real. Elas devem ser refeitas na Rodada 2.

### 8.2 Hipóteses (precisam de validação)
- **iOS real**: área segura do notch, ausência de zoom em campos e barras fixas com teclado aberto não foram testados em aparelho.
- **Leitores de tela** (VoiceOver/NVDA): não testados; as checagens foram estruturais (rótulos, `aria-*`, foco).
- **Desempenho na Vercel**: medido no ambiente local contra o Supabase; a latência em produção pode ser melhor ou pior.
- **Adapter da Graph API**: segue a documentação, mas nunca recebeu respostas reais (pode haver ajustes de campos/erros).
- **Volume alto** (100+ contas, milhares de mídias): problemas do item 11 deduzidos do código, não reproduzidos com dados.

---

## 9. Backlog priorizado

| Ordem | Item | Sev. | Esforço |
|---|---|---|---|
| 1 | Worker/cron em produção (#2) | P0 | Baixo |
| 2 | SMTP + confirmação de e-mail (#3) | P0 | Baixo |
| 3 | Destravar portfólio Meta e validar publicação real (#1) | P0 | Externo |
| 4 | Ajuste de tokens de contraste (#5) | P1 | Baixo |
| 5 | Transbordo 320 px (#8) e focus trap do menu (#9) | P1 | Baixo |
| 6 | Tipografia mínima e alvos de toque (#6, #7) | P1 | Médio |
| 7 | Latência: região + menos idas ao banco (#4) | P1 | Médio |
| 8 | Estúdio em etapas no mobile (#10) | P1 | Médio |
| 9 | Convite de membros (#12) | P1 | Médio |
| 10 | Dados em escala (#11) | P1 | Médio/alto |
| 11 | CSP e rate limit distribuído (#13) | P1 | Médio |
| 12 | E2E + axe + regressão visual (#14) | P1 | Médio |
| 13 | Itens P2 (#15–#22) | P2 | Baixo/médio |

---

## 10. Recomendações de arquitetura visual

1. **Tokens com contraste garantido:** `--fg-subtle: #83838F`, `--border-input: #62626D` (separar da borda decorativa #292930), `--brand-fill: #E0142C` para botões (manter #FF3045 para acentos e textos sobre preto).
2. **Escala tipográfica fechada:** 12 / 13 / 14 / 16 / 20 / 24 / 32 px; proibir valores arbitrários `text-[Npx]` via lint.
3. **Primitivas de toque:** `Checkbox`, `IconButton` e chips com área clicável de 44 px no mobile (hit-area invisível), visual inalterado no desktop.
4. **Padrões por plataforma:** `Dialog` vira bottom sheet em < 640 px; formulários longos viram assistente; tabelas viram listas de cartões (já feito em Contas/Histórico).
5. **Densidade para desktop:** modo compacto opcional (linhas de 36 px), colunas ordenáveis, ações em linha e paleta de comandos.
6. **Componente `Code`/`TechnicalText`** com quebra segura para nomes técnicos e IDs.

---

## 11. Plano de melhorias em rodadas

| Rodada | Foco | Itens | Resultado esperado |
|---|---|---|---|
| **1. Lançamento** | Destravar uso real | #1, #2, #3, #12 | Publicação real agendada funcionando e equipe colaborando |
| **2. Acessibilidade e mobile** | WCAG AA + uma mão | #5, #6, #7, #8, #9, #10, #19, #20 | axe sem violações sérias; Estúdio confortável no celular |
| **3. Desempenho e escala** | Velocidade e números corretos | #4, #11 | Navegação < 800 ms; contagens exatas em volume |
| **4. Produtividade desktop** | Ferramenta profissional | #15, #16, #18, #21 | Operadores avançados mais rápidos |
| **5. Qualidade contínua** | Evitar regressões | #13, #14, #17, #22 | CI com E2E, axe e regressão visual nas 7 larguras |

---

## 12. Limitações da auditoria

- **Ferramenta de navegador:** usado o navegador embutido do app com emulação de viewport (não Playwright, para não alterar dependências nesta rodada). As capturas foram analisadas durante a sessão, mas **não foram salvas em arquivo**; as evidências estão registradas como medições numéricas neste documento.
- **Renderização:** com o painel do navegador oculto, a página não troca o esqueleto pelo conteúdo (o `requestAnimationFrame` não dispara). As medições foram refeitas com o painel visível; não é um bug do app.
- **Dados:** testes com o usuário de QA, 6 contas demo, 2 mídias e 6 publicações (simuladas). Problemas de volume são deduções do código.
- **Escopo de autenticação:** páginas de login/cadastro foram validadas em rodadas anteriores; nesta rodada a sessão estava ativa (redireciona para o app).
- **Produção:** o ambiente da Vercel não foi inspecionado (sem acesso ao projeto); a integração do Instagram não pôde ser testada.
- **Acessibilidade:** sem leitor de tela real nem aparelho iOS/Android físico.
