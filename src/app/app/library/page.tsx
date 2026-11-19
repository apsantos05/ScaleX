import type { Metadata } from "next";
import { Meter } from "@/components/app/charts";
import { PageHeader } from "@/components/ui/primitives";
import { requireWorkspace, roleAtLeast } from "@/lib/auth/context";
import { formatBytes } from "@/lib/domain/media-rules";
import { planLimits } from "@/lib/domain/plans";
import { viewUrls } from "@/lib/storage";
import { LibraryManager } from "./library-manager";

export const metadata: Metadata = { title: "Biblioteca de mídia" };

export default async function LibraryPage() {
  const { repo, workspace, role } = await requireWorkspace();
  const [media, captions, used] = await Promise.all([
    repo.listMedia(workspace.id),
    repo.listCaptions(workspace.id),
    repo.storageUsedBytes(workspace.id),
  ]);
  const urls = await viewUrls(media);
  const limitBytes = planLimits(workspace.plan).maxStorageMb * 1024 * 1024;
  return (
    <>
      <PageHeader
        title="Biblioteca de mídia"
        description="Armazenamento privado. Somente membros do workspace acessam os arquivos."
        actions={
          <div className="w-56 text-right text-xs text-fg-muted">
            {formatBytes(used)} de {formatBytes(limitBytes)}
            <Meter value={used} max={limitBytes} className="mt-1.5" />
          </div>
        }
      />
      <LibraryManager media={media} urls={urls} captions={captions} canEdit={roleAtLeast(role, "editor")} />
    </>
  );
}
