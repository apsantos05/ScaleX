import fs from "node:fs/promises";
import path from "node:path";
import { getDataMode } from "@/lib/env";
import { demoDataDir } from "@/lib/data/demo-store";
import { supabaseAdminClient } from "@/lib/data/supabase-admin";

/**
 * Armazenamento de mídia.
 *  - Modo demo: disco local em .data/uploads (privado; servido por /api/media/[id] com checagem de acesso).
 *  - Modo Supabase: bucket privado `media`, acesso por URLs assinadas de curta duração.
 */
const bucket = () => process.env.SUPABASE_MEDIA_BUCKET ?? "media";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function buildStoragePath(workspaceId: string, mediaId: string, mimeType: string): string {
  return `${workspaceId}/${mediaId}.${EXT[mimeType] ?? "bin"}`;
}

function localPath(storagePath: string): string {
  const root = path.join(demoDataDir(), "uploads");
  const full = path.resolve(root, storagePath);
  if (!full.startsWith(path.resolve(root))) throw new Error("Caminho de mídia inválido.");
  return full;
}

export async function saveLocalFile(storagePath: string, data: Buffer): Promise<void> {
  const full = localPath(storagePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export async function readLocalFile(storagePath: string): Promise<Buffer> {
  return fs.readFile(localPath(storagePath));
}

export async function deleteStoredFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  if (getDataMode() === "supabase") {
    await supabaseAdminClient().storage.from(bucket()).remove(paths);
    return;
  }
  await Promise.all(paths.map((p) => fs.unlink(localPath(p)).catch(() => undefined)));
}

/** URL de upload direto do navegador ao Supabase (evita o limite de corpo das funções serverless). */
export async function createSignedUpload(storagePath: string): Promise<{ signedUrl: string; token: string }> {
  const { data, error } = await supabaseAdminClient().storage.from(bucket()).createSignedUploadUrl(storagePath);
  if (error || !data) throw new Error(error?.message ?? "Falha ao gerar URL de upload.");
  return { signedUrl: data.signedUrl, token: data.token };
}

export async function storedObjectExists(storagePath: string): Promise<boolean> {
  if (getDataMode() !== "supabase") {
    return fs.access(localPath(storagePath)).then(() => true, () => false);
  }
  const dir = storagePath.split("/").slice(0, -1).join("/");
  const name = storagePath.split("/").pop();
  const { data } = await supabaseAdminClient().storage.from(bucket()).list(dir, { search: name });
  return !!data?.some((o) => o.name === name);
}

/** URL de visualização para o app (curta duração). */
export async function viewUrl(media: { id: string; storagePath: string }): Promise<string> {
  if (getDataMode() !== "supabase") return `/api/media/${media.id}`;
  const { data } = await supabaseAdminClient().storage.from(bucket()).createSignedUrl(media.storagePath, 3600);
  return data?.signedUrl ?? "";
}

/**
 * URL pública temporária que a Meta consegue baixar (requisito do container de mídia).
 * No modo demo não existe URL pública: retorna null (contas reais não podem publicar mídia local).
 */
export async function publicFetchUrl(storagePath: string): Promise<string | null> {
  if (getDataMode() !== "supabase") return null;
  const { data } = await supabaseAdminClient().storage.from(bucket()).createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

/** URLs de visualização em lote (uma chamada ao Storage no modo Supabase). */
export async function viewUrls(media: { id: string; storagePath: string }[]): Promise<Record<string, string>> {
  if (!media.length) return {};
  if (getDataMode() !== "supabase") return Object.fromEntries(media.map((m) => [m.id, `/api/media/${m.id}`]));
  const { data } = await supabaseAdminClient()
    .storage.from(bucket())
    .createSignedUrls(media.map((m) => m.storagePath), 3600);
  const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return Object.fromEntries(media.map((m) => [m.id, byPath.get(m.storagePath) ?? ""]));
}

/** Confere a assinatura binária (magic bytes) para impedir arquivos disfarçados. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    return buf.subarray(8, 12).toString("ascii").startsWith("qt") ? "video/quicktime" : "video/mp4";
  }
  return null;
}
