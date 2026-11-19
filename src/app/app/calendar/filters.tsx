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
    <>
      <Select className="h-8 w-40 text-xs" value={sp.get("account") ?? ""} onChange={(e) => set("account", e.target.value)} aria-label="Filtrar conta">
        <option value="">Todas as contas</option>
        {accounts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Select>
      <Select className="h-8 w-40 text-xs" value={sp.get("campaign") ?? ""} onChange={(e) => set("campaign", e.target.value)} aria-label="Filtrar campanha">
        <option value="">Todas as campanhas</option>
        {campaigns.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Select>
      <Select className="h-8 w-36 text-xs" value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)} aria-label="Filtrar status">
        <option value="">Todos status</option>
        {statuses.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Select>
    </>
  );
}
