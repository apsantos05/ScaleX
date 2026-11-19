-- ═══════════════════════════════════════════════════════════════════════════
-- Métricas do Instagram (Analytics): por publicação e por conta (seguidores/dia).
-- Coletadas pela API oficial a cada hora por /api/cron/insights (pg_cron + pg_net,
-- mesmos segredos do Vault usados pelo motor de publicação).
-- ═══════════════════════════════════════════════════════════════════════════

create table public.media_insights (
  target_id uuid primary key references public.publication_targets (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  provider_media_id text not null,
  reach integer,
  views integer,
  likes integer,
  comments integer,
  saved integer,
  shares integer,
  -- 'insights' = métricas completas; 'basic' = só curtidas/comentários (sem a permissão de insights)
  source text not null check (source in ('insights', 'basic')),
  last_error text,
  fetched_at timestamptz not null default now()
);
create index on public.media_insights (workspace_id, fetched_at desc);
create index on public.media_insights (social_account_id);

create table public.account_snapshots (
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  day date not null,
  followers_count integer,
  media_count integer,
  primary key (social_account_id, day)
);
create index on public.account_snapshots (workspace_id, day desc);

alter table public.media_insights enable row level security;
alter table public.account_snapshots enable row level security;
-- Leitura para membros do workspace; escrita só pelo servidor (service role).
create policy media_insights_select on public.media_insights for select using (public.is_member(workspace_id));
create policy account_snapshots_select on public.account_snapshots for select using (public.is_member(workspace_id));

create or replace function public.trigger_insights_sync()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'scalex_app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'scalex_cron_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  select net.http_get(
    url := rtrim(v_url, '/') || '/api/cron/insights',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000
  ) into v_request;
  return v_request;
end $$;
revoke all on function public.trigger_insights_sync() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'scalex-insights-sync';
    perform cron.schedule('scalex-insights-sync', '7 * * * *', 'select public.trigger_insights_sync()');
  end if;
end $$;
