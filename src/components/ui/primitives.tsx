import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { STATUS_LABEL } from "@/lib/domain/status";
import type { AccountStatus, TargetStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-[var(--radius-card)] border border-border/70 bg-surface", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  neutral: "bg-surface-3 text-fg-muted border-border",
  brand: "bg-brand/12 text-brand border-brand/25",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  danger: "bg-danger/10 text-danger border-danger/25",
  info: "bg-info/10 text-info border-info/25",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

const STATUS_TONE: Record<TargetStatus, Tone> = {
  draft: "neutral",
  scheduled: "info",
  queued: "warning",
  processing: "warning",
  published: "success",
  failed: "danger",
  cancelled: "neutral",
};

export function StatusBadge({ status, simulated }: { status: TargetStatus; simulated?: boolean }) {
  return (
    <Badge tone={STATUS_TONE[status]}>
      <span
        className={cn("size-1.5 rounded-full bg-current", status === "processing" && "animate-pulse")}
        aria-hidden
      />
      {STATUS_LABEL[status]}
      {simulated && status === "published" ? " (simulação)" : ""}
    </Badge>
  );
}

const ACCOUNT_STATUS: Record<AccountStatus, { label: string; tone: Tone }> = {
  active: { label: "Conectada", tone: "success" },
  needs_reauth: { label: "Reconectar", tone: "warning" },
  disconnected: { label: "Desconectada", tone: "neutral" },
  error: { label: "Erro", tone: "danger" },
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const s = ACCOUNT_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const ALERT = {
  info: { icon: Info, cls: "border-info/25 bg-info/5 text-info" },
  success: { icon: CheckCircle2, cls: "border-success/25 bg-success/5 text-success" },
  warning: { icon: AlertTriangle, cls: "border-warning/25 bg-warning/5 text-warning" },
  danger: { icon: XCircle, cls: "border-danger/25 bg-danger/5 text-danger" },
} satisfies Record<string, { icon: LucideIcon; cls: string }>;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof ALERT;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, cls } = ALERT[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-fg-muted">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-xl border border-border bg-surface-2">
        <Icon className="size-5 text-fg-muted" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({ src, name, size = 32 }: { src: string | null; name: string; size?: number }) {
  const initials = name.replace(/^@/, "").slice(0, 2).toUpperCase();
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatares vêm de CDNs com URLs assinadas e expiram
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-border object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full border border-border bg-gradient-to-br from-surface-3 to-surface-2 text-[10px] font-semibold text-fg-muted"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
      {children}
    </kbd>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <rect width="24" height="24" rx="6" fill="#FF3045" />
        <path d="M7 7l10 10M17 7l-3.5 3.5M10.5 13.5L7 17" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span>
        Scale<span className="text-brand">X</span>
      </span>
    </span>
  );
}
