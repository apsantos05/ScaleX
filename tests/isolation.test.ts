import { describe, expect, it } from "vitest";
import { DemoRepository } from "@/lib/data/demo-repository";
import { DemoStore } from "@/lib/data/demo-store";
import { cancelTargets, schedulePublication } from "@/lib/services/publishing";

/** No modo demo o isolamento é feito por filtros de workspace_id; no Supabase, por RLS. */
describe("isolamento entre workspaces", () => {
  it("um workspace não lê nem altera dados de outro", async () => {
    const repo = new DemoRepository(DemoStore.inMemory());
    const a = await repo.createWorkspace("user-a", "Cliente A");
    const b = await repo.createWorkspace("user-b", "Cliente B");
    const media = await repo.createMedia(a.id, {
      kind: "image", fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 10, width: 1080, height: 1080,
      durationSec: null, storagePath: `${a.id}/x.jpg`, folder: null, tags: [], rightsConfirmed: true, rightsNote: null, createdBy: "user-a",
    });
    const acc = await repo.upsertAccount(a.id, {
      provider: "instagram", providerAccountId: "1", username: "conta_a", displayName: "A", avatarUrl: null, accountType: "BUSINESS",
      status: "active", scopes: ["instagram_business_content_publish"], tags: [], group: null, followersCount: null, lastSyncedAt: null,
      tokenExpiresAt: null, isDemo: false,
    });

    expect(await repo.getMediaByIds(b.id, [media.id])).toEqual([]);
    expect(await repo.getAccount(b.id, acc.id)).toBeNull();
    expect(await repo.listAccounts(b.id)).toEqual([]);
    expect(await repo.getMembership(a.id, "user-b")).toBeNull();

    // B tenta agendar usando mídia e conta de A → rejeitado.
    const attempt = await schedulePublication(repo, { workspace: b, userId: "user-b" }, {
      idempotencyKey: crypto.randomUUID(), mediaIds: [media.id], caption: "", accountIds: [acc.id], format: "FEED",
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(attempt.ok).toBe(false);

    // A agenda; B tenta cancelar o target de A → nenhum efeito.
    const ok = await schedulePublication(repo, { workspace: a, userId: "user-a" }, {
      idempotencyKey: crypto.randomUUID(), mediaIds: [media.id], caption: "", accountIds: [acc.id], format: "FEED",
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(ok.ok).toBe(true);
    const [target] = await repo.listTargets(a.id);
    const r = await cancelTargets(repo, { workspaceId: b.id, userId: "user-b" }, [target!.id]);
    expect(r.cancelled).toBe(0);
    expect((await repo.getTarget(a.id, target!.id))!.status).toBe("scheduled");
  });
});
