"use client";

import { TargetDialog } from "@/components/app/target-dialog";
import { StatusBadge } from "@/components/ui/primitives";
import { STATUS_LABEL } from "@/lib/domain/status";
import type { TargetView } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  scheduled: "bg-info",
  queued: "bg-warning",
  processing: "bg-warning animate-pulse",
  published: "bg-success",
  failed: "bg-danger",
  cancelled: "bg-fg-subtle",
  draft: "bg-fg-subtle",
};

export function TargetChip({ target, color, canEdit, compact }: { target: TargetView; color?: string; canEdit: boolean; compact?: boolean }) {
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(target.scheduledAt));
  return (
    <TargetDialog target={target} canEdit={canEdit}>
      {(open) => (
        <button
          type="button"
          onClick={open}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md border border-border/60 bg-surface-2 text-left transition-colors hover:border-border-strong",
            compact ? "px-1.5 py-1 text-xs" : "min-h-10 px-2.5 py-2 text-xs pointer-coarse:min-h-11",
            target.status === "cancelled" && "opacity-50 line-through",
          )}
          style={color ? { borderLeft: `3px solid ${color}` } : undefined}
          aria-label={`@${target.accountUsername} às ${time}, ${target.simulated && target.status === "published" ? "simulado" : STATUS_LABEL[target.status]}`}
        >
          <span className={cn("size-1.5 shrink-0 rounded-full", DOT[target.status])} aria-hidden />
          <span className="text-fg-subtle tabular-nums">{time}</span>
          <span className="min-w-0 flex-1 truncate">@{target.accountUsername}</span>
          {!compact && <StatusBadge status={target.status} simulated={target.simulated} />}
        </button>
      )}
    </TargetDialog>
  );
}
