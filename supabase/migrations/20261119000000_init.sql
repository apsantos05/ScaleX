-- ════════════════════════════════════════════════════════════════════════════
-- ScaleX — schema inicial (multitenant com RLS)
-- Toda tabela de negócio carrega workspace_id e é isolada por políticas RLS
-- baseadas em public.is_member(). Credenciais OAuth ficam em tabela sem
-- nenhuma política para `authenticated` (acesso somente via service role).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ───────────── Tipos ─────────────
create type public.member_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.plan_id as enum ('trial', 'starter', 'pro', 'scale');
create type public.account_status as enum ('active', 'needs_reauth', 'disconnected', 'error');
create type public.media_kind as enum ('image', 'video');
create type public.publish_format as enum ('FEED', 'REELS', 'STORIES', 'CAROUSEL');
create type public.target_status as enum ('draft', 'scheduled', 'queued', 'processing', 'published', 'failed', 'cancelled');
create type public.error_kind as enum ('transient', 'permanent', 'auth', 'rate_limit');
create type public.log_level as enum ('info', 'warn', 'error');

-- ───────────── Perfis ─────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────── Workspaces ─────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  slug text not null unique,
  plan public.plan_id not null default 'trial',
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

-- Funções auxiliares de autorização (security definer evita recursão de RLS).
create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

create or replace function public.has_role(ws uuid, roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

-- Cria workspace + membership owner atomicamente para o usuário autenticado.
create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare ws public.workspaces;
declare final_slug text := p_slug;
declare i int := 2;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  while exists (select 1 from public.workspaces where slug = final_slug) loop
    final_slug := p_slug || '-' || i; i := i + 1;
  end loop;
  insert into public.workspaces (name, slug) values (p_name, final_slug) returning * into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws.id, auth.uid(), 'owner');
  insert into public.subscriptions (workspace_id) values (ws.id);
  return ws;
end $$;

-- ───────────── Contas sociais ─────────────
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null default 'instagram' check (provider in ('instagram')),
  provider_account_id text not null,
  username text not null,
  display_name text not null default '',
  avatar_url text,
  account_type text,
  status public.account_status not null default 'active',
  scopes text[] not null default '{}',
  tags text[] not null default '{}',
  "group" text,
  followers_count integer,
  last_synced_at timestamptz,
  token_expires_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, provider_account_id)
);
create index on public.social_accounts (workspace_id);

-- Tokens criptografados (AES-256-GCM na aplicação). SEM políticas para authenticated.
create table public.social_account_credentials (
  account_id uuid primary key references public.social_accounts (id) on delete cascade,
  ciphertext text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ───────────── Biblioteca ─────────────
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.media_kind not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width integer,
  height integer,
  duration_sec numeric,
  storage_path text not null unique,
  folder text,
  tags text[] not null default '{}',
  rights_confirmed boolean not null default false,
  rights_note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.media_assets (workspace_id, created_at desc);

create table public.caption_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null,
  body text not null check (char_length(body) <= 2200),
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  color text not null default '#FF3045',
  description text,
  created_at timestamptz not null default now()
);

-- ───────────── Publicações e fila ─────────────
create table public.publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  media_ids uuid[] not null,
  caption text not null default '' check (char_length(caption) <= 2200),
  format public.publish_format not null,
  scheduled_at timestamptz not null,
  idempotency_key uuid not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table public.publication_targets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  publication_id uuid not null references public.publications (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  status public.target_status not null default 'scheduled',
  scheduled_at timestamptz not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz,
  locked_by text,
  locked_until timestamptz,
  provider_container_id text,
  provider_media_id text,
  permalink text,
  last_error text,
  error_kind public.error_kind,
  simulated boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, social_account_id)
);
create index on public.publication_targets (workspace_id, scheduled_at desc);
create index on public.publication_targets (status, scheduled_at) where status = 'scheduled';
create index on public.publication_targets (status, next_attempt_at) where status in ('queued', 'processing');
create index on public.publication_targets (social_account_id, published_at) where status = 'published';

create table public.execution_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  target_id uuid not null references public.publication_targets (id) on delete cascade,
  at timestamptz not null default now(),
  level public.log_level not null default 'info',
  event text not null,
  message text not null,
  data jsonb
);
create index on public.execution_logs (target_id, at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  meta jsonb,
  at timestamptz not null default now()
);
create index on public.audit_logs (workspace_id, at desc);

-- ───────────── Assinaturas (estrutura; cobrança NÃO ativada) ─────────────
create table public.subscriptions (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  plan public.plan_id not null default 'trial',
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'BRL',
  status text not null,
  issued_at timestamptz not null default now(),
  provider_invoice_id text
);

-- ════════════════════════════ RLS ════════════════════════════
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_account_credentials enable row level security;
alter table public.media_assets enable row level security;
alter table public.caption_templates enable row level security;
alter table public.campaigns enable row level security;
alter table public.publications enable row level security;
alter table public.publication_targets enable row level security;
alter table public.execution_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;

-- Perfis: o próprio usuário e colegas de workspace.
create policy profiles_self on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy profiles_update_self on public.profiles for update using (id = auth.uid());

create policy ws_select on public.workspaces for select using (public.is_member(id));
create policy ws_update on public.workspaces for update using (public.has_role(id, array['owner','admin']::public.member_role[]));

create policy members_select on public.workspace_members for select using (public.is_member(workspace_id));
create policy members_manage on public.workspace_members for all
  using (public.has_role(workspace_id, array['owner','admin']::public.member_role[]))
  with check (public.has_role(workspace_id, array['owner','admin']::public.member_role[]));

