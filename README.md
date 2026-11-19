# ScaleX

Central de operações de marketing orgânico: contas profissionais do Instagram conectadas via OAuth oficial,
biblioteca de mídia privada, publicação em lote, calendário editorial e um motor de jobs confiável.

> Status detalhado: [PROJECT_STATUS.md](PROJECT_STATUS.md) · Arquitetura: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
> Limites da API da Meta: [docs/META_API.md](docs/META_API.md)

## Rodando localmente (modo demonstração)

Sem nenhuma variável de ambiente a aplicação roda em **modo demo**: banco JSON local em `.data/`, contas demo e publicações
**simuladas** (nada é enviado ao Instagram, nenhuma cobrança).

```bash
npm install
npm run dev          # http://localhost:3000
npm run worker       # em outro terminal: processa a fila a cada 10 s
```

1. Crie uma conta em `/signup` e um workspace (marque “Adicionar contas de demonstração”).
2. Envie imagens JPEG na **Biblioteca** e confirme os direitos de uso.
3. No **Estúdio**, escolha formato, mídia, legenda e contas e agende.
4. Acompanhe no **Calendário** e no **Histórico** (`npm run worker -- --once` executa uma única rodada).

Para zerar o modo demo, apague a pasta `.data/`.

## Modo real

1. Copie `.env.example` para `.env.local` e preencha Supabase, Meta e chaves.
2. Aplique a migração: `npx supabase link` e `npx supabase db push`.
3. Configure no Supabase Auth as URLs de redirect (`/auth/callback`).
4. Rode o worker em um host Node (ou configure um cron chamando `GET /api/cron/tick` com `Authorization: Bearer $CRON_SECRET`).

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run worker` | Worker de publicação (`-- --once` para uma rodada) |
| `npm test` | Testes (Vitest) |
| `npm run lint` / `npm run typecheck` | Qualidade |

## Princípios

Somente APIs oficiais e permissões concedidas. Sem automação de login, proxies, simulação de comportamento humano ou evasão de limites.
Nenhum indicador inventado: o que não vem de dados reais é rotulado como demonstração ou “indisponível”.
