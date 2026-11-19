-- ═══════════════════════════════════════════════════════════════════════════
-- Todos os posts das contas conectadas (feitos pela ScaleX ou direto no Instagram),
-- com as métricas oficiais. Preenchido pela coleta de hora em hora (/api/cron/insights).
-- ═══════════════════════════════════════════════════════════════════════════

create table public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  provider_media_id text not null,
  media_type text,          -- IMAGE, VIDEO, CAROUSEL_ALBUM
  product_type text,        -- FEED, REELS, STORY
  caption text,
  permalink text,
  posted_at timestamptz not null,
  via_scalex boolean not null default false,
  reach integer,
  views integer,
  likes integer,
  comments integer,
  saved integer,
  shares integer,
  source text not null default 'basic' check (source in ('insights', 'basic')),
  last_error text,
  metrics_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (social_account_id, provider_media_id)
);
create index on public.instagram_posts (workspace_id, posted_at desc);
create index on public.instagram_posts (metrics_fetched_at nulls first);

alter table public.instagram_posts enable row level security;
-- Leitura para membros do workspace; escrita só pelo servidor (service role).
create policy instagram_posts_select on public.instagram_posts for select using (public.is_member(workspace_id));
