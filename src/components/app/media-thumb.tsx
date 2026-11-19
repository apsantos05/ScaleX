import { Film, ImageOff } from "lucide-react";
import type { MediaAsset } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function MediaThumb({ media, url, className }: { media: Pick<MediaAsset, "kind" | "fileName">; url?: string; className?: string }) {
  if (!url) {
    return (
      <div className={cn("grid place-items-center bg-surface-2 text-fg-subtle", className)}>
        <ImageOff className="size-5" aria-hidden />
      </div>
    );
  }
  if (media.kind === "video") {
    return (
      <div className={cn("relative bg-black", className)}>
        <video src={`${url}#t=0.5`} preload="metadata" muted playsInline className="size-full object-cover" aria-label={media.fileName} />
        <span className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-md bg-black/70 text-white">
          <Film className="size-3.5" aria-hidden />
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URLs privadas/assinadas; otimização do next/image não se aplica
    <img src={url} alt={media.fileName} loading="lazy" decoding="async" className={cn("bg-surface-2 object-cover", className)} />
  );
}
