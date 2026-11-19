import { FlaskConical } from "lucide-react";
import { cookies } from "next/headers";
import { Paywall, TrialBanner } from "@/components/app/paywall";
import { AppShell } from "@/components/app/shell";
import { SIDEBAR_COOKIE } from "@/lib/ui-prefs";
import { requireWorkspace, roleAtLeast } from "@/lib/auth/context";
import { caktoOffers, isBillingConfigured } from "@/lib/billing/cakto";
import { workspaceAccess } from "@/lib/domain/access";
import { getDataMode, isDemoMode } from "@/lib/env";
import { signOutAction } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const ctx = await requireWorkspace();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const realMode = getDataMode() === "supabase";
  // Modo demonstração não tem cobrança: nunca bloqueia.
  const access = realMode ? workspaceAccess(ctx.workspace) : ({ state: "paid" } as const);
  const offers = caktoOffers();

  const banner = isDemoMode() ? (
    <div className="flex items-center justify-center gap-2 border-b border-warning/20 bg-warning/5 px-4 py-1.5 text-xs text-warning">
      <FlaskConical className="size-3.5" aria-hidden />
      <span>
        <strong>Modo demonstração</strong> — dados locais, publicações simuladas, sem cobranças.
      </span>
    </div>
  ) : access.state === "trial" ? (
    <TrialBanner access={access} />
  ) : null;

  const locked = access.state === "locked";
  return (
    <>
      <div inert={locked} aria-hidden={locked || undefined}>
        <AppShell
          user={{ name: ctx.user.name, email: ctx.user.email }}
          workspace={{ id: ctx.workspace.id, name: ctx.workspace.name, plan: ctx.workspace.plan }}
          workspaces={ctx.workspaces.map((w) => ({ id: w.id, name: w.name, plan: w.plan }))}
          banner={banner}
          signOut={signOutAction}
          initialCollapsed={collapsed}
        >
          {children}
        </AppShell>
      </div>
      {locked && (
        <Paywall
          reason={access.reason}
          isOwner={roleAtLeast(ctx.role, "owner")}
          billingOn={realMode && isBillingConfigured()}
          purchasable={{ starter: !!offers.starter, pro: !!offers.pro, scale: !!offers.scale }}
          workspaceName={ctx.workspace.name}
          otherWorkspaces={ctx.workspaces.filter((w) => w.id !== ctx.workspace.id).map((w) => ({ id: w.id, name: w.name }))}
          signOut={signOutAction}
        />
      )}
    </>
  );
}
