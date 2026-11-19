import "server-only";
import { headers } from "next/headers";
import { appUrl } from "@/lib/env";

/**
 * Origem pública da requisição atual (ex.: https://scale-x-kkn5.vercel.app).
 * Usada em links enviados por e-mail ou copiados (confirmação, recuperação, convites),
 * para não depender de NEXT_PUBLIC_APP_URL estar configurada em cada ambiente.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return appUrl();
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
