import type { SystemRepository } from "@/lib/data/repository";
import type { ErrorKind, LogLevel, MediaAsset, PublicationTarget, SocialAccount } from "@/lib/domain/types";
import { ProviderError, type InstagramAdapter } from "@/lib/integrations/instagram/types";

/**
 * Motor de publicação.
 *
 *  Agendador (runScheduler):  scheduled → queued   quando scheduled_at <= agora
 *  Executor  (runExecutor):   queued → processing → published | failed | queued (retentativa)
 *
 * Garantias:
 *  - Lease por job (lockedBy/lockedUntil): se o worker morrer, o job volta a ser elegível após o lease.
 *  - Idempotência: o ID do container é persistido ANTES do media_publish; numa retentativa reaproveitamos
 *    o container e, se ele já estiver PUBLISHED, marcamos como publicado sem publicar de novo.
 *  - No máximo 1 job em execução por conta (claim) + limite diário por conta.
 *  - Erros classificados: transient/rate_limit → backoff exponencial; permanent/auth → falha definitiva.
 */
export type EngineDeps = {
  repo: SystemRepository;
  adapterFor: (account: SocialAccount) => InstagramAdapter | null;
  /** Token de acesso descriptografado (null se ausente). */
  getAccessToken: (account: SocialAccount) => Promise<string | null>;
  saveAccessToken: (account: SocialAccount, token: string, expiresAt: string) => Promise<void>;
  /** URL que a plataforma consegue baixar (null se a mídia não for publicamente acessível). */
  mediaFetchUrl: (media: MediaAsset) => Promise<string | null>;
  now: () => Date;
  dailyLimit: number;
  logger?: (entry: Record<string, unknown>) => void;
};

export const LEASE_MS = 5 * 60_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;
const CONTAINER_POLL_MS = 20_000;
const TOKEN_REFRESH_WINDOW_MS = 7 * 24 * 3600_000;

export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1));
  const jitter = exp * 0.2 * random();
  return Math.round(exp + jitter);
}

export async function runScheduler(deps: EngineDeps, limit = 500): Promise<number> {
  const promoted = await deps.repo.promoteDueTargets(deps.now().toISOString(), limit);
  if (promoted) deps.logger?.({ event: "scheduler.promoted", count: promoted });
  return promoted;
}

export type ExecutionResult = { targetId: string; outcome: "published" | "failed" | "retry" | "deferred" | "lost_lease" };

export async function runExecutor(
  deps: EngineDeps,
  workerId: string,
  opts: { batch?: number; leaseMs?: number } = {},
): Promise<ExecutionResult[]> {
  const claimed = await deps.repo.claimTargets(
    workerId,
    deps.now().toISOString(),
    opts.leaseMs ?? LEASE_MS,
    opts.batch ?? 10,
  );
  const results: ExecutionResult[] = [];
  // Contas diferentes em paralelo; o claim já garante 1 job por conta.
  await Promise.all(
    claimed.map(async (t) => {
      try {
        results.push(await processTarget(deps, workerId, t));
      } catch (err) {
        deps.logger?.({ event: "executor.crash", targetId: t.id, error: (err as Error).message });
        results.push({ targetId: t.id, outcome: "retry" });
      }
    }),
  );
  return results;
}

