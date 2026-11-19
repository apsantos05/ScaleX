import { FlaskConical, ServerCrash } from "lucide-react";
import { isDemoMode, isMisconfiguredDeployment, MISCONFIGURED_MESSAGE } from "@/lib/env";
import { cn } from "@/lib/utils";

/** Identificação explícita do modo demonstração (dados locais, publicações simuladas). */
export function DemoModeNotice({ className }: { className?: string }) {
  if (isMisconfiguredDeployment()) {
    return (
      <p role="alert" className={cn("flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger", className)}>
        <ServerCrash className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          <strong>Configuração incompleta.</strong> {MISCONFIGURED_MESSAGE}
        </span>
      </p>
    );
  }
  if (!isDemoMode()) return null;
  return (
    <p className={cn("flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/5 p-3 text-xs text-warning", className)}>
      <FlaskConical className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        <strong>Modo demonstração.</strong> Dados salvos localmente neste servidor; nenhum conteúdo é publicado e nenhuma
        cobrança é gerada. Configure o Supabase para o modo real.
      </span>
    </p>
  );
}
