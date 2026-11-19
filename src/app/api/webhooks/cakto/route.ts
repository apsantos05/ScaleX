import { NextResponse, type NextRequest } from "next/server";
import { verifyCaktoDelivery, type CaktoPayload } from "@/lib/billing/cakto";
import { processCaktoPayload } from "@/lib/billing/process";
import { getDataMode } from "@/lib/env";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 256 * 1024;

/**
 * Webhook da Cakto. A origem é validada pela assinatura HMAC do header (ou pelo `secret`
 * do corpo, formato antigo). A Cakto exige resposta em até 8 s e só reenvia sozinha em
 * caso de erro de rede/timeout — por isso falhas de processamento respondem 500 (aparecem
 * como falha no histórico da Cakto, de onde podem ser reenviadas) e nunca expõem detalhes.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CAKTO_WEBHOOK_SECRET ?? "";
  if (!secret || getDataMode() !== "supabase") {
    return NextResponse.json({ error: "billing-not-configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return NextResponse.json({ error: "payload-too-large" }, { status: 413 });

  let payload: CaktoPayload;
  try {
    payload = JSON.parse(rawBody) as CaktoPayload;
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const auth = verifyCaktoDelivery({
    rawBody,
    timestamp: request.headers.get("x-cakto-timestamp"),
    signature: request.headers.get("x-cakto-signature"),
    bodySecret: payload.secret,
    secret,
  });
  if (!auth.ok) {
    console.warn(JSON.stringify({ svc: "cakto-webhook", rejected: auth.reason }));
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const results = await processCaktoPayload(payload);
    console.info(JSON.stringify({ svc: "cakto-webhook", event: payload.event, via: auth.method, results }));
    return NextResponse.json({ received: true, results: results.map((r) => ({ orderId: r.orderId, outcome: r.outcome })) });
  } catch (e) {
    console.error(JSON.stringify({ svc: "cakto-webhook", event: payload.event, error: (e as Error).message }));
    return NextResponse.json({ error: "processing-failed" }, { status: 500 });
  }
}