export async function processTarget(
  deps: EngineDeps,
  workerId: string,
  target: PublicationTarget,
): Promise<ExecutionResult> {
  const { repo } = deps;
  const nowIso = () => deps.now().toISOString();
  const log = (level: LogLevel, event: string, message: string, data: Record<string, unknown> | null = null) => {
    deps.logger?.({ level, event, targetId: target.id, message, ...data });
    return repo.appendLog({ workspaceId: target.workspaceId, targetId: target.id, level, event, message, data });
  };
  const update = (patch: Partial<PublicationTarget>) => repo.updateClaimedTarget(target.id, workerId, patch);

  const fail = async (kind: ErrorKind, message: string): Promise<ExecutionResult> => {
    await update({ status: "failed", lastError: message, errorKind: kind, lockedBy: null, lockedUntil: null });
    await log("error", "target.failed", message, { kind });
    return { targetId: target.id, outcome: "failed" };
  };

  const retryLater = async (kind: ErrorKind, message: string, countsAsAttempt: boolean, delayMs?: number) => {
    const attempts = target.attempts + (countsAsAttempt ? 1 : 0);
    if (countsAsAttempt && attempts >= target.maxAttempts) {
      return fail(kind, `${message} (limite de ${target.maxAttempts} tentativas atingido)`);
    }
    const wait = delayMs ?? backoffMs(attempts);
    const next = new Date(deps.now().getTime() + wait).toISOString();
    const ok = await update({
      status: "queued",
      attempts,
      nextAttemptAt: next,
      lastError: message,
      errorKind: kind,
      lockedBy: null,
      lockedUntil: null,
    });
    if (!ok) return { targetId: target.id, outcome: "lost_lease" as const };
    await log(kind === "rate_limit" ? "warn" : "warn", "target.retry_scheduled", message, {
      kind,
      attempts,
      nextAttemptAt: next,
    });
    return { targetId: target.id, outcome: countsAsAttempt ? ("retry" as const) : ("deferred" as const) };
  };

  // 0) Já publicado anteriormente (ex.: worker caiu após publicar, antes de liberar o lease).
  if (target.providerMediaId) {
    await update({ status: "published", lockedBy: null, lockedUntil: null, publishedAt: target.publishedAt ?? nowIso() });
    await log("info", "target.already_published", "Publicação já confirmada anteriormente; nada a fazer.");
    return { targetId: target.id, outcome: "published" };
  }

  await log("info", "target.processing", `Execução iniciada (tentativa ${target.attempts + 1}).`, { workerId });

  const publication = await repo.getPublication(target.publicationId);
  if (!publication) return fail("permanent", "Publicação não encontrada.");

  const account = await repo.getAccountById(target.socialAccountId);
  if (!account) return fail("permanent", "Conta removida.");
  if (account.status === "needs_reauth") return fail("auth", "Conta precisa ser reconectada.");
  if (account.status === "disconnected") return fail("permanent", "Conta desconectada.");

  const adapter = deps.adapterFor(account);
  if (!adapter) return fail("permanent", "Integração oficial do Instagram não configurada no servidor.");

  // 1) Limite diário por conta (ScaleX) — respeita a política da plataforma.
  const since = new Date(deps.now().getTime() - 24 * 3600_000).toISOString();
  const publishedToday = await repo.countPublishedSince(account.id, since);
  if (publishedToday >= deps.dailyLimit) {
    return retryLater("rate_limit", `Limite de ${deps.dailyLimit} publicações/24h atingido para @${account.username}.`, false, 60 * 60_000);
  }

  // 2) Token
  let token = account.isDemo ? "demo-token" : await deps.getAccessToken(account);
  if (!token) {
    await repo.updateAccountSystem(account.id, { status: "needs_reauth" });
    return fail("auth", "Credencial ausente. Reconecte a conta.");
  }
  if (!account.isDemo && account.tokenExpiresAt) {
    const expiresAt = Date.parse(account.tokenExpiresAt);
    if (expiresAt <= deps.now().getTime()) {
      await repo.updateAccountSystem(account.id, { status: "needs_reauth" });
      return fail("auth", "Token expirado. Reconecte a conta.");
    }
    if (expiresAt - deps.now().getTime() < TOKEN_REFRESH_WINDOW_MS) {
      try {
        const r = await adapter.refreshToken(token);
        token = r.accessToken;
        const exp = new Date(deps.now().getTime() + r.expiresInSec * 1000).toISOString();
        await deps.saveAccessToken(account, token, exp);
        await log("info", "token.refreshed", "Token renovado automaticamente.");
      } catch (err) {
        await log("warn", "token.refresh_failed", (err as Error).message);
      }
    }
  }

  try {
    // 3) Quota oficial (quando disponível)
    const quota = await adapter.getPublishingQuota(token, account.providerAccountId);
    if (quota && quota.used >= quota.total) {
      return retryLater("rate_limit", "Quota oficial de publicação da conta esgotada.", false, 60 * 60_000);
    }

    // 4) Container (reutiliza se já criado)
    let containerId = target.providerContainerId;
    if (!containerId) {
      const media = await repo.getMediaSystem(publication.mediaIds);
      if (media.length !== publication.mediaIds.length) return fail("permanent", "Mídia removida da biblioteca.");
      const items = [];
      for (const m of media) {
        const url = adapter.simulated ? `demo://${m.id}` : await deps.mediaFetchUrl(m);
        if (!url) {
          return fail("permanent", "Mídia sem URL pública acessível pela Meta (configure o Supabase Storage).");
        }
        items.push({ kind: m.kind, url });
      }
      containerId = await adapter.createContainer(token, account.providerAccountId, {
        format: publication.format,
        media: items,
        caption: publication.caption,
      });
      if (!(await update({ providerContainerId: containerId }))) return { targetId: target.id, outcome: "lost_lease" };
      await log("info", "container.created", "Container de mídia criado.", { containerId });
    }

    // 5) Status do container
    const status = await adapter.getContainerStatus(token, containerId);
    if (status.status === "IN_PROGRESS") {
      return retryLater("transient", "Mídia ainda em processamento pela plataforma.", false, CONTAINER_POLL_MS);
    }
    if (status.status === "ERROR") return fail("permanent", `Plataforma rejeitou a mídia: ${status.message ?? "erro"}`);
    if (status.status === "EXPIRED") {
      await update({ providerContainerId: null });
      return retryLater("transient", "Container expirou (24h); será recriado.", true);
    }
    if (status.status === "PUBLISHED") {
      await update({ status: "published", publishedAt: nowIso(), simulated: adapter.simulated, lockedBy: null, lockedUntil: null, lastError: null, errorKind: null });
      await log("warn", "target.published_detected", "Container já estava publicado; evitada publicação duplicada.");
      return { targetId: target.id, outcome: "published" };
    }

    // 6) Publicar
    const { mediaId } = await adapter.publishContainer(token, account.providerAccountId, containerId);
    const permalink = await adapter.getPermalink(token, mediaId);
    await update({
      status: "published",
      providerMediaId: mediaId,
      permalink,
      publishedAt: nowIso(),
      simulated: adapter.simulated,
      lastError: null,
      errorKind: null,
      lockedBy: null,
      lockedUntil: null,
      attempts: target.attempts + 1,
    });
    await log(
      "info",
      "target.published",
      adapter.simulated ? "Publicação SIMULADA concluída (modo demo, nada foi enviado)." : "Publicado no Instagram.",
      { mediaId, permalink },
    );
    return { targetId: target.id, outcome: "published" };
  } catch (err) {
    const e = err instanceof ProviderError ? err : new ProviderError((err as Error).message, "transient");
    if (e.kind === "auth") {
      await repo.updateAccountSystem(account.id, { status: "needs_reauth" });
      return fail("auth", `Autorização inválida: ${e.message}`);
    }
    if (e.kind === "permanent") return fail("permanent", e.message);
    if (e.kind === "rate_limit") return retryLater("rate_limit", e.message, false, 15 * 60_000);
    return retryLater("transient", e.message, true);
  }
}
