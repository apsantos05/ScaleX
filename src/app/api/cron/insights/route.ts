import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDataMode } from "@/lib/env";
import { syncInsights } from "@/lib/insights/sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Coleta de métricas do Instagram, chamada a cada hora pelo pg_cron do Supabase
 * (função trigger_insights_sync). Protegida pelo mesmo CRON_SECRET do motor de publicação.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const valid = !!secret && auth.length === expected.length && timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  if (!valid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (getDataMode() !== "supabase") return NextResponse.json({ skipped: "demo-mode" });
  try {
    return NextResponse.json(await syncInsights());
  } catch (e) {
    console.error(JSON.stringify({ svc: "insights", event: "sync_failed", error: (e as Error).message }));
    return NextResponse.json({ error: "sync-failed" }, { status: 500 });
  }
}
