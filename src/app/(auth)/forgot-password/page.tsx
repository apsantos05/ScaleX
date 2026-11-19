import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/primitives";
import { isDemoMode } from "@/lib/env";
import { ForgotPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-lg font-semibold">Recuperar senha</h1>
      <p className="mb-6 mt-1 text-sm text-fg-muted">Enviaremos um link para redefinir sua senha.</p>
      {isDemoMode() && (
        <Alert tone="warning" className="mb-4">
          No modo demonstração nenhum e-mail é enviado. A recuperação funciona com o Supabase Auth configurado.
        </Alert>
      )}
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-fg-muted hover:text-fg">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
