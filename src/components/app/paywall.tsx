import { Check, Clock, Lock, LogOut, MessageCircle } from "lucide-react";
import Link from "next/link";
import { SubscribeButton, SwitchWorkspaceButton } from "@/app/app/billing/billing-actions";
import { Badge } from "@/components/ui/primitives";
import { formatTimeLeft, type WorkspaceAccess } from "@/lib/domain/access";
import { PLANS } from "@/lib/domain/plans";
import type { PlanId } from "@/lib/domain/types";

const PAID = ["starter", "pro", "scale"] as const satisfies readonly PlanId[];

/**
 * Bloqueio depois do teste grátis: cobre o app inteiro e não fecha. Só sai quando o
 * pagamento é confirmado pela Cakto (o webhook troca o plano e encerra o teste).
 */
export function Paywall({
  reason,
  isOwner,
  billingOn,
  purchasable,
  workspaceName,
  otherWorkspaces,
  signOut,
}: {
  reason: "trial_ended" | "no_plan";
  isOwner: boolean;
  billingOn: boolean;
  purchasable: Partial<Record<(typeof PAID)[number], boolean>>;
  workspaceName: string;
  otherWorkspaces: { id: string; name: string }[];
  signOut: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-bg/85 backdrop-blur-md">
      <div className="flex min-h-full items-center justify-center p-4 sm:p-8">
        <div role="dialog" aria-modal="true" aria-labelledby="paywall-title" className="w-full max-w-4xl rounded-2xl border border-border bg-surface p-6 shadow-2xl sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
              <Lock className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id="paywall-title" className="text-xl font-semibold">
                {reason === "trial_ended" ? "Seu teste grátis do Pro terminou" : "Escolha um plano para continuar"}
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                Para continuar usando a ScaleX no workspace <strong className="text-fg">{workspaceName}</strong>, assine um dos planos. Seus dados,
                contas e agendamentos estão guardados: tudo volta a funcionar assim que o pagamento for confirmado.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {PAID.map((id) => {
              const p = PLANS[id];
              return (
                <div key={id} className={`flex flex-col rounded-xl border p-5 ${id === "pro" ? "border-brand/50 bg-brand/5" : "border-border"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    {id === "pro" && <Badge tone="brand">Mais escolhido</Badge>}
                  </div>
                  <p className="mt-2 text-2xl font-semibold">
                    {p.priceBRL === null ? "Sob consulta" : `R$ ${p.priceBRL}`}
                    {!!p.priceBRL && <span className="text-sm font-normal text-fg-muted">/mês</span>}
                  </p>
                  <ul className="mt-3 flex-1 space-y-1.5 text-sm text-fg-muted">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    {isOwner && billingOn && purchasable[id] ? (
                      <SubscribeButton plan={id} label={`Assinar ${p.name}`} variant={id === "pro" ? "primary" : "secondary"} />
                    ) : p.priceBRL === null || (isOwner && !purchasable[id]) ? (
                      <a
                        href="https://www.instagram.com/scalexspam/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-2"
                      >
                        <MessageCircle className="size-4" aria-hidden /> Falar com vendas
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {!isOwner && (
            <p className="mt-5 rounded-lg border border-warning/25 bg-warning/5 p-3 text-sm text-warning">
              Somente o proprietário do workspace pode assinar. Avise o responsável para liberar o acesso da equipe.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5">
              <Clock className="size-4 shrink-0" aria-hidden /> Já pagou? A liberação é automática (cartão em segundos; Pix logo após o pagamento).{" "}
              <Link href="/app/billing?checkout=retorno" className="font-medium text-fg hover:text-brand">
                Verificar
              </Link>
            </p>
            <div className="flex items-center gap-4">
              {otherWorkspaces.slice(0, 3).map((w) => (
                <SwitchWorkspaceButton key={w.id} id={w.id} name={w.name} />
              ))}
              <form action={signOut}>
                <button type="submit" className="inline-flex items-center gap-1.5 font-medium text-fg hover:text-brand">
                  <LogOut className="size-4" aria-hidden /> Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Faixa no topo durante o teste grátis. */
export function TrialBanner({ access }: { access: Extract<WorkspaceAccess, { state: "trial" }> }) {
  const urgent = access.msLeft < 24 * 3_600_000;
  return (
    <div
      className={`flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs ${
        urgent ? "border-warning/20 bg-warning/5 text-warning" : "border-brand/20 bg-brand/5 text-fg-muted"
      }`}
    >
      <Clock className="size-3.5" aria-hidden />
      <span>
        <strong className="text-fg">Teste grátis do Pro</strong>: termina em {formatTimeLeft(access.msLeft)}.
      </span>
      <Link href="/app/billing" className="font-medium text-brand hover:underline">
        Assinar agora
      </Link>
    </div>
  );
}
