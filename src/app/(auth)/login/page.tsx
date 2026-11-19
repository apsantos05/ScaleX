import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SignInForm } from "../auth-forms";


const validNext = (n: unknown) => (typeof n === "string" && /^\/(app|convite\/)/.test(n) && !n.startsWith("//") ? n : undefined);

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next: rawNext } = await searchParams;
  const next = validNext(rawNext);
  if (await getCurrentUser()) redirect(next ?? "/app");
  return (
    <>
      <h1 className="text-lg font-semibold">Entrar na ScaleX</h1>
      <p className="mb-6 mt-1 text-sm text-fg-muted">Acesse sua central de operações.</p>
      <SignInForm next={next} />
      <p className="mt-6 text-center text-sm text-fg-muted">
        Não tem conta?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-fg hover:text-brand">
          Criar conta
        </Link>
      </p>
    </>
  );
}
