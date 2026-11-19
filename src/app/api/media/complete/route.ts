import { NextResponse, type NextRequest } from "next/server";
import { authorize, AuthorizationError } from "@/lib/auth/context";
import { validateUpload } from "@/lib/domain/media-rules";
import { storedObjectExists } from "@/lib/storage";
import { completeSchema } from "../schema";

/** Modo Supabase: registra a mídia após o upload direto, conferindo caminho e existência do objeto. */
export async function POST(request: NextRequest) {
  try {
    const ctx = await authorize("editor");
    const body = completeSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    const d = body.data;
    if (!d.storagePath.startsWith(`${ctx.workspace.id}/`)) {
      return NextResponse.json({ error: "Caminho inválido." }, { status: 403 });
    }
    const check = validateUpload(d);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    if (!(await storedObjectExists(d.storagePath))) {
      return NextResponse.json({ error: "Arquivo não encontrado no storage." }, { status: 400 });
    }
    const media = await ctx.repo.createMedia(ctx.workspace.id, {
      kind: check.kind,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      width: d.width ?? null,
      height: d.height ?? null,
      durationSec: d.durationSec ?? null,
      storagePath: d.storagePath,
      folder: d.folder ?? null,
      tags: [],
      rightsConfirmed: false,
      rightsNote: null,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ media });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Falha ao registrar mídia." }, { status: 500 });
  }
}
