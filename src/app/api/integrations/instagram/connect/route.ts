import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorize, AuthorizationError } from "@/lib/auth/context";
import { planLimits } from "@/lib/domain/plans";
import { sessionSecret } from "@/lib/env";
import { getGraphAdapter } from "@/lib/integrations/instagram";
import { sign } from "@/lib/security/crypto";

const OAUTH_NONCE_COOKIE = "sx_ig_nonce";

/** Inicia o OAuth oficial do Instagram (Instagram API with Instagram Login). */
export async function GET(request: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/app/accounts?${q}`, request.url));
  try {
    const ctx = await authorize("editor");
    const adapter = getGraphAdapter();
    if (!adapter) return back("error=integracao_nao_configurada");
    const count = (await ctx.repo.listAccounts(ctx.workspace.id)).filter((a) => !a.isDemo).length;
    if (count >= planLimits(ctx.workspace.plan).maxAccounts) return back("error=limite_de_contas");

    const nonce = randomBytes(16).toString("base64url");
    const state = sign({ ws: ctx.workspace.id, uid: ctx.user.id, nonce, exp: Date.now() + 10 * 60_000 }, sessionSecret());
    const res = NextResponse.redirect(adapter.authorizeUrl(state));
    res.cookies.set(OAUTH_NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/integrations/instagram",
      maxAge: 600,
    });
    return res;
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.redirect(new URL("/login", request.url));
    return back("error=falha_ao_iniciar");
  }
}
