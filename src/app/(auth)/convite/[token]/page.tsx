import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { getRepo } from "@/lib/data";
import { MEMBER_ERROR_MESSAGES } from "@/lib/domain/members";
import { hashToken, isWellFormedToken } from "@/lib/security/tokens";
import { signOutToAction } from "../../actions";
import { AcceptInvite } from "./accept-invite";

export const metadata: Metadata = { title: "Convite", robots: { index: false } };

const ROLE_LABEL = { owner: "Proprietário", admin: "Administrador", editor: "Editor", viewer: "Leitor" } as const;

export default async function InvitePage({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const here = `/convite/${token}`;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <MailCheck className="mb-4 size-8 text-brand" aria-hidden />
        <h1 className="text-lg font-semibold">Você foi convidado para a ScaleX</h1>
        <p className="mb-6 mt-1 text-sm text-fg-muted">
          Entre ou crie sua conta <strong className="text-fg">com o mesmo e-mail que recebeu o convite</strong> para entrar no workspace.
        </p>
        <div className="grid gap-2">
          <Button asChild>
            <Link href={`/signup?next=${encodeURIComponent(here)}`}>Criar conta</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/login?next=${encodeURIComponent(here)}`}>Já tenho conta</Link>
          </Button>
        </div>
      </>
    );
  }

  const preview = isWellFormedToken(token) ? await (await getRepo()).previewInvitation(hashToken(token)) : null;

  if (!preview || preview.status !== "valid") {
    const message = !preview ? MEMBER_ERROR_MESSAGES.not_found : MEMBER_ERROR_MESSAGES[preview.status as "expired" | "revoked" | "accepted"];
    return (
      <>
        <h1 className="text-lg font-semibold">Convite indisponível</h1>
        <Alert tone="warning" className="mt-4">{message}</Alert>
        <Button asChild variant="secondary" className="mt-6 w-full">
          <Link href="/app">Ir para o app</Link>
        </Button>
      </>
    );
  }

  const sameEmail = preview.email.toLowerCase() === user.email.toLowerCase();
  return (
    <>
      <MailCheck className="mb-4 size-8 text-brand" aria-hidden />
      <h1 className="text-lg font-semibold">Entrar no workspace {preview.workspaceName}</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Você foi convidado como <strong className="text-fg">{ROLE_LABEL[preview.role]}</strong>.
      </p>
      {sameEmail ? (
        <AcceptInvite token={token} />
      ) : (
        <>
          <Alert tone="warning" className="mt-5">
            Este convite foi enviado para <strong>{preview.email}</strong>, mas você está conectado como <strong>{user.email}</strong>.
          </Alert>
          <form action={signOutToAction.bind(null, here)} className="mt-5">
            <Button type="submit" className="w-full">Sair e entrar com o e-mail convidado</Button>
          </form>
        </>
      )}
    </>
  );
}
