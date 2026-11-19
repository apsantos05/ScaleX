-- ═══════════════════════════════════════════════════════════════════════════
-- Teste grátis do plano Pro por 3 dias. Depois disso o workspace fica bloqueado
-- até um plano ser pago (não existe mais plano gratuito permanente).
--   • workspaces.trial_ends_at preenchido = em teste; ao pagar, vira null.
--   • Bloqueado = plano 'trial' (sem plano) OU teste vencido.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.workspaces add column if not exists trial_ends_at timestamptz;

create or replace function public.workspace_locked(ws public.workspaces)
returns boolean language sql stable as $$
  select ws.plan = 'trial' or (ws.trial_ends_at is not null and ws.trial_ends_at <= now());
$$;

-- Novo workspace: o primeiro de cada pessoa ganha 3 dias de Pro. Workspaces extras de quem
-- já é dono de outro começam sem plano (precisam de assinatura), para o teste não se repetir.
create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspaces language plpgsql security definer set search_path = public as $$
declare ws public.workspaces;
declare final_slug text := p_slug;
declare i int := 2;
declare first_ws boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  first_ws := not exists (select 1 from public.workspace_members m where m.user_id = auth.uid() and m.role = 'owner');
  while exists (select 1 from public.workspaces where slug = final_slug) loop
    final_slug := p_slug || '-' || i; i := i + 1;
  end loop;
  insert into public.workspaces (name, slug, plan, trial_ends_at)
  values (p_name, final_slug, case when first_ws then 'pro'::public.plan_id else 'trial'::public.plan_id end,
          case when first_ws then now() + interval '3 days' else null end)
  returning * into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws.id, auth.uid(), 'owner');
  insert into public.subscriptions (workspace_id, plan, status) values (ws.id, ws.plan, 'trialing');
  return ws;
end $$;

-- Workspaces que já existiam no plano gratuito ganham os mesmos 3 dias de Pro a partir de agora.
update public.workspaces set plan = 'pro', trial_ends_at = now() + interval '3 days' where plan = 'trial';
update public.subscriptions s set plan = 'pro' from public.workspaces w
 where w.id = s.workspace_id and w.trial_ends_at is not null and s.status = 'trialing';

-- Publicações agendadas de workspace bloqueado não saem (ficam agendadas até o pagamento).
create or replace function public.promote_due_targets(p_now timestamptz, p_limit int)
returns int language plpgsql as $$
declare n int;
begin
  with due as (
    select t.id from public.publication_targets t
    join public.workspaces w on w.id = t.workspace_id
    where t.status = 'scheduled' and t.scheduled_at <= p_now
      and not public.workspace_locked(w)
    order by t.scheduled_at
    limit p_limit
    for update of t skip locked
  )
  update public.publication_targets t
     set status = 'queued', next_attempt_at = p_now, updated_at = now()
    from due where t.id = due.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.promote_due_targets(timestamptz, int) from public, anon, authenticated;
