-- ═══════════════════════════════════════════════════════════════════════════
-- Cobrança via Cakto: sessões de checkout, eventos de webhook (idempotentes),
-- faturas e proteção do campo `plan` contra alteração pelo próprio cliente.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) SEGURANÇA: a policy ws_update permitia que owner/admin alterassem QUALQUER coluna de
--    workspaces pela API do PostgREST — inclusive `plan` (auto-upgrade sem pagar).
--    A partir daqui, usuários só podem alterar o nome; o plano muda apenas pelo servidor (service role).
revoke update on public.workspaces from anon, authenticated;
grant update (name) on public.workspaces to authenticated;

-- 2) Sessões de checkout: liga o token opaco enviado à Cakto (?callback=) ao workspace e ao plano.
--    Sem policies: só o servidor (service role) lê e escreve.
create table public.billing_checkouts (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{20,64}$'),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  plan public.plan_id not null check (plan <> 'trial'),
  offer_id text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.billing_checkouts (workspace_id, created_at desc);
alter table public.billing_checkouts enable row level security;

-- 3) Eventos recebidos da Cakto: deduplicação (retentativas) e trilha de auditoria.
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'cakto',
  event_key text not null unique,
  event text not null,
  order_id text,
  workspace_id uuid references public.workspaces (id) on delete set null,
  outcome text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index on public.billing_events (workspace_id, received_at desc);
alter table public.billing_events enable row level security;

-- 4) Assinaturas: oferta, último evento e status "paused".
alter table public.subscriptions add column if not exists provider_offer_id text;
alter table public.subscriptions add column if not exists last_event_at timestamptz;
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled'));
create index if not exists subscriptions_provider_sub_idx on public.subscriptions (provider_subscription_id);

-- 5) Faturas: um registro por pedido da Cakto (renovações geram pedidos novos).
create unique index if not exists invoices_provider_invoice_uidx on public.invoices (provider_invoice_id);
alter table public.invoices add column if not exists description text;

-- 6) Fim do período após cancelamento: o acesso pago vale até current_period_end;
--    depois disso o workspace volta ao Trial. Roda diariamente.
create or replace function public.expire_canceled_subscriptions() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with expired as (
    update public.subscriptions s
       set plan = 'trial', updated_at = now()
     where s.status = 'canceled'
       and s.plan <> 'trial'
       and s.current_period_end is not null
       and s.current_period_end < now()
    returning s.workspace_id
  )
  update public.workspaces w set plan = 'trial'
    from expired e where w.id = e.workspace_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.expire_canceled_subscriptions() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'scalex-expire-subscriptions';
    perform cron.schedule('scalex-expire-subscriptions', '17 3 * * *', 'select public.expire_canceled_subscriptions()');
  end if;
end $$;
