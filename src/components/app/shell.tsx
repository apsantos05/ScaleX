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
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  SquarePen,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DropdownMenu, Tooltip } from "radix-ui";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BladeMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { Kbd, Logo } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { SIDEBAR_COOKIE } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import { switchWorkspaceAction } from "@/app/app/_actions/workspace";

type NavItem = { href: string; label: string; icon: LucideIcon };

/** Navegação agrupada pelo que o operador faz: operar, gerenciar ativos, analisar. */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Operação",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/studio", label: "Estúdio", icon: SquarePen },
      { href: "/app/calendar", label: "Calendário", icon: CalendarDays },
      { href: "/app/history", label: "Histórico", icon: History },
    ],
  },
  {
    label: "Ativos",
    items: [
      { href: "/app/accounts", label: "Contas", icon: Users },
      { href: "/app/library", label: "Biblioteca", icon: Images },
      { href: "/app/campaigns", label: "Campanhas", icon: Flag },
    ],
  },
  { label: "Análise", items: [{ href: "/app/analytics", label: "Analytics", icon: BarChart3 }] },
];
const NAV_BOTTOM: NavItem[] = [
  { href: "/app/billing", label: "Assinatura", icon: CreditCard },
  { href: "/app/settings", label: "Configurações", icon: Settings },
];


type WS = { id: string; name: string; plan: string };

