import type { WorkspaceRepository } from "@/lib/data/repository";

/**
 * Popula um workspace com CONTAS DE DEMONSTRAÇÃO (isDemo = true).
 * Elas usam o adapter simulado: nada é publicado e nenhuma métrica é inventada.
 */
export async function seedDemoWorkspace(repo: WorkspaceRepository, workspaceId: string, count = 6) {
  const niches = ["studio", "lifestyle", "fitness", "beauty", "travel", "food", "tech", "fashion"];
  for (let i = 0; i < count; i++) {
    const niche = niches[i % niches.length]!;
    const username = `demo.${niche}_${String(i + 1).padStart(2, "0")}`;
    await repo.upsertAccount(workspaceId, {
      provider: "instagram",
      providerAccountId: `demo-${workspaceId.slice(0, 8)}-${i + 1}`,
      username,
      displayName: `Demo ${niche[0]!.toUpperCase()}${niche.slice(1)}`,
      avatarUrl: null,
      accountType: "MEDIA_CREATOR",
      status: "active",
      scopes: ["instagram_business_basic", "instagram_business_content_publish"],
      tags: [],
      group: null,
      followersCount: null,
      lastSyncedAt: new Date().toISOString(),
      tokenExpiresAt: null,
      isDemo: true,
    });
  }
  const accounts = await repo.listAccounts(workspaceId);
  const demo = accounts.filter((a) => a.isDemo);
  const half = Math.ceil(demo.length / 2);
  await repo.updateAccounts(workspaceId, demo.slice(0, half).map((a) => a.id), { group: "Grupo A", tags: ["demo", "principal"] });
  await repo.updateAccounts(workspaceId, demo.slice(half).map((a) => a.id), { group: "Grupo B", tags: ["demo"] });

  const campaigns = await repo.listCampaigns(workspaceId);
  if (!campaigns.length) {
    await repo.createCampaign(workspaceId, { name: "Lançamento", color: "#FF3045", description: "Campanha de exemplo" });
    await repo.createCampaign(workspaceId, { name: "Sempre ativo", color: "#5AA8FF", description: null });
  }
  const captions = await repo.listCaptions(workspaceId);
  if (!captions.length) {
    await repo.createCaption(workspaceId, {
      title: "Chamada padrão",
      body: "Conteúdo novo no ar 🔥\n\nSalve para ver depois e compartilhe com quem precisa.\n\n#conteudo #novidade",
    });
  }
}
