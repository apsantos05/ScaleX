import { createHash, randomBytes } from "node:crypto";

/** Token aleatório para links (convites). Só o hash vai para o banco. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Aceita apenas o formato gerado por newToken (evita consultas com lixo). */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
