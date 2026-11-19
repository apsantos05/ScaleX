"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/domain/schemas";
import {
  forgotPasswordAction,
  resetPasswordAction,
  signInAction,
  signUpAction,
  type ActionResult,
} from "./actions";

function useAuthSubmit() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function run(p: Promise<ActionResult>) {
    setError(null);
    setMessage(null);
    try {
      const r = await p;
      if (!r.ok) return setError(r.error);
      if (r.message) setMessage(r.message);
      if (r.redirectTo) {
        router.push(r.redirectTo);
        router.refresh();
      }
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
  }
  return { error, message, run };
}

function TextField<T extends FieldValues>({
  form,
  name,
  label,
  type = "text",
  autoComplete,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  type?: string;
  autoComplete?: string;
}) {
  const err = form.formState.errors[name]?.message as string | undefined;
  return (
    <Field label={label} htmlFor={name} error={err}>
      <Input
        id={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!err}
        aria-describedby={err ? `${name}-error` : undefined}
        {...form.register(name)}
      />
    </Field>
  );
}

function Feedback({ error, message }: { error: string | null; message: string | null }) {
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (message) return <Alert tone="success">{message}</Alert>;
  return null;
}

export function SignInForm({ next }: { next?: string }) {
  const form = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema) });
  const { error, message, run } = useAuthSubmit();
  return (
    <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((v) => run(signInAction(v, next)))}>
      <TextField form={form} name="email" label="E-mail" type="email" autoComplete="email" />
      <TextField form={form} name="password" label="Senha" type="password" autoComplete="current-password" />
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-xs text-fg-muted hover:text-fg">
          Esqueci minha senha
        </Link>
      </div>
      <Feedback error={error} message={message} />
      <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
        Entrar
      </Button>
    </form>
  );
}

type SignUpValues = z.input<typeof signUpSchema>;

export function SignUpForm({ next }: { next?: string }) {
  const form = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });
  const { error, message, run } = useAuthSubmit();
  const termsErr = form.formState.errors.acceptTerms?.message;
  return (
    <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((v) => run(signUpAction(v, next)))}>
      <TextField form={form} name="name" label="Nome" autoComplete="name" />
      <TextField form={form} name="email" label="E-mail" type="email" autoComplete="email" />
      <TextField form={form} name="password" label="Senha (mín. 8 caracteres)" type="password" autoComplete="new-password" />
      <div>
        <label className="flex items-start gap-2.5 text-xs text-fg-muted">
          <Checkbox className="mt-0.5" {...form.register("acceptTerms")} aria-invalid={!!termsErr} />
          <span>
            Aceito os{" "}
            <a href="/termos" target="_blank" rel="noopener" className="text-fg underline underline-offset-2">
              Termos de Uso
            </a>{" "}
            e a{" "}
            <a href="/privacidade" target="_blank" rel="noopener" className="text-fg underline underline-offset-2">
              Política de Privacidade
            </a>
            , e declaro que publicarei apenas conteúdo permitido pelas plataformas e com direitos de uso.
          </span>
        </label>
        {termsErr && <p className="mt-1 text-xs text-danger" role="alert">{termsErr}</p>}
      </div>
      <Feedback error={error} message={message} />
      <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
        Criar conta
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const form = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema) });
  const { error, message, run } = useAuthSubmit();
  return (
    <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((v) => run(forgotPasswordAction(v)))}>
      <TextField form={form} name="email" label="E-mail" type="email" autoComplete="email" />
      <Feedback error={error} message={message} />
      <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
        Enviar link de redefinição
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const form = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema) });
  const { error, message, run } = useAuthSubmit();
  return (
    <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((v) => run(resetPasswordAction(v)))}>
      <TextField form={form} name="password" label="Nova senha" type="password" autoComplete="new-password" />
      <Feedback error={error} message={message} />
      <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
        Salvar nova senha
      </Button>
    </form>
  );
}
