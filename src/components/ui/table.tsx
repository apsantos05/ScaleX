import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SortState<K extends string> = { key: K; dir: 1 | -1 };

/** Cabeçalho de coluna ordenável: botão acessível + aria-sort no <th>. */
export function SortableTh<K extends string>({
  k,
  sort,
  onSort,
  children,
  className,
}: {
  k: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  children: ReactNode;
  className?: string;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th className={cn("py-2.5 font-medium", className)} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-surface-2 hover:text-fg", active && "text-fg")}
      >
        {children}
        <Icon className={cn("size-3", !active && "opacity-50")} aria-hidden />
      </button>
    </th>
  );
}
