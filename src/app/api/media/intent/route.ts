import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorize, AuthorizationError } from "@/lib/auth/context";
import { validateUpload } from "@/lib/domain/media-rules";
import { planLimits } from "@/lib/domain/plans";
import { getDataMode } from "@/lib/env";
import { rateLimit } from "@/lib/security/rate-limit";
import { buildStoragePath, createSignedUpload } from "@/lib/storage";
import { intentSchema } from "../schema";

/** Modo Supabase: valida e devolve URL de upload assinada (o arquivo não passa pela função serverless). */
export async function POST(request: NextRequest) {
  try {
    if (getDataMode() !== "supabase") return NextResponse.json({ strategy: "local" });
    const ctx = await authorize("editor");
    const rl = rateLimit(`upload:${ctx.user.id}`, 120, 10 * 60_000);
    if (!rl.ok) return NextResponse.json({ error: "Muitos uploads. Aguarde alguns minutos." }, { status: 429 });
    const body = intentSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    const check = validateUpload(body.data);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    const used = await ctx.repo.storageUsedBytes(ctx.workspace.id);
    if (used + body.data.sizeBytes > planLimits(ctx.workspace.plan).maxStorageMb * 1024 * 1024) {
      return NextResponse.json({ error: "Limite de armazenamento do plano atingido." }, { status: 403 });
    }
    const storagePath = buildStoragePath(ctx.workspace.id, randomUUID(), body.data.mimeType);
    const signed = await createSignedUpload(storagePath);
    return NextResponse.json({ strategy: "supabase", storagePath, ...signed });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Falha ao preparar upload." }, { status: 500 });
  }
}
