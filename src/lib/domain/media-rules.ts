import type { MediaAsset, MediaKind, PublishFormat } from "./types";

/**
 * Regras de mídia. Valores baseados na documentação oficial do Instagram Platform
 * (Content Publishing / IG User Media). São conservadores e devem ser revalidados
 * a cada nova versão da Graph API — ver docs/META_API.md.
 */
export const UPLOAD_RULES = {
  image: { mimeTypes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 8 * 1024 * 1024 },
  video: { mimeTypes: ["video/mp4", "video/quicktime"], maxBytes: 300 * 1024 * 1024 },
} as const;

export const INSTAGRAM_RULES = {
  /** A API aceita apenas JPEG para imagens. */
  imageMimeTypes: ["image/jpeg"],
  imageMaxBytes: 8 * 1024 * 1024,
  /** Proporção largura/altura aceita no feed: 4:5 até 1.91:1. */
  feedMinRatio: 4 / 5,
  feedMaxRatio: 1.91,
  imageMinWidth: 320,
  videoMimeTypes: ["video/mp4", "video/quicktime"],
  reelsMinSec: 3,
  reelsMaxSec: 900,
  reelsMaxBytes: 300 * 1024 * 1024,
  storiesVideoMaxSec: 60,
  carouselMin: 2,
  carouselMax: 10,
  captionMaxChars: 2200,
  maxHashtags: 30,
} as const;

export function kindFromMime(mime: string): MediaKind | null {
  if ((UPLOAD_RULES.image.mimeTypes as readonly string[]).includes(mime)) return "image";
  if ((UPLOAD_RULES.video.mimeTypes as readonly string[]).includes(mime)) return "video";
  return null;
}

export function validateUpload(input: { mimeType: string; sizeBytes: number }):
  | { ok: true; kind: MediaKind }
  | { ok: false; error: string } {
  const kind = kindFromMime(input.mimeType);
  if (!kind) return { ok: false, error: "Formato não suportado. Use JPEG, PNG, WebP, MP4 ou MOV." };
  const max = UPLOAD_RULES[kind].maxBytes;
  if (input.sizeBytes <= 0) return { ok: false, error: "Arquivo vazio." };
  if (input.sizeBytes > max) {
    return { ok: false, error: `Arquivo excede o limite de ${Math.round(max / 1024 / 1024)} MB.` };
  }
  return { ok: true, kind };
}

export type MediaIssue = { mediaId: string; level: "error" | "warning"; message: string };

function countHashtags(caption: string): number {
  return (caption.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

/** Valida mídia + legenda contra as exigências do formato escolhido. */
export function validateForInstagram(
  format: PublishFormat,
  media: Pick<MediaAsset, "id" | "kind" | "mimeType" | "sizeBytes" | "width" | "height" | "durationSec">[],
  caption: string,
): MediaIssue[] {
  const issues: MediaIssue[] = [];
  const R = INSTAGRAM_RULES;

  if (caption.length > R.captionMaxChars) {
    issues.push({ mediaId: "", level: "error", message: `Legenda acima de ${R.captionMaxChars} caracteres.` });
  }
  if (countHashtags(caption) > R.maxHashtags) {
    issues.push({ mediaId: "", level: "error", message: `Máximo de ${R.maxHashtags} hashtags.` });
  }
  if (media.length === 0) {
    issues.push({ mediaId: "", level: "error", message: "Selecione ao menos uma mídia." });
    return issues;
  }

  if (format === "CAROUSEL") {
    if (media.length < R.carouselMin || media.length > R.carouselMax) {
      issues.push({
        mediaId: "",
        level: "error",
        message: `Carrossel exige entre ${R.carouselMin} e ${R.carouselMax} itens.`,
      });
    }
  } else if (media.length > 1) {
    issues.push({ mediaId: "", level: "error", message: "Este formato aceita apenas uma mídia." });
  }

  for (const m of media) {
    if (format === "REELS" && m.kind !== "video") {
      issues.push({ mediaId: m.id, level: "error", message: "Reels exige um vídeo." });
      continue;
    }
    if (m.kind === "image") {
      if (!(R.imageMimeTypes as readonly string[]).includes(m.mimeType)) {
        issues.push({
          mediaId: m.id,
          level: "error",
          message: "A API do Instagram aceita apenas imagens JPEG. Converta o arquivo antes de publicar.",
        });
      }
      if (m.sizeBytes > R.imageMaxBytes) {
        issues.push({ mediaId: m.id, level: "error", message: "Imagem acima de 8 MB." });
      }
      if (m.width && m.width < R.imageMinWidth) {
        issues.push({ mediaId: m.id, level: "warning", message: "Largura abaixo de 320 px; será ampliada." });
      }
      if ((format === "FEED" || format === "CAROUSEL") && m.width && m.height) {
        const ratio = m.width / m.height;
        if (ratio < R.feedMinRatio - 0.005 || ratio > R.feedMaxRatio + 0.005) {
          issues.push({
            mediaId: m.id,
            level: "error",
            message: "Proporção fora do intervalo do feed (4:5 a 1.91:1).",
          });
        }
      }
    } else {
      if (m.sizeBytes > R.reelsMaxBytes) {
        issues.push({ mediaId: m.id, level: "error", message: "Vídeo acima de 300 MB." });
      }
      if (m.durationSec != null) {
        if (format === "REELS" && (m.durationSec < R.reelsMinSec || m.durationSec > R.reelsMaxSec)) {
          issues.push({ mediaId: m.id, level: "error", message: "Reels deve ter entre 3 s e 15 min." });
        }
        if (format === "STORIES" && m.durationSec > R.storiesVideoMaxSec) {
          issues.push({ mediaId: m.id, level: "error", message: "Vídeo de Story deve ter até 60 s." });
        }
      } else {
        issues.push({ mediaId: m.id, level: "warning", message: "Duração do vídeo desconhecida." });
      }
      if (format === "FEED") {
        issues.push({
          mediaId: m.id,
          level: "warning",
          message: "Vídeos no feed são publicados como Reels pela API.",
        });
      }
    }
  }
  return issues;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
