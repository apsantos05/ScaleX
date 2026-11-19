"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getRepo } from "@/lib/data";
import { authorize, WORKSPACE_COOKIE } from "@/lib/auth/context";
import { getCurrentUser } from "@/lib/auth/session";
import { workspaceSchema } from "@/lib/domain/schemas";
import { seedDemoWorkspace } from "@/lib/services/demo-seed";
import { toError, type Result } from "./result";

async function setActive(id: string) {
  (await cookies()).set(WORKSPACE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 365 * 24 * 3600,
  });
}

export async function createWorkspaceAction(input: { name: string; seedDemo: boolean }): Promise<Result> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Sessão expirada. Entre novamente." };
    const parsed = workspaceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    const repo = await getRepo();
    const ws = await repo.createWorkspace(user.id, parsed.data.name);
    if (input.seedDemo) await seedDemoWorkspace(repo, ws.id);
    await repo.addAudit({ workspaceId: ws.id, actorId: user.id, action: "workspace.created", entity: "workspace", entityId: ws.id, meta: { seedDemo: input.seedDemo } });
    await setActive(ws.id);
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function switchWorkspaceAction(id: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sessão expirada." };
  const repo = await getRepo();
  if (!(await repo.getMembership(id, user.id))) return { ok: false, error: "Workspace não encontrado." };
  await setActive(id);
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function updateWorkspaceAction(input: { name: string }): Promise<Result> {
  try {
    const ctx = await authorize("admin");
    const parsed = workspaceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    await ctx.repo.updateWorkspace(ctx.workspace.id, { name: parsed.data.name });
    await ctx.repo.addAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "workspace.updated", entity: "workspace", entityId: ctx.workspace.id, meta: null });
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function seedDemoAccountsAction(): Promise<Result> {
  try {
    const ctx = await authorize("editor");
    await seedDemoWorkspace(ctx.repo, ctx.workspace.id);
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}
