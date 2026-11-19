import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/**
 * Cliente service role — ignora RLS. Uso exclusivo do worker e de rotas de servidor
 * (callback OAuth, URLs assinadas). Nunca importar em componentes client.
 */
export function supabaseAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("supabaseAdminClient no navegador é proibido.");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  admin ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
