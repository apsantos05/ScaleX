import { beforeEach, describe, expect, it } from "vitest";
import { DemoRepository } from "@/lib/data/demo-repository";
import { DemoStore } from "@/lib/data/demo-store";
import type { SocialAccount, Workspace } from "@/lib/domain/types";
import { backoffMs, processTarget, runExecutor, runScheduler, type EngineDeps } from "@/lib/jobs/engine";
import { ProviderError, type InstagramAdapter } from "@/lib/integrations/instagram/types";
import { schedulePublication } from "@/lib/services/publishing";

class FakeAdapter implements InstagramAdapter {
  readonly simulated = false;
  calls = { create: 0, publish: 0, status: 0 };
  failCreate: ProviderError[] = [];
  failPublish: ProviderError[] = [];
  containerStatus: "FINISHED" | "IN_PROGRESS" | "PUBLISHED" = "FINISHED";
  async getProfile(): Promise<never> {
    throw new Error("n/a");
  }
  async createContainer() {
    this.calls.create++;
    const e = this.failCreate.shift();
    if (e) throw e;
    return `c-${this.calls.create}`;
  }
  async getContainerStatus() {
    this.calls.status++;
    return { status: this.containerStatus };
  }
  async publishContainer() {
    this.calls.publish++;
    const e = this.failPublish.shift();
    if (e) throw e;
    return { mediaId: `m-${this.calls.publish}` };
  }
  async getPermalink() {
    return "https://instagram.com/p/x";
  }
  async getPublishingQuota() {
    return { used: 0, total: 50 };
  }
  async refreshToken(t: string) {
    return { accessToken: t, expiresInSec: 3600 };
  }
  async getMediaBasic() {
    return { likes: null, comments: null };
  }
  async listAccountMedia() {
    return [];
  }
  async getMediaInsights() {
    return { reach: null, views: null, likes: null, comments: null, saved: null, shares: null };
  }
}

let repo: DemoRepository;
let ws: Workspace;
let accounts: SocialAccount[];
let adapter: FakeAdapter;
let clock: Date;
let deps: EngineDeps;
let mediaId: string;

async function makeAccount(name: string) {
  return repo.upsertAccount(ws.id, {
    provider: "instagram",
    providerAccountId: `ig-${name}`,
    username: name,
    displayName: name,
    avatarUrl: null,
    accountType: "BUSINESS",
    status: "active",
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    tags: [],
    group: null,
    followersCount: null,
    lastSyncedAt: null,
    tokenExpiresAt: null,
    isDemo: false,
  });
}

async function schedule(accountIds: string[], key = crypto.randomUUID(), caption = "Olá") {
  return schedulePublication(
    repo,
    { workspace: ws, userId: "u1" },
    {
      idempotencyKey: key,
      mediaIds: [mediaId],
      caption,
      accountIds,
      format: "FEED",
      scheduledAt: new Date(clock.getTime() + 60_000).toISOString(),
    },
    clock,
  );
}

beforeEach(async () => {
  repo = new DemoRepository(DemoStore.inMemory());
  ws = await repo.createWorkspace("u1", "Agência Teste");
  accounts = [await makeAccount("alpha"), await makeAccount("beta")];
  const m = await repo.createMedia(ws.id, {
    kind: "image",
    fileName: "a.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1000,
    width: 1080,
    height: 1350,
    durationSec: null,
    storagePath: `${ws.id}/a.jpg`,
    folder: null,
    tags: [],
    rightsConfirmed: true,
    rightsNote: null,
    createdBy: "u1",
  });
  mediaId = m.id;
  adapter = new FakeAdapter();
  clock = new Date("2026-11-20T12:00:00Z");
  deps = {
    repo,
    adapterFor: () => adapter,
    getAccessToken: async () => "tok",
    saveAccessToken: async () => undefined,
    mediaFetchUrl: async () => "https://cdn.example/a.jpg",
    now: () => clock,
    dailyLimit: 25,
  };
});

const advance = (ms: number) => (clock = new Date(clock.getTime() + ms));

describe("schedulePublication", () => {
  it("cria um target por conta e é idempotente pela chave", async () => {
    const key = crypto.randomUUID();
    const r1 = await schedule(accounts.map((a) => a.id), key);
    const r2 = await schedule(accounts.map((a) => a.id), key);
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r2.duplicate).toBe(true);
    expect(r2.publicationId).toBe(r1.publicationId);
    expect((await repo.listTargets(ws.id)).length).toBe(2);
  });

  it("ignora contas que precisam de reconexão e informa individualmente", async () => {
    await repo.updateAccounts(ws.id, [accounts[1]!.id], { status: "needs_reauth" });
    const r = await schedule(accounts.map((a) => a.id));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.perAccount.find((p) => p.username === "beta")?.status).toBe("skipped");
    expect(r.perAccount.find((p) => p.username === "alpha")?.status).toBe("scheduled");
  });

  it("bloqueia mídia sem direitos de uso confirmados", async () => {
    await repo.updateMedia(ws.id, [mediaId], { rightsConfirmed: false });
    const r = await schedule([accounts[0]!.id]);
    expect(r.ok).toBe(false);
  });

  it("rejeita PNG no Instagram (API aceita só JPEG)", async () => {
    await repo.updateMedia(ws.id, [mediaId], {});
    const db = repo as unknown as { store: DemoStore };
    await db.store.mutate((d) => {
      d.media[0]!.mimeType = "image/png";
    });
    const r = await schedule([accounts[0]!.id]);
    expect(r.ok).toBe(false);
  });
});

