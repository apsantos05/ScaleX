import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Nova senha" };

/** Acessada pelo link de recuperação (o callback do Supabase cria a sessão temporária). */
export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) redirect("/forgot-password");
  return (
    <>
      <h1 className="text-lg font-semibold">Definir nova senha</h1>
      <p className="mb-6 mt-1 text-sm text-fg-muted">Escolha uma senha forte com no mínimo 8 caracteres.</p>
      <ResetPasswordForm />
    </>
  );
}
