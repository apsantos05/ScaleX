"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cancelSubscriptionAction, startCheckoutAction } from "../_actions/billing";
import { useRouter } from "next/navigation";

/** Abre o checkout hospedado da Cakto para o plano escolhido. */
export function SubscribeButton({ plan, label, variant = "primary" }: { plan: string; label: string; variant?: "primary" | "secondary" }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className="w-full"
      variant={variant}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        const r = await startCheckoutAction(plan);
        if (!r.ok) {
          toast.error(r.error);
          setBusy(false);
          return;
        }
        // Mesma aba: depois do pagamento a pessoa volta pelo link/redirect e a página mostra o status.
        window.location.assign(r.data.url);
      }}
    >
      {label} {busy ? null : <ExternalLink />}
    </Button>
  );
}

export function CancelSubscriptionButton({ periodEnd }: { periodEnd: string | null }) {
  const router = useRouter();
  return (
    <ConfirmButton
      title="Cancelar assinatura?"
      description={
        periodEnd
          ? `As próximas cobranças serão canceladas. Seu plano continua ativo até ${new Date(periodEnd).toLocaleDateString("pt-BR")} e depois volta ao Trial.`
          : "As próximas cobranças serão canceladas e o workspace voltará ao Trial ao fim do período pago."
      }
      confirmLabel="Cancelar assinatura"
      onConfirm={async () => {
        const r = await cancelSubscriptionAction();
        if (!r.ok) return void toast.error(r.error);
        toast.success(r.data.message);
        router.refresh();
      }}
      trigger={(open) => (
        <Button variant="danger" onClick={open}>
          Cancelar assinatura <ArrowRight />
        </Button>
      )}
    />
  );
}