describe("motor de jobs", () => {
  it("agendador só promove itens vencidos; executor publica", async () => {
    await schedule([accounts[0]!.id]);
    expect(await runScheduler(deps)).toBe(0);
    advance(61_000);
    expect(await runScheduler(deps)).toBe(1);
    const res = await runExecutor(deps, "w1");
    expect(res).toEqual([{ targetId: expect.any(String), outcome: "published" }]);
    const [t] = await repo.listTargets(ws.id);
    expect(t!.status).toBe("published");
    expect(t!.providerMediaId).toBe("m-1");
    expect(t!.permalink).toContain("instagram.com");
  });

  it("falha transitória → retentativa com backoff, sem recriar container", async () => {
    await schedule([accounts[0]!.id]);
    advance(61_000);
    await runScheduler(deps);
    adapter.failPublish.push(new ProviderError("timeout", "transient"));
    const r1 = await runExecutor(deps, "w1");
    expect(r1[0]!.outcome).toBe("retry");
    let [t] = await repo.listTargets(ws.id);
    expect(t!.status).toBe("queued");
    expect(t!.attempts).toBe(1);
    expect(t!.providerContainerId).toBe("c-1");

    // Antes do backoff: nada é reivindicado.
    expect(await runExecutor(deps, "w1")).toEqual([]);
    advance(backoffMs(1, () => 1) + 1);
    const r2 = await runExecutor(deps, "w1");
    expect(r2[0]!.outcome).toBe("published");
    expect(adapter.calls.create).toBe(1);
    [t] = await repo.listTargets(ws.id);
    expect(t!.status).toBe("published");
  });

  it("erro permanente vai direto para failed", async () => {
    await schedule([accounts[0]!.id]);
    advance(61_000);
    await runScheduler(deps);
    adapter.failCreate.push(new ProviderError("mídia inválida", "permanent"));
    await runExecutor(deps, "w1");
    const [t] = await repo.listTargets(ws.id);
    expect(t!.status).toBe("failed");
    expect(t!.errorKind).toBe("permanent");
  });

  it("erro de autenticação marca a conta para reconexão", async () => {
    await schedule([accounts[0]!.id]);
    advance(61_000);
    await runScheduler(deps);
    adapter.failCreate.push(new ProviderError("token expirado", "auth"));
    await runExecutor(deps, "w1");
    expect((await repo.getAccount(ws.id, accounts[0]!.id))!.status).toBe("needs_reauth");
  });

  it("esgota tentativas após maxAttempts", async () => {
    await schedule([accounts[0]!.id]);
    advance(61_000);
    await runScheduler(deps);
    for (let i = 0; i < 5; i++) {
      adapter.failCreate.push(new ProviderError("503", "transient"));
      await runExecutor(deps, "w1");
      advance(60 * 60_000);
    }
    const [t] = await repo.listTargets(ws.id);
    expect(t!.status).toBe("failed");
    expect(t!.attempts).toBe(4);
  });

  it("container já PUBLISHED não é publicado de novo (sem duplicidade)", async () => {
    await schedule([accounts[0]!.id]);
    advance(61_000);
    await runScheduler(deps);
    adapter.failPublish.push(new ProviderError("rede caiu", "transient"));
    await runExecutor(deps, "w1");
    adapter.containerStatus = "PUBLISHED";
    advance(60 * 60_000);
    await runExecutor(deps, "w1");
    expect(adapter.calls.publish).toBe(1);
    expect((await repo.listTargets(ws.id))[0]!.status).toBe("published");
  });

  it("recupera jobs com lease vencido (worker reiniciado)", async () => {
    await schedule([accounts[0]!.id]);
    advance(61_000);
    await runScheduler(deps);
    const claimed = await repo.claimTargets("w-morto", clock.toISOString(), 60_000, 10);
    expect(claimed).toHaveLength(1);
    expect(await runExecutor(deps, "w2")).toEqual([]); // lease ainda válido
    advance(61_000);
    const res = await runExecutor(deps, "w2");
    expect(res[0]!.outcome).toBe("published");
    // worker antigo perdeu o lease: suas escritas são rejeitadas
    expect(await repo.updateClaimedTarget(claimed[0]!.id, "w-morto", { lastError: "x" })).toBe(false);
  });

  it("no máximo um job por conta por rodada", async () => {
    await schedule([accounts[0]!.id]);
    await schedule([accounts[0]!.id]);
    await schedule([accounts[1]!.id]);
    advance(61_000);
    await runScheduler(deps);
    const claimed = await repo.claimTargets("w1", clock.toISOString(), 60_000, 10);
    expect(claimed).toHaveLength(2);
    expect(new Set(claimed.map((c) => c.socialAccountId)).size).toBe(2);
  });

  it("respeita o limite diário por conta adiando sem consumir tentativa", async () => {
    deps.dailyLimit = 1;
    await schedule([accounts[0]!.id]);
    await schedule([accounts[0]!.id]);
    advance(61_000);
    await runScheduler(deps);
    await runExecutor(deps, "w1");
    const r = await runExecutor(deps, "w1");
    expect(r[0]!.outcome).toBe("deferred");
    const queued = (await repo.listTargets(ws.id)).find((t) => t.status === "queued");
    expect(queued?.attempts).toBe(0);
    expect(queued?.errorKind).toBe("rate_limit");
  });

  it("conta sem integração configurada falha de forma explícita", async () => {
    deps.adapterFor = () => null;
    await schedule([accounts[0]!.id]);
    advance(61_000);
    await runScheduler(deps);
    const [claimed] = await repo.claimTargets("w1", clock.toISOString(), 60_000, 1);
    const r = await processTarget(deps, "w1", claimed!);
    expect(r.outcome).toBe("failed");
  });
});
