"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/context";
import { captionTemplateSchema, mediaMetaSchema } from "@/lib/domain/schemas";
import { deleteStoredFiles } from "@/lib/storage";
import { toError, type Result } from "./result";

export async function updateMediaAction(ids: string[], patch: unknown): Promise<Result> {
  try {
    const ctx = await authorize("editor");
    const parsed = mediaMetaSchema.safeParse(patch);
    if (!parsed.success || !ids.length) return { ok: false, error: "Dados inválidos." };
    await ctx.repo.updateMedia(ctx.workspace.id, ids, parsed.data);
    if (parsed.data.rightsConfirmed !== undefined) {
      await ctx.repo.addAudit({
        workspaceId: ctx.workspace.id,
        actorId: ctx.user.id,
        action: parsed.data.rightsConfirmed ? "media.rights_confirmed" : "media.rights_revoked",
        entity: "media_asset",
        entityId: ids.length === 1 ? ids[0]! : null,
        meta: { count: ids.length },
      });
    }
    revalidatePath("/app/library");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function deleteMediaAction(ids: string[]): Promise<Result> {
  try {
    const ctx = await authorize("editor");
    // Bloqueia exclusão de mídia usada por publicações pendentes.
    const pending = await ctx.repo.listTargets(ctx.workspace.id, { statuses: ["draft", "scheduled", "queued", "processing"] });
    const inUse = ids.filter((id) => pending.some((t) => t.mediaIds.includes(id)));
    if (inUse.length) {
      return { ok: false, error: `${inUse.length} mídia(s) estão em publicações pendentes. Cancele-as antes de excluir.` };
    }
    const removed = await ctx.repo.deleteMedia(ctx.workspace.id, ids);
    await deleteStoredFiles(removed.map((m) => m.storagePath));
    await ctx.repo.addAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "media.deleted", entity: "media_asset", entityId: null, meta: { count: removed.length } });
    revalidatePath("/app/library");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function createCaptionAction(input: { title: string; body: string }): Promise<Result> {
  try {
    const ctx = await authorize("editor");
    const parsed = captionTemplateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    await ctx.repo.createCaption(ctx.workspace.id, parsed.data);
    revalidatePath("/app/library");
    revalidatePath("/app/studio");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function deleteCaptionAction(id: string): Promise<Result> {
  try {
    const ctx = await authorize("editor");
    await ctx.repo.deleteCaption(ctx.workspace.id, id);
    revalidatePath("/app/library");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}
