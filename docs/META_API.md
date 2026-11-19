# Instagram / Meta — o que a API oficial permite (levantamento nov/2026)

> Revalide sempre na documentação oficial antes de produção. Alguns números divergem entre páginas da própria Meta.

## Atualização (19/11/2026): login unificado

A Meta **não oferece mais** a "configuração da API com login do Instagram" para apps novos; o app da ScaleX
usa a **API do Instagram com login unificado** (Login do Facebook para Empresas). A ScaleX suporta os dois modos:

| | Login unificado (atual) | Instagram Login (legado) |
|---|---|---|
| Ativado por | `INSTAGRAM_CONFIG_ID` definido | `INSTAGRAM_CONFIG_ID` vazio |
| Autorização | `facebook.com/{v}/dialog/oauth?config_id=…` (sem `scope`) | `instagram.com/oauth/authorize?scope=…` |
| Token | Usuário do sistema, **não expira** (sem renovação) | Longo, 60 dias, renovável |
| Host da API | `graph.facebook.com` | `graph.instagram.com` |
| Contas por autorização | Várias (`/me/assigned_instagram_accounts`) | Uma |
| Permissões obrigatórias | `instagram_basic`, `instagram_content_publish` | `instagram_business_basic`, `instagram_business_content_publish` |

Requisitos: o app precisa estar ligado a um **portfólio empresarial**, e a conta do Instagram deve ser
profissional. Não é preciso Página do Facebook. A configuração atual tem o ID `1122224850703890`,
criada a partir do modelo.

Variáveis na Vercel:
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` e `INSTAGRAM_CONFIG_ID`;
- `TOKEN_ENCRYPTION_KEY` (32 bytes base64);
- `INSTAGRAM_REDIRECT_URI=https://scale-x-kkn5.vercel.app/api/integrations/instagram/callback`, que precisa
  ser igual ao URL salvo na configuração da Meta.

## Caminho original: **Instagram API with Instagram Login** (legado)

| Opção | Requer Página do Facebook? | Host | Uso na ScaleX |
|---|---|---|---|
| Instagram API with **Instagram Login** | Não | `graph.instagram.com` | **Implementado** (`src/lib/integrations/instagram/graph-adapter.ts`) |
| Instagram API with Facebook Login | Sim (conta IG vinculada a uma Página) | `graph.facebook.com` | Não implementado; pode ser adicionado como 2º adapter |

**Escopos solicitados:** `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`.
Para uso por terceiros (clientes da ScaleX) é necessário **App Review** com acesso avançado e **Business Verification** da empresa.

## Tipos de conta

- ✅ Conta profissional **Empresa (BUSINESS)** e **Criador (MEDIA_CREATOR)**.
- ❌ **Contas pessoais não são suportadas** pela API. O callback OAuth rejeita contas não profissionais.

## Publicação (Content Publishing)

Fluxo em 2 etapas: `POST /{ig-user-id}/media` cria um **container** → aguardar `status_code = FINISHED` → `POST /{ig-user-id}/media_publish`.

| Formato | Parâmetros | Regras principais |
|---|---|---|
| Feed (imagem) | `image_url` | **Somente JPEG**, até 8 MB, proporção 4:5 a 1.91:1, largura 320–1440 px |
| Reels | `media_type=REELS`, `video_url` | MP4/MOV (H.264/HEVC), 9:16 recomendado; duração/tamanho: a doc cita de 3 s até 15 min e até 300 MB em uma página e 60 s / 100 MB em outra — **validar** |
| Stories | `media_type=STORIES` | Imagem ou vídeo; **stickers (link, enquete, local) não são suportados**; sem legenda |
| Carrossel | `media_type=CAROUSEL`, `children` | 2 a 10 itens (imagens e/ou vídeos), recortados pela proporção do 1º item; Reels não entram em carrossel |

Outros pontos:
- A mídia precisa estar em **URL pública** — a Meta baixa o arquivo (`cURL`). Por isso a ScaleX gera URL assinada temporária do Supabase Storage; **mídia local (modo demo) não pode ser publicada em contas reais**.
- Containers **expiram em 24 h**; a ScaleX recria automaticamente (`EXPIRED`).
- Limite de **400 containers / 24 h** por conta.
- Vídeo no feed é publicado como **Reels** (o tipo `VIDEO` foi descontinuado para feed).

## Limites de publicação

- A Meta limita publicações via API **por conta em janela móvel de 24 h**: a página de *Content Publishing* fala em **100**, a referência de `content_publishing_limit` em **50**. Carrossel conta como 1.
- A ScaleX: (1) consulta `GET /{ig-user-id}/content_publishing_limit` antes de publicar; (2) aplica um limite próprio **conservador** (`INSTAGRAM_DAILY_PUBLISH_LIMIT`, padrão **25**); (3) executa no máximo **1 job por conta por vez**. Ao atingir o limite o job é **adiado** (sem consumir tentativa), nunca contornado.
- Erros de rate limit de chamadas (códigos 4, 17, 32, 613, HTTP 429) → backoff de 15 min.

## Tokens

- Token curto → troca por **token longo (60 dias)** via `ig_exchange_token`.
- Renovação: `refresh_access_token` (token com ≥ 24 h e ainda válido). O motor renova automaticamente quando faltam < 7 dias.
- Token expirado/revogado (código 190) → conta marcada como **needs_reauth** e publicações falham com mensagem clara.

## Insights

- Métricas por mídia: `reach`, `views`, `likes`, `comments`, `saved`, `shares`, `total_interactions`.
- **`impressions` foi descontinuada** (Graph API v22, abr/2025) e substituída por **`views`**.
- Implementado no adapter (`getMediaInsights`), **ainda sem job de coleta** (ver PROJECT_STATUS.md).

## O que a ScaleX deliberadamente NÃO faz

Automação de login com senha, scraping, proxies rotativos, simulação de comportamento humano, evasão de antispam ou de limites,
publicação em contas pessoais. Tudo passa pelas permissões concedidas via OAuth oficial.

## Políticas de conteúdo

O público inclui o mercado “HOT”. A plataforma deve publicar **somente conteúdo permitido pelas Diretrizes da Comunidade
do Instagram e pelos Termos da Meta** (que proíbem nudez e serviços sexuais). Mitigações implementadas: aceite de termos no
cadastro e **confirmação obrigatória de direitos de uso por mídia** antes de publicar. Recomenda-se revisão jurídica dos Termos de Uso.

Fontes: [Publish Content](https://developers.facebook.com/docs/instagram-platform/content-publishing/) ·
[IG User Media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/) ·
[content_publishing_limit](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit.md) ·
[Media Insights](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/) ·
[Changelog](https://developers.facebook.com/documentation/instagram-platform/changelog)
