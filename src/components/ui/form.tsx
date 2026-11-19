import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full min-w-0 rounded-lg border border-border-input/80 bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] hover:border-border-input focus-visible:border-brand focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-10 pointer-coarse:h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(fieldBase, "sx-select h-10 cursor-pointer appearance-none pr-7 pointer-coarse:h-11", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-fg", className)} {...props} />;
}

export function Checkbox({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      // Checkbox nativo com accent-color: estados marcado/indeterminado/foco garantidos pelo navegador.
      // (A versão com appearance-none + SVG em data-URL perdia o estado "marcado" na fusão de classes.)
      className={cn("size-4 shrink-0 cursor-pointer accent-[var(--brand-solid)] pointer-coarse:size-5 disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

/** Interruptor acessível (role="switch"), com área de toque confortável. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "touch-hit inline-flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 transition-colors disabled:opacity-50",
        checked ? "border-brand-solid bg-brand-solid" : "border-border-input bg-surface-3",
      )}
    >
      <span className={cn("size-4.5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0")} />
    </button>
  );
}
