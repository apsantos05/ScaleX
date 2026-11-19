-- ════════════════════════════════════════════════════════════════════════════
-- Motor de publicação em produção: o próprio Supabase chama /api/cron/tick
-- a cada minuto (pg_cron + pg_net). URL e segredo ficam no Vault — nunca no repo.
--
-- Configuração única (fora desta migração, pois contém segredo):
--   select vault.create_secret('https://SEU-DOMINIO', 'scalex_app_url');
--   select vault.create_secret('<CRON_SECRET>',       'scalex_cron_secret');
-- Sem esses dois segredos a função apenas não faz nada.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.trigger_publish_tick()
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
    url := rtrim(v_url, '/') || '/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000
  ) into v_request;
  return v_request;
end $$;

revoke all on function public.trigger_publish_tick() from public, anon, authenticated;

-- (Re)agenda de forma idempotente.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'scalex-publish-tick') then
    perform cron.unschedule('scalex-publish-tick');
  end if;
  perform cron.schedule('scalex-publish-tick', '* * * * *', 'select public.trigger_publish_tick()');
end $$;
