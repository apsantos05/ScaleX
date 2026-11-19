"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; tone: "success" | "error" | "info"; message: string };

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function push(tone: Toast["tone"], message: string) {
  const id = ++seq;
  toasts = [...toasts.slice(-3), { id, tone, message }];
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
}
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (m: string) => push("success", m),
  error: (m: string) => push("error", m),
  info: (m: string) => push("info", m),
};

const ICON = { success: CheckCircle2, error: XCircle, info: Info };
const TONE = { success: "text-success", error: "text-danger", info: "text-info" };
const EMPTY: Toast[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => EMPTY,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {list.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 text-sm shadow-2xl animate-rise"
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[t.tone])} aria-hidden />
            <p className="flex-1 text-fg">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-fg-subtle hover:text-fg" aria-label="Fechar aviso">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
