import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { requireWorkspace, roleAtLeast } from "@/lib/auth/context";
import { CampaignsManager } from "./campaigns-manager";

export const metadata: Metadata = { title: "Campanhas" };

export default async function CampaignsPage() {
  const { repo, workspace, role } = await requireWorkspace();
  const [campaigns, targets] = await Promise.all([repo.listCampaigns(workspace.id), repo.listTargets(workspace.id)]);
  const stats = Object.fromEntries(
    campaigns.map((c) => {
      const mine = targets.filter((t) => t.campaignId === c.id);
      return [
        c.id,
        {
          total: mine.length,
          published: mine.filter((t) => t.status === "published").length,
          pending: mine.filter((t) => ["scheduled", "queued", "processing"].includes(t.status)).length,
          failed: mine.filter((t) => t.status === "failed").length,
          accounts: new Set(mine.map((t) => t.socialAccountId)).size,
        },
      ];
    }),
  );
  return (
    <>
      <PageHeader title="Campanhas" description="Agrupe publicações para acompanhar progresso e resultados." />
      <CampaignsManager campaigns={campaigns} stats={stats} canEdit={roleAtLeast(role, "editor")} canDelete={roleAtLeast(role, "admin")} />
    </>
  );
}
