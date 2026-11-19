"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/context";
import { campaignSchema } from "@/lib/domain/schemas";
import { cancelTargets, rescheduleTarget, schedulePublication, type ScheduleResult } from "@/lib/services/publishing";
import { toError, type Result } from "./result";

export async function schedulePublicationAction(input: unknown): Promise<ScheduleResult> {
  try {
    const ctx = await authorize("editor");
    const r = await schedulePublication(ctx.repo, { workspace: ctx.workspace, userId: ctx.user.id }, input);
    if (r.ok) {
      revalidatePath("/app", "layout");
    }
    return r;
  } catch (e) {
    return toError(e);
  }
}

export async function cancelTargetsAction(ids: string[]): Promise<Result<{ cancelled: number; skipped: number }>> {
  try {
    const ctx = await authorize("editor");
    const r = await cancelTargets(ctx.repo, { workspaceId: ctx.workspace.id, userId: ctx.user.id }, ids);
    revalidatePath("/app", "layout");
    return { ok: true, data: r };
  } catch (e) {
    return toError(e);
  }
}

export async function rescheduleTargetAction(id: string, whenIso: string): Promise<Result> {
  try {
    const ctx = await authorize("editor");
    const r = await rescheduleTarget(ctx.repo, { workspaceId: ctx.workspace.id, userId: ctx.user.id }, id, new Date(whenIso));
    if (!r.ok) return { ok: false, error: r.error ?? "Falha ao reagendar." };
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function getTargetLogsAction(id: string) {
  try {
    const ctx = await authorize("viewer", { allowLocked: true });
    const logs = await ctx.repo.listLogs(ctx.workspace.id, id);
    return { ok: true as const, data: logs };
  } catch (e) {
    return toError(e);
  }
}

export async function createCampaignAction(input: { name: string; color: string; description?: string }): Promise<Result> {
  try {
    const ctx = await authorize("editor");
    const parsed = campaignSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    await ctx.repo.createCampaign(ctx.workspace.id, parsed.data);
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function deleteCampaignAction(id: string): Promise<Result> {
  try {
    const ctx = await authorize("admin");
    await ctx.repo.deleteCampaign(ctx.workspace.id, id);
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}
