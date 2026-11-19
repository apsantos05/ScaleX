import type { Metadata } from "next";
import { Logo } from "@/components/ui/primitives";
import { DemoModeNotice } from "@/components/app/demo-notice";
import { requireUser } from "@/lib/auth/context";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Configurar workspace" };

export default async function OnboardingPage() {
  const user = await requireUser();
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
      <main id="conteudo" className="relative w-full max-w-lg animate-rise">
        <div className="mb-8 flex justify-center">
          <Logo className="text-lg" />
        </div>
        <div className="rounded-2xl border border-border bg-surface p-7 shadow-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-brand">Passo 1 de 2</p>
          <h1 className="mt-2 text-xl font-semibold">Olá, {user.name.split(" ")[0]}. Vamos criar seu workspace.</h1>
          <p className="mt-1 text-sm text-fg-muted">
            O workspace isola contas, conteúdo e equipe. Você pode criar outros depois — um por cliente, por exemplo.
          </p>
          <OnboardingForm />
        </div>
        <DemoModeNotice className="mt-4" />
      </main>
    </div>
  );
}
