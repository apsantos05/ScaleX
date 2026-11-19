import { AuthorizationError } from "@/lib/auth/context";
import { MEMBER_ERROR_MESSAGES, MemberError } from "@/lib/domain/members";

export type Result<T = undefined> = ({ ok: true } & (T extends undefined ? { data?: T } : { data: T })) | { ok: false; error: string };

/** Converte exceções em mensagens seguras (sem vazar detalhes internos). */
export function toError(e: unknown): { ok: false; error: string } {
  if (e instanceof AuthorizationError) return { ok: false, error: e.message };
  if (e instanceof MemberError) return { ok: false, error: MEMBER_ERROR_MESSAGES[e.code] };
  console.error(JSON.stringify({ svc: "action", error: (e as Error)?.message }));
  return { ok: false, error: "Algo deu errado. Tente novamente em instantes." };
}
