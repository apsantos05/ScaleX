"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/form";

type Opt = { id: string; label: string };

/** Filtros sincronizados com a URL (compartilháveis e preservados ao navegar). */
export function CalendarFilters({ accounts, campaigns, statuses }: { accounts: Opt[]; campaigns: Opt[]; statuses: Opt[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (key: string, value: string) => {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
  };
  return (
    <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto">
      <Select className="h-9 text-xs pointer-coarse:h-11 sm:w-40" value={sp.get("account") ?? ""} onChange={(e) => set("account", e.target.value)} aria-label="Filtrar conta">
        <option value="">Conta</option>
        {accounts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Select>
      <Select className="h-9 text-xs pointer-coarse:h-11 sm:w-40" value={sp.get("campaign") ?? ""} onChange={(e) => set("campaign", e.target.value)} aria-label="Filtrar campanha">
        <option value="">Campanha</option>
        {campaigns.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Select>
      <Select className="h-9 text-xs pointer-coarse:h-11 sm:w-36" value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)} aria-label="Filtrar status">
        <option value="">Status</option>
        {statuses.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Select>
    </div>
  );
}
