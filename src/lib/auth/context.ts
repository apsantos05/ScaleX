import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getRepo } from "@/lib/data";
import { workspaceAccess } from "@/lib/domain/access";
import { getDataMode } from "@/lib/env";
import type { WorkspaceRepository } from "@/lib/data/repository";
import type { Role, User, Workspace, WorkspaceWithRole } from "@/lib/domain/types";
import { getCurrentUser } from "./session";

export const WORKSPACE_COOKIE = "sx_ws";

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

export type AppContext = {
  user: User;
  workspace: Workspace;
  role: Role;
  workspaces: WorkspaceWithRole[];
  repo: WorkspaceRepository;
};

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Resolve usuário + workspace ativo. Usado por páginas autenticadas. */
export const requireWorkspace = cache(async (): Promise<AppContext> => {
  const user = await requireUser();
  const repo = await getRepo();
  const workspaces = await repo.listWorkspacesForUser(user.id);
  if (!workspaces.length) redirect("/onboarding");
  const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const active = workspaces.find((w) => w.id === wanted) ?? workspaces[0]!;
  return { user, workspace: active, role: active.role, workspaces, repo };
});

export class AuthorizationError extends Error {
  constructor(message = "Você não tem permissão para esta ação.") {
    super(message);
  }
}

/** Workspace sem plano ou com o teste vencido: só pode assinar (e exportar/desconectar dados). */
export function isWorkspaceLocked(ws: Workspace): boolean {
  return getDataMode() === "supabase" && workspaceAccess(ws).state === "locked";
}

export class WorkspaceLockedError extends AuthorizationError {
  constructor() {
    super("Seu teste grátis terminou. Assine um plano para continuar usando a ScaleX.");
  }
}

/**
 * Autorização para mutações (Server Actions / Route Handlers): valida sessão, membership
 * revalidada no banco e papel mínimo. Nunca confiar em workspaceId vindo do cliente.
 */
export async function authorize(min: Role = "editor", opts: { allowLocked?: boolean } = {}): Promise<AppContext> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Sessão expirada. Entre novamente.");
  const repo = await getRepo();
  const workspaces = await repo.listWorkspacesForUser(user.id);
  const wanted = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const active = workspaces.find((w) => w.id === wanted) ?? workspaces[0];
  if (!active) throw new AuthorizationError("Nenhum workspace ativo.");
  const membership = await repo.getMembership(active.id, user.id);
  if (!membership || !roleAtLeast(membership.role, min)) throw new AuthorizationError();
  if (!opts.allowLocked && isWorkspaceLocked(membership.workspace)) throw new WorkspaceLockedError();
  return { user, workspace: membership.workspace, role: membership.role, workspaces, repo };
}
