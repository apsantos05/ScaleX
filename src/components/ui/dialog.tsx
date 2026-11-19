"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <D.Content
          className={cn(
            // Mobile (< 640px): bottom sheet ancorado na base, ao alcance do polegar e acima da área segura.
            "fixed inset-x-0 bottom-0 z-50 max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-b-0 border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl data-[state=open]:animate-sheet-up",
            // Desktop: diálogo centralizado.
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-1.5rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border-b sm:p-6 sm:data-[state=open]:animate-rise",
            className,
          )}
        >
          <div aria-hidden className="mx-auto -mt-2 mb-3 h-1 w-10 rounded-full bg-border-strong sm:hidden" />
          <div className="mb-4 pr-10">
            <D.Title className="text-base font-semibold">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 text-sm text-fg-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : "Diálogo"}</D.Description>
            )}
          </div>
          {children}
          {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end max-sm:[&>*]:h-11">{footer}</div>}
          <D.Close asChild>
            <Button variant="ghost" size="icon" className="absolute right-2.5 top-2.5" aria-label="Fechar">
              <X />
            </Button>
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Confirmação obrigatória para ações destrutivas. */
export function ConfirmButton({
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  destructive = true,
}: {
  trigger: (open: () => void) => ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      {trigger(() => setOpen(true))}
      <Dialog
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title={title}
        description={description}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Voltar
            </Button>
            <Button
              variant={destructive ? "danger" : "primary"}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      />
    </>
  );
}
