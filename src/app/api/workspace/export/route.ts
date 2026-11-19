import { NextResponse } from "next/server";
import { authorize, AuthorizationError } from "@/lib/auth/context";

/** LGPD: exportação dos dados do workspace (sem credenciais). Restrito ao proprietário. */
export async function GET() {
  try {
    const ctx = await authorize("owner");
    const ws = ctx.workspace.id;
    const [members, accounts, media, captions, campaigns, targets, audit] = await Promise.all([
      ctx.repo.listMembers(ws),
      ctx.repo.listAccounts(ws),
      ctx.repo.listMedia(ws),
      ctx.repo.listCaptions(ws),
      ctx.repo.listCampaigns(ws),
      ctx.repo.listTargets(ws),
      ctx.repo.listAudit(ws, 1000),
    ]);
    await ctx.repo.addAudit({ workspaceId: ws, actorId: ctx.user.id, action: "workspace.exported", entity: "workspace", entityId: ws, meta: null });
    const body = JSON.stringify(
      { exportedAt: new Date().toISOString(), workspace: ctx.workspace, members, accounts, media, captions, campaigns, publications: targets, audit },
      null,
      2,
    );
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="scalex-${ctx.workspace.slug}-export.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: "Falha na exportação." }, { status: 500 });
  }
}
