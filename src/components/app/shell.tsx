"use client";

import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronsUpDown,
  CreditCard,
  Flag,
  History,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  SquarePen,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { switchWorkspaceAction } from "@/app/app/_actions/workspace";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/accounts", label: "Contas", icon: Users },
  { href: "/app/library", label: "Biblioteca", icon: Images },
  { href: "/app/studio", label: "Estúdio", icon: SquarePen },
  { href: "/app/calendar", label: "Calendário", icon: CalendarDays },
  { href: "/app/campaigns", label: "Campanhas", icon: Flag },
  { href: "/app/history", label: "Histórico", icon: History },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
];
const NAV_BOTTOM = [
  { href: "/app/billing", label: "Assinatura", icon: CreditCard },
  { href: "/app/settings", label: "Configurações", icon: Settings },
];

type WS = { id: string; name: string; plan: string };

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const item = ({ href, label, icon: Icon }: (typeof NAV)[number]) => {
    const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2/60 hover:text-fg",
        )}
      >
        {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" aria-hidden />}
        <Icon className={cn("size-4", active ? "text-brand" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
        {label}
      </Link>
    );
  };
  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Navegação do app">
      {NAV.map(item)}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">{NAV_BOTTOM.map(item)}</div>
    </nav>
  );
}

function WorkspaceSwitcher({ current, workspaces }: { current: WS; workspaces: WS[] }) {
  const router = useRouter();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-left text-sm hover:border-border-strong">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand/15 text-xs font-semibold text-brand">
            {current.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{current.name}</span>
            <span className="block text-[11px] capitalize text-fg-subtle">Plano {current.plan}</span>
          </span>
          <ChevronsUpDown className="size-4 text-fg-subtle" aria-hidden />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-60 rounded-xl border border-border bg-surface-2 p-1.5 shadow-2xl animate-fade-in"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-fg-subtle">Workspaces</DropdownMenu.Label>
          {workspaces.map((w) => (
            <DropdownMenu.Item
              key={w.id}
              onSelect={async () => {
                if (w.id === current.id) return;
                const r = await switchWorkspaceAction(w.id);
                if (!r.ok) toast.error(r.error);
                else router.refresh();
              }}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-3"
            >
              <span className="flex-1 truncate">{w.name}</span>
              {w.id === current.id && <Check className="size-4 text-brand" />}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link href="/onboarding" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-fg">
              <Plus className="size-4" /> Novo workspace
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function AppShell({
  user,
  workspace,
  workspaces,
  banner,
  signOut,
  children,
}: {
  user: { name: string; email: string };
  workspace: WS;
  workspaces: WS[];
  banner?: ReactNode;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);


  const sidebar = (
    <div className="flex h-full flex-col gap-4 py-4">
      <div className="flex items-center justify-between px-5">
        <Link href="/app" aria-label="ScaleX — dashboard">
          <Logo />
        </Link>
      </div>
      <div className="px-3">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
      </div>
      <NavLinks onNavigate={() => setMobileOpen(false)} />
      <div className="mx-3 flex items-center gap-2.5 rounded-lg border border-border p-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-semibold">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-[11px] text-fg-subtle">{user.email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sair" title="Sair">
            <LogOut />
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r border-border bg-surface/50 lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-surface animate-rise">
            <Button variant="ghost" size="icon-sm" className="absolute right-3 top-4" onClick={() => setMobileOpen(false)} aria-label="Fechar menu">
              <X />
            </Button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
            <Menu />
          </Button>
          <Logo />
        </header>
        {banner}
        <main id="conteudo" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
