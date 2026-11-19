# ScaleX — Visual Atelier 2.0

_Data: 19/11/2026 · Branch: `feat/visual-atelier-2` (a partir de `main` em `d2d71e5`) · Ambiente de teste: `next dev` local contra o Supabase de staging, usuário de QA com papel **Editor** no workspace "QA Real" (6 contas demo, 2 mídias, 6 publicações simuladas)._

> Esta rodada **não** fez deploy, não alterou credenciais, banco, motor de jobs, OAuth nem regras de negócio. Tudo está em uma branch local, sem push.

---

## 1. Diagnóstico antes das alterações

Baseline herdado da Auditoria Mestre 1.0 (itens #5–#10, #15–#16, #19–#20) e confirmado nesta rodada com um script de medição executado no navegador embutido (viewport emulada, `pointer: coarse` nas larguras < 768 px).

| Medição (375 px) | Antes | Depois |
|---|---|---|
| Alvos de toque < 44 px — Contas | 13 de 21 | 1 de 21 (link "Pular para o conteúdo", visível só com foco) |
| Alvos de toque < 44 px — Biblioteca | 12 de 21 | 1 de 21 (idem) |
| Alvos de toque < 44 px — Estúdio | 9 de 33 | 1 de 39 (idem) |
| Alvos de toque < 44 px — Calendário | 57 de 67 | 1 de 66 (idem) |
| Textos < 12 px — Estúdio | 7 | 0 |
| Textos < 12 px — Calendário | 9 | 0 |
| Overflow horizontal em 320 px (Analytics / Histórico) | 47 px / 7 px (Auditoria 1.0) | 0 / 0 |

Problemas de base identificados:
- Contraste abaixo de WCAG AA: `fg-subtle` 3,2–3,8:1, texto branco sobre o botão primário 3,65:1, borda dos campos 1,38:1.
- Menu móvel sem focus trap; dashboard com cinco blocos competindo pela atenção e o aviso informativo da Meta com o mesmo peso dos alertas críticos.
- Estúdio sem proteção de rascunho, sem indicação de etapa concluída, `role="radio"` sem setas, envio sem confirmação.
- Biblioteca: no celular a caixa de seleção só aparecia com hover (inexistente em toque).
- Calendário no celular: dias com alvo de 24 px.
- Histórico: registro de auditoria exibindo JSON cru.
- Esqueleto de carregamento com o formato do dashboard em todas as páginas.

## 2. Inventário de páginas auditadas

`/app` (Dashboard) · `/app/accounts` · `/app/library` · `/app/studio` · `/app/calendar` (dia/semana/mês) · `/app/campaigns` · `/app/history` · `/app/analytics` · `/app/billing` · `/app/settings` · gaveta móvel · diálogos (confirmação, detalhes da publicação, organizar contas).

## 3. Problemas identificados e severidade

| # | Sev. | Problema | Status |
|---|---|---|---|
| A1 | P1 | Contraste insuficiente (texto secundário, botão primário, bordas de campo) | ✅ Corrigido |
| A2 | P1 | Alvos de toque < 44 px no mobile (checkbox, filtros, abas, dias do calendário, botões pequenos) | ✅ Corrigido (exceto o skip-link) |
| A3 | P1 | Textos de 9–11 px | ✅ Corrigido; restam apenas rótulos decorativos em caixa-alta de 11 px e eixos de gráfico (ver §11) |
| A4 | P1 | Menu móvel sem focus trap / sem retorno de foco | ✅ Corrigido (Radix Dialog) |
| A5 | P1 | Dashboard sem hierarquia (informativo ≈ crítico) | ✅ Corrigido |
| A6 | P1 | Estúdio: perda de rascunho, sem confirmação, etapa atual pouco clara | ✅ Corrigido |
| A7 | P1 | Seleção na Biblioteca impossível sem hover | ✅ Corrigido |
| A8 | P1 | Overflow horizontal em 320 px (Analytics) | ✅ Corrigido |
| A9 | P2 | Diálogos centralizados no mobile, botão fechar de 32 px | ✅ Bottom sheet + fechar 36 px com área de toque 44 px |
| A10 | P2 | Formato do Estúdio sem navegação por setas | ✅ Corrigido |
| A11 | P2 | Auditoria com JSON cru | ✅ Frases + detalhe recolhível |
| A12 | P2 | Esqueleto único com formato do dashboard | ✅ Esqueleto neutro com shimmer |
| A13 | P2 | Tabelas sem ordenação | ✅ Contas ordenáveis; demais tabelas pendentes |
| A14 | P2 | Ações em lote somem ao rolar listas longas | ✅ Barra fixa (mobile) / sticky (desktop) em Contas, Biblioteca e Histórico |

## 4. Melhorias implementadas

### Design System 2.0
- **Tokens:**
  - `--fg-subtle` #8A8A95 (≥4,5:1 sobre bg/surface/surface-2).
  - `--border-input` #62626D (3,05:1 sobre surface).
  - `--brand-solid` #E0142C e `--brand-solid-hover` #CC1027 para fundos com texto branco (4,88:1 e 5,72:1). #FF3045 continua como cor de destaque (5,0:1 como texto).
  - Novas animações: `sheet-up`, `slide-in` e `shimmer`.
  - Utilitários `touch-hit`, `skeleton` e `scrollbar-none`, mais safe areas (`pt-safe`) e `viewport-fit=cover`.
- **Button:**
  - Alturas do desktop mantidas (32/36/44 px). Em telas de toque, `touch-hit` cria uma área clicável invisível de ≥44×44 px sem inflar tabelas.
  - Foco visível consistente; `disabled` e `aria-busy` com cursor adequado.
  - `type="button"` por padrão: evita submissão acidental. Todos os botões de envio existentes já declaravam `type="submit"`.
- **Input/Select/Textarea:**
  - Borda com contraste, anel de foco de 3 px e estado inválido com borda e anel.
  - Altura de 44 px em telas de toque.
  - Dica (`hint`) com `id` para `aria-describedby`.
- **Checkbox:** 20 px em toque; cor sólida acessível.
- **Switch** (novo): `role="switch"` com área de toque de 44 px.
- **Dialog:** bottom sheet em < 640 px, com alça visual, botões empilhados de 44 px e respeito à área segura. No desktop continua centralizado.
- **Toast:**
  - Borda lateral por tom; botão fechar com área de toque.
  - No mobile, centralizado acima da barra inferior + safe area.
- **Badge:** 12 px. **PageHeader:** `eyebrow` (contexto), título maior, ações em largura total no mobile. **Skeleton** (novo).
- **SortableTh** (novo, `components/ui/table.tsx`): cabeçalho ordenável com `aria-sort`.
- **StatCard:**
  - Ícone e tons `warning`/`danger`/`success`, aplicados só quando o valor é > 0.
  - Vira **link para a lista filtrada** quando recebe `href`.

### AppShell e navegação
- **Barra lateral recolhível** (248 ↔ 72 px):
  - Preferência em cookie `sx_sidebar`, lida no servidor, sem salto de layout.
  - Tooltips com o nome de cada item quando recolhida.
  - Atalho `[` e `aria-expanded`/`aria-controls`.
- **Navegação agrupada:** Operação (Dashboard, Estúdio, Calendário, Histórico) · Ativos (Contas, Biblioteca, Campanhas) · Análise. Assinatura e Configurações ficam no rodapé.
- **"Nova publicação"** como ação primária fixa na barra lateral, com atalho `N`. Os atalhos são ignorados enquanto se digita ou com um diálogo aberto.
- **Identidade:** "SCALEX — Digital Operations" sob o logo.
- **Gaveta móvel** reescrita com Radix Dialog:
  - Foco preso: 20 tabulações permanecem dentro.
  - `Esc` fecha e o foco volta ao botão que abriu.
  - Fundo inerte; fecha ao navegar.
- **Topo móvel:** seletor de workspace compacto e funcional (antes era só um rótulo); logo com área de 44 px; safe area superior.
- **Barra inferior:** rótulos de 12 px; botão "Publicar" com o vermelho acessível; "Mais" com `aria-expanded`.

### Dashboard (`src/app/app/page.tsx`)
Hierarquia nova, nesta ordem:
1. **Alertas críticos**: fila atrasada, falhas em 24 h, contas para reconectar.
2. **Faixa de estado da operação**: fila, contas aptas, Instagram. O aviso de integração em ativação saiu do bloco de alertas e virou um item compacto, sem esconder nada crítico.
3. **Indicadores clicáveis**:
   - Contas → `/app/accounts`
   - Disponíveis → `?status=active`
   - Agendadas → calendário, com a próxima publicação
   - Publicadas → histórico filtrado
   - Com erro → histórico filtrado, com as falhas das últimas 24 h
4. **Próximas publicações + Atividade recente**.
5. **Volume (14 dias) + Campanhas**: barra de progresso com `role="meter"`.

O subtítulo resume o estado da operação ("N itens exigem sua atenção" / "Operação em dia. Próxima publicação em…"). **A regra de detecção de worker parado não foi alterada.**

### Estúdio (`studio.tsx`)
- **Rascunho automático** (`localStorage`):
  - Ao voltar, aparece o aviso "Você tem um rascunho não enviado" com **Restaurar / Descartar**.
  - A restauração filtra IDs de mídias, contas e campanhas que não existem mais ou não estão aptas.
  - A chave de idempotência é preservada, então reenviar o mesmo rascunho não duplica.
  - Aviso do navegador ao fechar com trabalho não enviado.
- **Trilha de progresso** (5 etapas com ✓) e cabeçalhos de etapa com estado concluído.
- **"Falta: …"** no resumo, explicando por que o botão está desabilitado.
- **Confirmação antes de enviar**:
  - Mostra formato, mídias, quando, campanha, legenda e a lista de contas.
  - Avisa sobre contas Demo.
  - O envio só acontece no diálogo.
- **Seletor de formato:** `radiogroup` com setas e foco itinerante.
- **Contas:**
  - Filtro "Só selecionadas".
  - "Selecionar aptas (N)".
  - Estado vazio da busca; linhas de 44 px.
- **Mídias:** grade de 3 colunas em < 400 px; selo "Direitos" legível; erros de validação exibidos junto da etapa de conteúdo.
- **Barra inferior móvel** respeita a safe area; `size="lg"`.
- **Sem mudanças** em `validateForInstagram`, limites, idempotência ou `schedulePublicationAction`.

### Contas
- Ordenação por conta, status, seguidores e última sincronização. Padrão: problemas primeiro.
- Contador "N de M contas" e "Limpar filtros (n)".
- No mobile a linha inteira seleciona.
- Barra de ações em lote fixa acima da navegação inferior (mobile) e sticky (desktop).

### Biblioteca
- No toque, a caixa de seleção fica sempre visível, com área de 44 px.
- Botão "Selecionar arquivos" real (no celular não há arrastar e soltar).
- Abas em largura total no mobile.
- Barra de lote fixa; metadados em 12 px.

### Calendário
- **Mobile:** minicalendário em que cada dia inteiro é um alvo (≥44 px mesmo em 320 px, cartão de largura total), com marcador de publicações e `aria-current="date"`. A agenda em lista abaixo foi mantida.
- **Seletor Dia/Semana/Mês:** largura total no mobile, 44 px em toque.
- Visão semana sem altura mínima vazia no mobile.
- Chips com rótulo de status em português (inclui "simulado").

### Histórico
- Formatos com nomes legíveis (Feed, Reels, Story, Carrossel).
- Checkbox móvel com área de 44 px; barra de lote fixa.
- **Registro de auditoria** em frases ("Agendou publicação", "Convidou um membro"…) com detalhe técnico recolhível.

### Analytics, Campanhas, demais
- **Analytics:** seletor de período em largura total e 44 px; "Falhas" leva ao histórico filtrado; tabelas com `table-fixed` + `truncate`; `break-all` no nome do escopo (era a causa do overflow).
- **Campanhas:** cores e link do calendário com área de toque.
- **Esqueleto de carregamento** neutro (cabeçalho + filtros + lista) com shimmer.

## 5. Arquivos modificados

- **Novos:** `src/components/ui/table.tsx`, `src/lib/ui-prefs.ts`, `docs/AUDITORIA-VISUAL-ATELIER-2-0.md`.
- **Alterados:**
  - Base e componentes: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/app/layout.tsx`, `src/components/ui/{button,form,primitives,dialog,toast}.tsx`, `src/components/app/{shell,charts,target-dialog}.tsx`.
  - Páginas: `src/app/app/page.tsx`, `src/app/app/loading.tsx`, `src/app/app/error.tsx`, `src/app/app/studio/studio.tsx`, `src/app/app/accounts/accounts-manager.tsx`, `src/app/app/library/library-manager.tsx`, `src/app/app/calendar/{page,filters,target-chip}.tsx`, `src/app/app/history/history-table.tsx`, `src/app/app/analytics/page.tsx`, `src/app/app/campaigns/campaigns-manager.tsx`, `src/app/page.tsx`.
  - Domínio: `src/lib/domain/status.ts` (adicionados `FORMAT_LABEL` e `AUDIT_LABEL`, só rótulos de UI).
  - Documentação: `PROJECT_STATUS.md`.
- **Não tocados:** motor de jobs, `services/publishing`, `media-rules`, adapters, actions de servidor, migrações, `proxy.ts`, segurança.

## 6. Alterações no design system (resumo)

| Token / componente | Antes | Depois |
|---|---|---|
| `fg-subtle` | #6B6B76 (3,2–3,8:1) | #8A8A95 (≥4,5:1 em bg/surface/surface-2) |
| Borda de campo | `border` #292930 (1,38:1) | `border-input` #62626D (3,05:1) |
| Botão primário | #FF3045 + branco (3,65:1) | #E0142C + branco (4,88:1), hover #CC1027 (5,72:1) |
| Área de toque | — | `touch-hit` ≥44×44 em `pointer: coarse` |
| Campos | 40 px | 40 px (desktop) / 44 px (toque) |
| Diálogo | centralizado | bottom sheet < 640 px |
| Badge | 11 px | 12 px |

## 7. Resultados desktop (1280 / 1366 / 1440 / 1920)

- Sem overflow horizontal em Dashboard, Contas, Histórico, Calendário, Biblioteca e Estúdio. O `-10` medido corresponde à barra de rolagem vertical.
- 1920 px: conteúdo limitado a 1440 px e centralizado (antes 1400 px).
- Barra lateral: 248 px ↔ 72 px. O cookie persiste entre páginas e o servidor renderiza já na largura certa. Em vez da animação da coluna do grid, a troca é instantânea: menos reflow.
- Ordenação de Contas verificada no navegador (asc/desc com `aria-sort`).

## 8. Resultados mobile (320 / 375 / 390)

| Página | 375 px — alvos < 44 / total | Overflow 320 px | Textos < 12 px |
|---|---|---|---|
| Dashboard | 1/18 | 0 | 0 |
| Contas | 1/21 | 0 | 1 (linha "dev:" visível só em desenvolvimento) |
| Biblioteca | 1/21 | 0 | 0 |
| Estúdio | 1/39 | 0 | 0 |
| Calendário | 1/66 (320 px: 1/66) | 0 | 0 |
| Histórico | 1/25 | 0 | 0 |
| Analytics | 1/13 | 0 | 0 |
| Campanhas | 1/20 | 0 | 0 |
| Configurações | 1/10 | 0 | 0 |
| Assinatura | 1/9 | 0 | 0 |

O único alvo restante é o link "Pular para o conteúdo", invisível até receber foco pelo teclado. Configurações foi medida com papel Editor, então sem o formulário de convite.

## 9. Testes executados

- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm test` ✅ (37/37) · `npm run build` ✅.
- Navegador embutido (Chromium, viewport emulada):
  - Medição automatizada de alvos de toque, fontes e overflow em **10 páginas × 375 px** e **10 páginas × 320 px**.
  - Overflow em 1280/1366/1920 px.
- **Funcionais:**
  - Gaveta móvel: abre; 20 × Tab mantém o foco dentro; `Esc` fecha e devolve o foco ao botão "Abrir menu".
  - Barra lateral: atalho `[` alterna e grava o cookie; a renderização recolhida no servidor foi confirmada (72 px).
  - Estúdio (390 px):
    - Selecionar mídia e conta salva o rascunho.
    - "Agendar" abre a confirmação como bottom sheet (alinhada à base, 390 px de largura) com resumo e aviso Demo.
    - "Voltar e editar" fecha **sem enviar**.
    - Recarregar mostra o aviso de rascunho; "Restaurar" recupera 1 mídia e 1 conta.
    - **Nenhuma publicação foi criada nos testes.**
  - Contas: ordenação asc/desc e `aria-sort`.
- **Não executado:** Playwright (não instalado no projeto), leitor de tela real, aparelhos iOS/Android físicos, zoom de 200%, Core Web Vitals.

## 10. Evidências de navegador

Capturas analisadas durante a sessão (não salvas em arquivo):
- Dashboard em 1440 px e 375 px.
- Calendário em 375 px com o minicalendário.
- Estúdio em 375 px, 390 px (com confirmação) e 1440 px com a barra recolhida.
- Gaveta móvel em 320 px.

As evidências objetivas são as medições numéricas das seções 7 e 8.

## 11. Problemas pendentes

- **Exceções de tipografia de 11 px:**
  - Rótulos em caixa-alta monoespaçada (grupos da navegação, "Digital Operations", rótulo "Workspaces").
  - Números e datas dos eixos dos gráficos.
  - `kbd`.
  - São rótulos decorativos ou de eixo; manter ou subir para 12 px é decisão de marca.
- **Ordenação** só em Contas; Histórico e Analytics ainda não ordenam.
- **Ações por linha** (menu "…") nas tabelas e **paleta de comandos ⌘K**: não implementadas.
- **Calendário:** criar a partir do dia e arrastar para reagendar continuam pendentes.
- **Estúdio em assistente por etapas no mobile** (uma etapa por tela): optamos por manter todas as etapas visíveis, com trilha de progresso e âncoras, para não mudar o fluxo validado. Avaliar com usuários reais.
- **Rascunho do Estúdio** fica no navegador (`localStorage`), não sincroniza entre dispositivos.
- **Componentes não criados nesta rodada:** Tabs/Tooltip/Dropdown genéricos reutilizáveis. Existem usos pontuais via Radix (tooltip da barra lateral, dropdown de workspace) e abas próprias em Biblioteca/Calendário/Analytics.
- **Validação com leitor de tela real, zoom de 200% e aparelhos físicos.**
- **Desempenho de navegação (1,4–4,0 s, Auditoria 1.0 #4):** fora do escopo visual desta rodada.

## 12. Próximas prioridades

1. **Rodada 3: desempenho e escala.** Região `sa-east-1`, evitar `getUser` duplo, agregações em SQL e paginação no servidor.
2. **Playwright + axe no CI** nas 7 larguras, para impedir regressões de toque, contraste e overflow.
3. **Produtividade desktop:** ⌘K, menu "…" por linha, ordenação em Histórico/Analytics, arrastar para reagendar.
4. **Teste com operadores reais** do Estúdio no celular (manter a página única ou adotar assistente).
5. **Revisão de marca** das exceções de 11 px.
