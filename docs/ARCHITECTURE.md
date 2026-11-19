# Arquitetura da ScaleX

## Visão geral

```
Navegador ──► Next.js 16 (App Router, Vercel)
               ├─ Páginas (Server Components) ── requireWorkspace() ──► WorkspaceRepository (RLS)
               ├─ Server Actions / Route Handlers ── authorize(role) + Zod ──► serviços de domínio
               ├─ /api/integrations/instagram/*  (OAuth oficial; token criptografado)
               ├─ /api/media/*                   (upload validado; URLs assinadas)
               └─ /api/cron/tick                 (rodada do motor via cron externo, opcional)

Worker Node dedicado (npm run worker) ──► SystemRepository (service role)
   ├─ Agendador: scheduled → queued
   └─ Executor:  queued → processing → published | failed | queued(retry)
                     └─► InstagramAdapter (Graph API oficial | simulador demo)

Supabase: Postgres (RLS por workspace) · Auth · Storage privado (bucket `media`)
```

## Decisões

| Decisão | Motivo | Limitação |
|---|---|---|
| **Next.js 16 sem `cacheComponents`** | Quase todas as rotas dependem da sessão; o modelo dinâmico é mais simples e previsível | Landing poderia ser cacheada; reavaliar depois |
| **Repositório com 2 drivers** (Supabase / Demo JSON) | Permite testar jornadas completas sem credenciais, distinguindo claramente o modo demo | O driver demo não serve para produção (arquivo JSON, lock por diretório) |
| **Target = job** (`publication_targets` com lease) | Um registro por conta: status, tentativas, lease e IDs do provedor no mesmo lugar → atualizações condicionais simples | Logs ficam em `execution_logs` |
| **Postgres como fila** (`FOR UPDATE SKIP LOCKED`) | Sem infraestrutura extra; transacional com os dados; suporta vários workers | Em volume muito alto, migrar para fila dedicada (pg-boss, SQS) |
| **Worker dedicado** separado do app | Vercel não roda processos contínuos; agendador/executor não dependem do navegador | Requer um host Node (Railway, Fly, Render, VM). Alternativa: `/api/cron/tick` por cron externo |
| **Tokens AES-256-GCM** em tabela sem políticas RLS | Tokens nunca chegam ao cliente nem a usuários autenticados; só service role lê | Rotação de `TOKEN_ENCRYPTION_KEY` exige re-criptografia (pendente) |
| **Upload direto ao Storage** (URL assinada) no modo real | Evita o limite de ~4,5 MB do corpo de funções serverless | Validação de magic bytes ocorre só no modo local; no modo real conferimos MIME/tamanho declarados + existência do objeto |

## Multitenancy

- Toda tabela de negócio possui `workspace_id`. Políticas RLS usam `is_member()` (leitura) e `has_role()` (escrita: owner/admin/editor).
- Papéis: `owner` > `admin` > `editor` > `viewer`. Verificados também no servidor (`authorize(min)`), nunca a partir de IDs enviados pelo cliente — o workspace ativo vem de cookie httpOnly e é revalidado contra `workspace_members`.
- `social_account_credentials` não tem nenhuma política: inacessível para `anon`/`authenticated`.
- Storage: objetos em `<workspace_id>/<uuid>.<ext>`, políticas por pasta.

## Motor de publicação — garantias

1. **Idempotência na criação**: o Estúdio gera uma `idempotencyKey` por rascunho; `unique(workspace_id, idempotency_key)` + verificação dentro da transação/lock → reenvios devolvem o mesmo resultado.
2. **Idempotência na execução**: `provider_container_id` é salvo antes do `media_publish`; numa retentativa o container é reutilizado; se já estiver `PUBLISHED`, o job é concluído sem publicar de novo; se `provider_media_id` existe, nada é feito.
3. **Lease**: `locked_by`/`locked_until` (5 min). Escritas do worker são condicionais ao lease; jobs com lease vencido são reivindicados de novo (recuperação após reinício).
4. **Concorrência**: no máximo 1 job em execução por conta; contas diferentes em paralelo.
5. **Erros**: `transient` → backoff exponencial com jitter (30 s → 30 min, máx. 5 tentativas); `rate_limit` → adiado sem consumir tentativa; `permanent`/`auth` → `failed` (auth marca a conta para reconexão).
6. **Logs estruturados** (JSON em stdout) + `execution_logs` por target, sem tokens (`redact`).

## Estrutura de pastas

```
src/
  app/                  rotas (landing, auth, onboarding, /app/*, /api/*)
    app/_actions/       server actions (validação + autorização)
  components/ui/        design system (Button, Field, Card, Badge, Dialog, Toast…)
  components/app/       componentes de produto (shell, gráficos, uploader…)
  lib/domain/           tipos, máquina de estados, schemas Zod, regras de mídia, planos
  lib/data/             interfaces de repositório + drivers Supabase e Demo
  lib/integrations/     adapters (Instagram oficial + simulador)
  lib/jobs/             motor (agendador/executor) e runtime
  lib/services/         casos de uso (agendar, cancelar, reagendar, seed demo)
  lib/security/         criptografia, assinatura, rate limit
  lib/storage/          storage local/Supabase
scripts/worker.ts       worker dedicado
supabase/migrations/    schema versionado + RLS + funções do worker
tests/                  Vitest (motor, domínio, segurança, isolamento)
```
