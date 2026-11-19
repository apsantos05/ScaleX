-- ════════════════════════════════════════════════════════════════════════════
-- Convites de membros e gestão de papéis.
-- O link de convite carrega um token aleatório; o banco guarda só o hash (sha256).
-- Toda alteração de membros passa por funções com regras explícitas:
--   · só owner/admin convidam e gerenciam; só owner mexe em owners
--   · nunca remove/rebaixa o último owner; ninguém altera o próprio papel
--   · o convite só é aceito pelo usuário logado com o mesmo e-mail convidado
-- ════════════════════════════════════════════════════════════════════════════

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (position('@' in email) > 1),
  role public.member_role not null default 'editor' check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.workspace_invitations (workspace_id, created_at desc);

alter table public.workspace_invitations enable row level security;

create policy invitations_select on public.workspace_invitations for select
  using (public.has_role(workspace_id, array['owner','admin']::public.member_role[]));
create policy invitations_insert on public.workspace_invitations for insert
  with check (public.has_role(workspace_id, array['owner','admin']::public.member_role[]) and invited_by = auth.uid());
create policy invitations_update on public.workspace_invitations for update
  using (public.has_role(workspace_id, array['owner','admin']::public.member_role[]));

-- Escrita direta em workspace_members deixa de ser permitida: tudo passa pelas funções abaixo.
drop policy if exists members_manage on public.workspace_members;

-- Pré-visualização do convite para quem tem o link (o convidado ainda não é membro).
create or replace function public.get_invitation_preview(p_token_hash text)
returns table (workspace_name text, role public.member_role, email text, status text)
language sql stable security definer set search_path = public as $$
  select w.name, i.role, i.email,
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'valid'
    end
  from public.workspace_invitations i
  join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = p_token_hash;
$$;

create or replace function public.accept_invitation(p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.workspace_invitations;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into inv from public.workspace_invitations where token_hash = p_token_hash for update;
  if not found then raise exception 'not_found'; end if;
  if inv.revoked_at is not null then raise exception 'revoked'; end if;
  if inv.accepted_at is not null then raise exception 'accepted'; end if;
  if inv.expires_at < now() then raise exception 'expired'; end if;
  if lower(coalesce(auth.email(), '')) <> lower(inv.email) then raise exception 'email_mismatch'; end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  insert into public.audit_logs (workspace_id, actor_id, action, entity, entity_id, meta)
  values (inv.workspace_id, auth.uid(), 'member.joined', 'workspace_member', null, jsonb_build_object('role', inv.role));
  return inv.workspace_id;
end $$;

create or replace function public.set_member_role(p_workspace uuid, p_user uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = public as $$
declare actor_role public.member_role; target_role public.member_role; owners int;
begin
  select role into actor_role from public.workspace_members where workspace_id = p_workspace and user_id = auth.uid();
  if actor_role is null or actor_role not in ('owner', 'admin') then raise exception 'forbidden'; end if;
  if p_user = auth.uid() then raise exception 'self'; end if;
  select role into target_role from public.workspace_members where workspace_id = p_workspace and user_id = p_user for update;
  if target_role is null then raise exception 'not_found'; end if;
  if (target_role = 'owner' or p_role = 'owner') and actor_role <> 'owner' then raise exception 'forbidden'; end if;
  if target_role = 'owner' and p_role <> 'owner' then
    select count(*) into owners from public.workspace_members where workspace_id = p_workspace and role = 'owner';
    if owners <= 1 then raise exception 'last_owner'; end if;
  end if;
  update public.workspace_members set role = p_role where workspace_id = p_workspace and user_id = p_user;
end $$;

create or replace function public.remove_member(p_workspace uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare actor_role public.member_role; target_role public.member_role; owners int;
begin
  select role into actor_role from public.workspace_members where workspace_id = p_workspace and user_id = auth.uid();
  if actor_role is null or actor_role not in ('owner', 'admin') then raise exception 'forbidden'; end if;
  if p_user = auth.uid() then raise exception 'self'; end if;
  select role into target_role from public.workspace_members where workspace_id = p_workspace and user_id = p_user for update;
  if target_role is null then raise exception 'not_found'; end if;
  if target_role = 'owner' then
    if actor_role <> 'owner' then raise exception 'forbidden'; end if;
    select count(*) into owners from public.workspace_members where workspace_id = p_workspace and role = 'owner';
    if owners <= 1 then raise exception 'last_owner'; end if;
  end if;
  delete from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
end $$;

revoke all on function public.get_invitation_preview(text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.set_member_role(uuid, uuid, public.member_role) from public, anon;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.get_invitation_preview(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.member_role) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
