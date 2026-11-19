import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorize, AuthorizationError } from "@/lib/auth/context";
import { validateUpload } from "@/lib/domain/media-rules";
import { planLimits } from "@/lib/domain/plans";
import { getDataMode } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { buildStoragePath, saveLocalFile, sniffMime } from "@/lib/storage";
import { mediaUploadMetaSchema } from "../schema";

/** Upload local (modo demo). No modo Supabase o navegador envia direto ao Storage (intent/complete). */
export async function POST(request: NextRequest) {
  try {
    if (getDataMode() === "supabase") {
      return NextResponse.json({ error: "Use o upload direto (intent/complete)." }, { status: 400 });
    }
    const ctx = await authorize("editor");
    const rl = rateLimit(`upload:${ctx.user.id}`, 120, 10 * 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Muitos uploads. Aguarde alguns minutos." }, { status: 429 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
    let rawMeta: unknown = {};
    try {
      rawMeta = JSON.parse(String(form.get("meta") ?? "{}"));
    } catch {
      return NextResponse.json({ error: "Metadados inválidos." }, { status: 400 });
    }
    const meta = mediaUploadMetaSchema.safeParse(rawMeta);
    if (!meta.success) return NextResponse.json({ error: "Metadados inválidos." }, { status: 400 });

    const check = validateUpload({ mimeType: file.type, sizeBytes: file.size });
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffMime(buf);
    if (!sniffed || sniffed.split("/")[0] !== file.type.split("/")[0]) {
      return NextResponse.json({ error: "O conteúdo do arquivo não corresponde ao formato informado." }, { status: 400 });
    }

    const used = await ctx.repo.storageUsedBytes(ctx.workspace.id);
    if (used + file.size > planLimits(ctx.workspace.plan).maxStorageMb * 1024 * 1024) {
      return NextResponse.json({ error: "Limite de armazenamento do plano atingido." }, { status: 403 });
    }

    const storagePath = buildStoragePath(ctx.workspace.id, randomUUID(), sniffed);
    await saveLocalFile(storagePath, buf);
    const media = await ctx.repo.createMedia(ctx.workspace.id, {
      kind: check.kind,
      fileName: file.name.slice(0, 200),
      mimeType: sniffed,
      sizeBytes: file.size,
      width: meta.data.width ?? null,
      height: meta.data.height ?? null,
      durationSec: meta.data.durationSec ?? null,
      storagePath,
      folder: meta.data.folder ?? null,
      tags: [],
      rightsConfirmed: false,
      rightsNote: null,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ media });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    console.error(JSON.stringify({ svc: "upload", error: (e as Error).message }));
    return NextResponse.json({ error: "Falha no upload." }, { status: 500 });
  }
}
