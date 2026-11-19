import { NextResponse, type NextRequest } from "next/server";
import { supabaseUserClient } from "@/lib/data/supabase-clients";
import { getDataMode } from "@/lib/env";

/** Troca o `code` do e-mail de confirmação/recuperação do Supabase por uma sessão. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/app";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";
  if (getDataMode() === "supabase" && code) {
    const sb = await supabaseUserClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link_invalido", url.origin));
}