const isActive = (pathname: string, href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

/** Dica lateral só quando a barra está recolhida (os rótulos ficam ocultos). */
function Hint({ show, label, kbd, children }: { show: boolean; label: string; kbd?: string; children: ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={10}
          className="z-50 flex items-center gap-2 rounded-md border border-border-strong bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-fg shadow-xl animate-fade-in"
        >
          {label}
          {kbd && <Kbd>{kbd}</Kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Hint show={collapsed} label={item.label}>
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={cn(
          "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors pointer-coarse:h-11",
          collapsed && "justify-center px-0",
          active ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:bg-surface-2/70 hover:text-fg",
        )}
      >
        {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand" aria-hidden />}
        <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </Hint>
  );
}

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-4 px-3" aria-label="Navegação do app">
      {NAV_GROUPS.map((g) => (
        <div key={g.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <span className="mx-auto mb-1 h-px w-6 bg-border" aria-hidden />
          ) : (
            <p className="mb-1 px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-subtle">{g.label}</p>
          )}
          {g.items.map((it) => (
            <NavLink key={it.href} item={it} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
      <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
        {NAV_BOTTOM.map((it) => (
          <NavLink key={it.href} item={it} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

function WorkspaceSwitcher({ current, workspaces, collapsed = false, compact = false }: { current: WS; workspaces: WS[]; collapsed?: boolean; compact?: boolean }) {
  const router = useRouter();
  const initial = current.name.slice(0, 1).toUpperCase();
  return (
    <DropdownMenu.Root>
      <Hint show={collapsed} label={`Workspace: ${current.name}`}>
        <DropdownMenu.Trigger asChild>
          {compact ? (
            <button
              type="button"
              className="touch-hit flex h-9 min-w-0 max-w-[50vw] items-center gap-2 rounded-lg border border-border bg-surface px-2 text-xs text-fg-muted hover:border-border-strong"
              aria-label={`Workspace atual: ${current.name}. Trocar workspace`}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded bg-brand/15 text-xs font-semibold text-brand">{initial}</span>
              <span className="truncate">{current.name}</span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              aria-label={collapsed ? `Workspace atual: ${current.name}. Trocar workspace` : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-2 text-left text-sm transition-colors hover:border-border-strong",
                collapsed ? "justify-center p-1.5" : "px-2.5 py-2",
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand/15 text-xs font-semibold text-brand">{initial}</span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{current.name}</span>
                    <span className="block text-xs capitalize text-fg-subtle">Plano {current.plan}</span>
                  </span>
                  <ChevronsUpDown className="size-4 text-fg-subtle" aria-hidden />
                </>
              )}
            </button>
          )}
        </DropdownMenu.Trigger>
      </Hint>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          side={collapsed ? "right" : "bottom"}
          sideOffset={6}
          className="z-50 w-64 rounded-xl border border-border-strong bg-surface-2 p-1.5 shadow-2xl animate-fade-in"
        >
          <DropdownMenu.Label className="px-2 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-subtle">Workspaces</DropdownMenu.Label>
          {workspaces.map((w) => (
            <DropdownMenu.Item
              key={w.id}
              onSelect={async () => {
                if (w.id === current.id) return;
                const r = await switchWorkspaceAction(w.id);
                if (!r.ok) toast.error(r.error);
                else router.refresh();
              }}
              className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-3 pointer-coarse:min-h-11"
            >
              <span className="flex-1 truncate">{w.name}</span>
              <span className="text-xs capitalize text-fg-subtle">{w.plan}</span>
              {w.id === current.id && <Check className="size-4 text-brand" aria-label="Atual" />}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item asChild>
            <Link
              href="/onboarding"
              className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-fg pointer-coarse:min-h-11"
            >
              <Plus className="size-4" /> Novo workspace
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const MOBILE_TABS = [
  { href: "/app", label: "Início", icon: LayoutDashboard, primary: false },
  { href: "/app/accounts", label: "Contas", icon: Users, primary: false },
  { href: "/app/studio", label: "Publicar", icon: SquarePen, primary: true },
  { href: "/app/calendar", label: "Agenda", icon: CalendarDays, primary: false },
];

/** Navegação inferior no celular: as quatro jornadas mais frequentes + "Mais" (menu completo). */
function MobileTabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação rápida" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/92 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {MOBILE_TABS.map(({ href, label, icon: Icon, primary }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="grid">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors active:bg-surface/60",
                  active ? "text-fg" : "text-fg-subtle hover:text-fg-muted",
                )}
              >
                {primary ? (
                  <span
                    className={cn(
                      "grid h-9 w-12 place-items-center rounded-xl bg-brand-solid text-white shadow-[0_6px_20px_-6px_rgb(224_20_44/0.75)]",
                      active && "ring-2 ring-brand/45 ring-offset-2 ring-offset-bg",
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                ) : (
                  <Icon className={cn("size-5", active && "text-brand")} aria-hidden />
                )}
                {primary ? <span className="sr-only">{label}</span> : label}
              </Link>
            </li>
          );
        })}
        <li className="grid">
          <button
            type="button"
            onClick={onMore}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-fg-subtle transition-colors hover:text-fg-muted active:bg-surface/60"
          >
            <MoreHorizontal className="size-5" aria-hidden />
            Mais
          </button>
        </li>
      </ul>
    </nav>
  );
}

function UserCard({ user, signOut, collapsed }: { user: { name: string; email: string }; signOut: () => Promise<void>; collapsed: boolean }) {
  const initial = user.name.slice(0, 1).toUpperCase();
  if (collapsed) {
    return (
      <form action={signOut} className="mx-auto">
        <Hint show label={`Sair (${user.email})`}>
          <Button type="submit" variant="ghost" size="icon" aria-label={`Sair da conta ${user.email}`}>
            <LogOut />
          </Button>
        </Hint>
      </form>
    );
  }
  return (
    <div className="mx-3 flex items-center gap-2.5 rounded-lg border border-border bg-surface-2/40 p-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-xs font-semibold" aria-hidden>
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-fg-subtle">{user.email}</p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="icon-sm" aria-label="Sair" title="Sair">
          <LogOut />
        </Button>
      </form>
    </div>
  );
}

/** Atalhos globais: N = nova publicação, [ = recolher/expandir a barra lateral. Ignorados enquanto se digita. */
function useShortcuts(toggle: () => void) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("[role=dialog][data-state=open]")) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        router.push("/app/studio");
      } else if (e.key === "[") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, toggle]);
}

export function AppShell({
  user,
  workspace,
  workspaces,
  banner,
  signOut,
  initialCollapsed = false,
  children,
}: {
  user: { name: string; email: string };
  workspace: WS;
  workspaces: WS[];
  banner?: ReactNode;
  signOut: () => Promise<void>;
  initialCollapsed?: boolean;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpenState] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  // Quem abriu a gaveta (botão do topo ou "Mais") recebe o foco de volta ao fechar.
  const openerRef = useRef<HTMLElement | null>(null);
  const setMobileOpen = useCallback((open: boolean) => {
    if (open) openerRef.current = document.activeElement as HTMLElement | null;
    setMobileOpenState(open);
  }, []);
  const pathname = usePathname();

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      // Cookie (não localStorage) para o servidor já renderizar a largura certa, sem "pulo" na carga.
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);
  useShortcuts(toggle);

  // Fecha a gaveta móvel ao trocar de página (inclusive por voltar/avançar do navegador).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpenState(false);
  }

  const desktopSidebar = (
    <div className="flex h-full flex-col gap-4 overflow-y-auto overflow-x-hidden py-4">
      <div className={cn("flex items-center", collapsed ? "flex-col gap-3 px-3" : "justify-between pl-5 pr-3")}>
        <Link href="/app" aria-label="ScaleX — dashboard" className="flex min-w-0 flex-col">
          {collapsed ? <BladeMark size={26} /> : <Logo />}
          {!collapsed && <span className="mt-1.5 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-fg-subtle">Digital Operations</span>}
        </Link>
        <Hint show label={collapsed ? "Expandir menu" : "Recolher menu"} kbd="[">
          <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} aria-expanded={!collapsed} aria-controls="sx-sidebar">
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </Hint>
      </div>
      <div className="px-3">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} collapsed={collapsed} />
      </div>
      <div className="px-3">
        <Hint show={collapsed} label="Nova publicação" kbd="N">
          <Button asChild className={cn("w-full", collapsed && "px-0")} aria-label={collapsed ? "Nova publicação" : undefined}>
            <Link href="/app/studio">
              <Plus /> {!collapsed && <span className="flex-1 text-left">Nova publicação</span>}
              {!collapsed && <kbd className="rounded border border-white/25 px-1.5 font-mono text-[11px] text-white/85">N</kbd>}
            </Link>
          </Button>
        </Hint>
      </div>
      <NavLinks collapsed={collapsed} />
      <UserCard user={user} signOut={signOut} collapsed={collapsed} />
    </div>
  );

  return (
    <Tooltip.Provider delayDuration={250}>
      <div
        className="min-h-dvh lg:grid lg:grid-cols-[var(--sx-sidebar)_minmax(0,1fr)]"
        style={{ ["--sx-sidebar" as string]: collapsed ? "var(--sidebar-w-collapsed)" : "var(--sidebar-w)" }}
      >
        <aside id="sx-sidebar" aria-label="Menu lateral" className="sticky top-0 hidden h-dvh border-r border-border bg-surface/50 lg:block">
          {desktopSidebar}
        </aside>

        {/* Gaveta móvel: Dialog do Radix (foco preso dentro, Esc fecha, fundo inerte e sem rolagem). */}
        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-fade-in lg:hidden" />
            <Dialog.Content
              aria-describedby={undefined}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                if (openerRef.current?.isConnected) openerRef.current.focus();
              }}
              className="pt-safe pb-safe fixed inset-y-0 left-0 z-50 flex w-[min(19rem,86vw)] flex-col border-r border-border bg-surface shadow-2xl outline-none data-[state=open]:animate-slide-in lg:hidden"
            >
              <Dialog.Title className="sr-only">Menu</Dialog.Title>
              <div className="flex items-center justify-between px-5 pb-2 pt-4">
                <Link href="/app" aria-label="ScaleX — dashboard">
                  <Logo />
                </Link>
                <Dialog.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Fechar menu">
                    <X />
                  </Button>
                </Dialog.Close>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-4 pt-2">
                <div className="px-3">
                  <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
                </div>
                <NavLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
                <UserCard user={user} signOut={signOut} collapsed={false} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="min-w-0">
          <header className="pt-safe sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-xl lg:hidden">
            <div className="flex h-14 items-center gap-1.5 px-2.5">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Abrir menu" aria-expanded={mobileOpen} aria-haspopup="dialog">
                <Menu />
              </Button>
              <Link href="/app" aria-label="ScaleX — dashboard" className="mr-auto inline-flex h-11 items-center px-1">
                <Logo markSize={24} />
              </Link>
              <WorkspaceSwitcher current={workspace} workspaces={workspaces} compact />
            </div>
          </header>
          {banner}
          <main id="conteudo" className="mx-auto w-full max-w-[1440px] px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-9">
            {children}
          </main>
        </div>
        <MobileTabBar onMore={() => setMobileOpen(true)} moreOpen={mobileOpen} />
      </div>
    </Tooltip.Provider>
  );
}