-- Macro de políticas: leitura para membros, escrita para owner/admin/editor.
do $$
declare t text;
begin
  foreach t in array array['social_accounts','media_assets','caption_templates','campaigns','publications','publication_targets']
  loop
    execute format('create policy %1$s_select on public.%1$s for select using (public.is_member(workspace_id))', t);
    execute format($p$create policy %1$s_insert on public.%1$s for insert with check (public.has_role(workspace_id, array['owner','admin','editor']::public.member_role[]))$p$, t);
    execute format($p$create policy %1$s_update on public.%1$s for update using (public.has_role(workspace_id, array['owner','admin','editor']::public.member_role[]))$p$, t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete using (public.has_role(workspace_id, array['owner','admin','editor']::public.member_role[]))$p$, t);
  end loop;
end $$;

create policy logs_select on public.execution_logs for select using (public.is_member(workspace_id));
create policy audit_select on public.audit_logs for select using (public.is_member(workspace_id));
create policy audit_insert on public.audit_logs for insert with check (public.is_member(workspace_id) and actor_id = auth.uid());
create policy subs_select on public.subscriptions for select using (public.is_member(workspace_id));
create policy invoices_select on public.invoices for select using (public.has_role(workspace_id, array['owner','admin']::public.member_role[]));
-- social_account_credentials: nenhuma política → inacessível para anon/authenticated.

-- ════════════════════════════ Funções do worker ════════════════════════════
-- Executadas somente com service role (revogadas de anon/authenticated).

create or replace function public.promote_due_targets(p_now timestamptz, p_limit int)
returns int language plpgsql as $$
declare n int;
begin
  with due as (
    select id from public.publication_targets
    where status = 'scheduled' and scheduled_at <= p_now
    order by scheduled_at
    limit p_limit
    for update skip locked
  )
  update public.publication_targets t
     set status = 'queued', next_attempt_at = p_now, updated_at = now()
    from due where t.id = due.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- Reivindica jobs com lease. FOR UPDATE SKIP LOCKED permite vários workers em paralelo;
-- DISTINCT ON garante no máximo 1 job por conta por rodada e contas com job ativo são ignoradas.
create or replace function public.claim_publication_targets(p_worker text, p_now timestamptz, p_lease_ms int, p_limit int)
returns setof public.publication_targets language plpgsql as $$
begin
  return query
  with busy as (
    select distinct social_account_id from public.publication_targets
    where status = 'processing' and locked_until > p_now
  ),
  ready as (
    select t.id, t.social_account_id, coalesce(t.next_attempt_at, t.scheduled_at) as ord
    from public.publication_targets t
    where ((t.status = 'queued' and (t.next_attempt_at is null or t.next_attempt_at <= p_now))
        or (t.status = 'processing' and (t.locked_until is null or t.locked_until <= p_now)))
      and t.social_account_id not in (select social_account_id from busy)
    order by ord
    limit p_limit * 5
    for update skip locked
  ),
  one_per_account as (
    select distinct on (social_account_id) id, ord from ready order by social_account_id, ord
  ),
  picked as (select id from one_per_account order by ord limit p_limit)
  update public.publication_targets t
     set status = 'processing',
         locked_by = p_worker,
         locked_until = p_now + make_interval(secs => p_lease_ms / 1000.0),
         updated_at = now()
    from picked where t.id = picked.id
  returning t.*;
end $$;

revoke all on function public.promote_due_targets(timestamptz, int) from public, anon, authenticated;
revoke all on function public.claim_publication_targets(text, timestamptz, int, int) from public, anon, authenticated;

-- Cria publicação + targets atomicamente, idempotente por (workspace_id, idempotency_key).
create or replace function public.create_publication(
  p_workspace uuid, p_campaign uuid, p_media uuid[], p_caption text, p_format public.publish_format,
  p_scheduled_at timestamptz, p_key uuid, p_accounts uuid[], p_status public.target_status
) returns uuid language plpgsql security invoker as $$
declare pub_id uuid;
begin
  if not public.has_role(p_workspace, array['owner','admin','editor']::public.member_role[]) then
    raise exception 'forbidden';
  end if;
  insert into public.publications (workspace_id, campaign_id, media_ids, caption, format, scheduled_at, idempotency_key, created_by)
  values (p_workspace, p_campaign, p_media, p_caption, p_format, p_scheduled_at, p_key, auth.uid())
  on conflict (workspace_id, idempotency_key) do nothing
  returning id into pub_id;
  if pub_id is null then
    select id into pub_id from public.publications where workspace_id = p_workspace and idempotency_key = p_key;
    return pub_id;
  end if;
  insert into public.publication_targets (workspace_id, publication_id, social_account_id, status, scheduled_at)
  select p_workspace, pub_id, a.id, p_status, p_scheduled_at
  from public.social_accounts a
  where a.workspace_id = p_workspace and a.id = any (p_accounts);
  return pub_id;
end $$;

-- ───────────── Storage ─────────────
-- Bucket privado; caminho: <workspace_id>/<uuid>.<ext>
insert into storage.buckets (id, name, public) values ('media', 'media', false)
on conflict (id) do nothing;

create policy media_read on storage.objects for select
  using (bucket_id = 'media' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy media_write on storage.objects for insert
  with check (bucket_id = 'media' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner','admin','editor']::public.member_role[]));
create policy media_delete on storage.objects for delete
  using (bucket_id = 'media' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner','admin','editor']::public.member_role[]));
