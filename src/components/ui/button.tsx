import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Botões — Design System 2.0
 * - Alturas: sm 32 · md 36 · lg 44 (desktop). Em telas de toque, `touch-hit` expande a área clicável
 *   para ≥44×44 px sem mudar o visual, para não inflar tabelas densas.
 * - Primário usa o vermelho sólido (#E0142C, 4,9:1 com texto branco); #FF3045 fica para destaques.
 */
export const buttonVariants = cva(
  "touch-hit inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-progress [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-solid text-brand-fg hover:bg-brand-solid-hover active:bg-brand-solid-hover shadow-[0_1px_0_rgb(255_255_255/0.14)_inset,0_6px_20px_-10px_rgb(224_20_44/0.7)]",
        secondary: "border border-border-strong bg-surface-2 text-fg hover:border-border-input hover:bg-surface-3",
        outline: "border border-border-strong text-fg hover:border-border-input hover:bg-surface-2",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg active:bg-surface-3",
        danger: "border border-danger/35 bg-danger/10 text-danger hover:border-danger/55 hover:bg-danger/18",
        link: "h-auto px-0 text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-base",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean };

export function Button({ className, variant, size, asChild, loading, children, disabled, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      // Evita submissões acidentais: botões fora de <form> não precisam de type, dentro de form o padrão explícito é "button".
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
}
