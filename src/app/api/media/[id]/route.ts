import { NextResponse, type NextRequest } from "next/server";
import { authorize, AuthorizationError } from "@/lib/auth/context";
import { getDataMode } from "@/lib/env";
import { readLocalFile } from "@/lib/storage";

/** Serve mídia local (modo demo) apenas para membros do workspace dono do arquivo. */
export async function GET(_req: NextRequest, { params }: RouteContext<"/api/media/[id]">) {
  try {
    if (getDataMode() === "supabase") return NextResponse.json({ error: "Use URLs assinadas." }, { status: 400 });
    const { id } = await params;
    const ctx = await authorize("viewer", { allowLocked: true });
    const [media] = await ctx.repo.getMediaByIds(ctx.workspace.id, [id]);
    if (!media) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
    const data = await readLocalFile(media.storagePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Length": String(data.length),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Arquivo indisponível." }, { status: 404 });
  }
}
