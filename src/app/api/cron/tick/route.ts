import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { tick } from "@/lib/jobs/runtime";

export const maxDuration = 60;

/**
 * Rodada do motor disparada por agendador externo (Vercel Cron, GitHub Actions, etc.).
 * Alternativa ao worker dedicado (`npm run worker`). Protegido por CRON_SECRET.
 * Limitação: o Vercel Cron no plano Hobby roda no máximo 1x/dia — para produção use o worker
 * dedicado ou um cron externo a cada minuto.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const valid =
    !!secret && auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await tick(`cron-${randomUUID().slice(0, 8)}`);
  return NextResponse.json(result);
}
