"use client";

import { FlaskConical, Plug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { seedDemoAccountsAction } from "../_actions/workspace";

export function ConnectButtons({ configured, atLimit }: { configured: boolean; atLimit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          const r = await seedDemoAccountsAction();
          setBusy(false);
          if (!r.ok) return toast.error(r.error);
          toast.success("Contas de demonstração adicionadas.");
          router.refresh();
        }}
      >
        <FlaskConical /> Adicionar contas demo
      </Button>
      {configured && (
        <Button asChild disabled={atLimit}>
          {/* Navegação completa: o OAuth precisa de redirect de topo. */}
          <a href="/api/integrations/instagram/connect" aria-disabled={atLimit}>
            <Plug /> Conectar Instagram
          </a>
        </Button>
      )}
    </>
  );
}
