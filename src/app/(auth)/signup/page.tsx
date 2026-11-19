import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SignUpForm } from "../auth-forms";


const validNext = (n: unknown) => (typeof n === "string" && /^\/(app|convite\/)/.test(n) && !n.startsWith("//") ? n : undefined);

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignUpPage({ searchParams }: PageProps<"/signup">) {
  const next = validNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next ?? "/app");
  return (
    <>
      <h1 className="text-lg font-semibold">Crie sua conta</h1>
      <p className="mb-6 mt-1 text-sm text-fg-muted">Comece no plano Trial, sem cartão.</p>
      <SignUpForm next={next} />
      <p className="mt-6 text-center text-sm text-fg-muted">
        Já tem conta?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-fg hover:text-brand">
          Entrar
        </Link>
      </p>
    </>
  );
}
