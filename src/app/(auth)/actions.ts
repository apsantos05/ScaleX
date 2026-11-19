"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/domain/schemas";
import { requestPasswordReset, signIn, signOut, signUp, updatePassword } from "@/lib/auth/session";
import { rateLimit } from "@/lib/security/rate-limit";

export type ActionResult = { ok: true; message?: string; redirectTo?: string } | { ok: false; error: string };

async function clientKey(scope: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  return `${scope}:${ip}`;
}

async function guard(scope: string, max: number): Promise<ActionResult | null> {
  const rl = rateLimit(await clientKey(scope), max, 10 * 60_000);
  return rl.ok ? null : { ok: false, error: `Muitas tentativas. Tente novamente em ${rl.retryAfterSec}s.` };
}

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
}

export async function signUpAction(values: unknown): Promise<ActionResult> {
  const limited = await guard("signup", 10);
  if (limited) return limited;
  const parsed = signUpSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const r = await signUp(parsed.data);
  if (!r.ok) return r;
  if (r.needsEmailConfirmation) {
    return { ok: true, message: "Enviamos um link de confirmação para o seu e-mail." };
  }
  return { ok: true, redirectTo: "/onboarding" };
}

export async function signInAction(values: unknown, next?: string): Promise<ActionResult> {
  const limited = await guard("signin", 20);
  if (limited) return limited;
  const parsed = signInSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Informe e-mail e senha válidos." };
  const r = await signIn(parsed.data);
  if (!r.ok) return r;
  return { ok: true, redirectTo: safeNext(next) };
}

export async function forgotPasswordAction(values: unknown): Promise<ActionResult> {
  const limited = await guard("forgot", 5);
  if (limited) return limited;
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "E-mail inválido." };
  await requestPasswordReset(parsed.data.email);
  return {
    ok: true,
    message: "Se existir uma conta com este e-mail, você receberá um link para redefinir a senha.",
  };
}

export async function resetPasswordAction(values: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Senha inválida." };
  const r = await updatePassword(parsed.data.password);
  return r.ok ? { ok: true, redirectTo: "/app" } : r;
}

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
