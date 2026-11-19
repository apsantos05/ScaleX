"use client";

import type { MediaAsset } from "@/lib/domain/types";

/** Lê dimensões/duração no navegador antes do upload (usado para validação por formato). */
export async function readMediaMeta(file: File): Promise<{ width: number | null; height: number | null; durationSec: number | null }> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("image/")) {
      // onload em vez de img.decode(): decode() pode nunca resolver em alguns navegadores embutidos.
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image"));
        setTimeout(() => reject(new Error("timeout")), 15_000);
        img.src = url;
      });
      return { width: img.naturalWidth, height: img.naturalHeight, durationSec: null };
    }
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("metadata"));
      setTimeout(() => reject(new Error("timeout")), 15_000);
    });
    return {
      width: video.videoWidth || null,
      height: video.videoHeight || null,
      durationSec: Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null,
    };
  } catch {
    return { width: null, height: null, durationSec: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function errorOf(res: Response) {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `Falha (${res.status})`;
}

/** Faz upload pela estratégia do ambiente: local (demo) ou direto ao Supabase Storage via URL assinada. */
export async function uploadFile(file: File, folder: string | null): Promise<MediaAsset> {
  const meta = { ...(await readMediaMeta(file)), folder };
  const intentRes = await fetch("/api/media/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
  });
  if (!intentRes.ok) throw new Error(await errorOf(intentRes));
  const intent = (await intentRes.json()) as { strategy: "local" } | { strategy: "supabase"; storagePath: string; signedUrl: string };

  if (intent.strategy === "local") {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("meta", JSON.stringify(meta));
    const res = await fetch("/api/media/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error(await errorOf(res));
    return ((await res.json()) as { media: MediaAsset }).media;
  }

  const put = await fetch(intent.signedUrl, { method: "PUT", headers: { "Content-Type": file.type, "x-upsert": "false" }, body: file });
  if (!put.ok) throw new Error("Falha ao enviar o arquivo ao storage.");
  const res = await fetch("/api/media/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...meta, storagePath: intent.storagePath, fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
  });
  if (!res.ok) throw new Error(await errorOf(res));
  return ((await res.json()) as { media: MediaAsset }).media;
}
