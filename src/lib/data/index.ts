import "server-only";
import { getDataMode } from "@/lib/env";
import { DemoRepository } from "./demo-repository";
import { getDemoStore } from "./demo-store";
import type { WorkspaceRepository } from "./repository";
import { supabaseUserClient } from "./supabase-clients";
import { SupabaseWorkspaceRepository } from "./supabase-repository";

export { getSystemRepo } from "./system";

/** Repositório no contexto do usuário da requisição atual. */
export async function getRepo(): Promise<WorkspaceRepository> {
  return getDataMode() === "supabase"
    ? new SupabaseWorkspaceRepository(await supabaseUserClient())
    : new DemoRepository(getDemoStore());
}
