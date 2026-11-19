import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDemoStore } from "@/lib/data/demo-store";
import { supabaseUserClient } from "@/lib/data/supabase-clients";
import type { User } from "@/lib/domain/types";
import { getDataMode, sessionSecret } from "@/lib/env";
import { requestOrigin } from "@/lib/request";
import { hashPassword, sign, verify, verifyPassword } from "@/lib/security/crypto";

export const DEMO_SESSION_COOKIE = "sx_session";
const SESSION_TTL_MS = 7 * 24 * 3600_000;

type DemoSession = { uid: string; exp: number };

/** Usuário autenticado da requisição atual (memoizado por requisição). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (getDataMode() === "supabase") {
    const sb = await supabaseUserClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      name: (data.user.user_metadata?.name as string) ?? data.user.email ?? "",
    };
  }
  const token = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
  const session = verify<DemoSession>(token, sessionSecret());
  if (!session) return null;
  const db = await getDemoStore().read();
  const u = db.users.find((x) => x.id === session.uid);
  return u ? { id: u.id, email: u.email, name: u.name } : null;
});

async function setDemoSession(uid: string) {
  (await cookies()).set(DEMO_SESSION_COOKIE, sign({ uid, exp: Date.now() + SESSION_TTL_MS }, sessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export type AuthResult = { ok: true; needsEmailConfirmation?: boolean } | { ok: false; error: string };

export async function signUp(input: { name: string; email: string; password: string }, next = "/onboarding"): Promise<AuthResult> {
  if (getDataMode() === "supabase") {
    const sb = await supabaseUserClient();
    const { data, error } = await sb.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name }, emailRedirectTo: `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) return { ok: false, error: translateAuthError(error.message) };
    return { ok: true, needsEmailConfirmation: !data.session };
  }
  const passwordHash = await hashPassword(input.password);
  const result = await getDemoStore().mutate((db) => {
    if (db.users.some((u) => u.email === input.email)) return null;
    const user = { id: randomUUID(), email: input.email, name: input.name, passwordHash, createdAt: new Date().toISOString() };
    db.users.push(user);
    return user;
  });
  if (!result) return { ok: false, error: "Já existe uma conta com este e-mail." };
  await setDemoSession(result.id);
  return { ok: true };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  if (getDataMode() === "supabase") {
    const sb = await supabaseUserClient();
    const { error } = await sb.auth.signInWithPassword(input);
    if (error) return { ok: false, error: translateAuthError(error.message) };
    return { ok: true };
  }
  const db = await getDemoStore().read();
  const user = db.users.find((u) => u.email === input.email);
  // Verificação sempre executada para não revelar quais e-mails existem via tempo de resposta.
  const valid = await verifyPassword(input.password, user?.passwordHash ?? "scrypt$AAAA$AAAA");
  if (!user || !valid) return { ok: false, error: "E-mail ou senha inválidos." };
  await setDemoSession(user.id);
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (getDataMode() === "supabase") {
    await (await supabaseUserClient()).auth.signOut();
  }
  const jar = await cookies();
  jar.delete(DEMO_SESSION_COOKIE);
  jar.delete("sx_ws");
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (getDataMode() === "supabase") {
    const sb = await supabaseUserClient();
    await sb.auth.resetPasswordForEmail(email, { redirectTo: `${await requestOrigin()}/auth/callback?next=/reset-password` });
  }
  // Resposta idêntica exista ou não o e-mail (evita enumeração).
  return { ok: true };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  if (getDataMode() !== "supabase") return { ok: false, error: "Disponível apenas no modo real (Supabase Auth)." };
  const sb = await supabaseUserClient();
  const { error } = await sb.auth.updateUser({ password });
  return error ? { ok: false, error: translateAuthError(error.message) } : { ok: true };
}

function translateAuthError(msg: string): string {
  // Log sem dados pessoais: apenas a mensagem do provedor, para diagnóstico.
  console.warn(JSON.stringify({ svc: "auth", event: "provider_error", message: msg }));
  if (/invalid login/i.test(msg)) return "E-mail ou senha inválidos.";
  if (/already registered/i.test(msg)) return "Já existe uma conta com este e-mail.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Aguarde alguns minutos.";
  if (/invalid/i.test(msg) && /email/i.test(msg)) return "Este endereço de e-mail não é aceito. Use outro e-mail.";
  if (/sending|smtp|confirmation email/i.test(msg)) {
    return "Não conseguimos enviar o e-mail de confirmação agora. Tente novamente mais tarde.";
  }
  if (/weak|password should/i.test(msg)) return "Senha fraca. Use ao menos 8 caracteres combinando letras e números.";
  return "Não foi possível concluir a autenticação. Tente novamente.";
}
