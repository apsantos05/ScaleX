import { FlaskConical } from "lucide-react";
import { cookies } from "next/headers";
import { AppShell } from "@/components/app/shell";
import { SIDEBAR_COOKIE } from "@/lib/ui-prefs";
import { requireWorkspace } from "@/lib/auth/context";
import { isDemoMode } from "@/lib/env";
import { signOutAction } from "../(auth)/actions";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const ctx = await requireWorkspace();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const banner = isDemoMode() ? (
    <div className="flex items-center justify-center gap-2 border-b border-warning/20 bg-warning/5 px-4 py-1.5 text-xs text-warning">
      <FlaskConical className="size-3.5" aria-hidden />
      <span>
        <strong>Modo demonstração</strong> — dados locais, publicações simuladas, sem cobranças.
      </span>
    </div>
  ) : null;
  return (
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
  );
}
