import { getDataMode } from "@/lib/env";
import { DemoRepository } from "./demo-repository";
import { getDemoStore } from "./demo-store";
import type { SystemRepository } from "./repository";
import { supabaseAdminClient } from "./supabase-admin";
import { SupabaseSystemRepository } from "./supabase-repository";

/** Repositório de sistema (worker/OAuth). Sem dependência de next/headers: roda também no worker Node. */
export function getSystemRepo(): SystemRepository {
  return getDataMode() === "supabase"
    ? new SupabaseSystemRepository(supabaseAdminClient())
    : new DemoRepository(getDemoStore());
}
