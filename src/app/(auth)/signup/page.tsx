import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <>
      <h1 className="text-lg font-semibold">Crie sua conta</h1>
      <p className="mb-6 mt-1 text-sm text-fg-muted">Comece no plano Trial, sem cartão.</p>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-fg-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-fg hover:text-brand">
          Entrar
        </Link>
      </p>
    </>
  );
}
