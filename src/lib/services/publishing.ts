import type { WorkspaceRepository } from "@/lib/data/repository";
import { validateForInstagram, type MediaIssue } from "@/lib/domain/media-rules";
import { planLimits } from "@/lib/domain/plans";
import { schedulePublicationSchema } from "@/lib/domain/schemas";
import { isCancellable, isReschedulable } from "@/lib/domain/status";
import type { ID, PublicationTarget, Workspace } from "@/lib/domain/types";

export type ScheduleResult =
  | {
      ok: true;
      publicationId: ID;
      duplicate: boolean;
      perAccount: { accountId: ID; username: string; status: "scheduled" | "skipped"; reason?: string; targetId?: ID }[];
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; issues?: MediaIssue[] };

/**
 * Cria uma publicação (individual ou em lote) com validação completa no servidor:
 * schema, posse de contas/mídias pelo workspace, status das contas, regras de mídia
 * do formato, limite do plano e idempotência.
 */
export async function schedulePublication(
  repo: WorkspaceRepository,
  ctx: { workspace: Workspace; userId: ID },
  raw: unknown,
  now: Date = new Date(),
): Promise<ScheduleResult> {
  const parsed = schedulePublicationSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".") || "_"] ??= i.message;
    return { ok: false, error: "Revise os campos destacados.", fieldErrors };
  }
  const input = parsed.data;
  const ws = ctx.workspace.id;

  // Idempotência: requisição repetida (retry de rede, duplo clique) devolve o resultado original.
  const existing = await repo.findPublicationByKey(ws, input.idempotencyKey);
  if (existing) {
    const targets = await repo.listTargets(ws, {});
    const mine = targets.filter((t) => t.publicationId === existing.id);
    return {
      ok: true,
      publicationId: existing.id,
      duplicate: true,
      perAccount: mine.map((t) => ({
        accountId: t.socialAccountId,
        username: t.accountUsername,
        status: "scheduled",
        targetId: t.id,
      })),
    };
  }

  const media = await repo.getMediaByIds(ws, input.mediaIds);
  if (media.length !== input.mediaIds.length) return { ok: false, error: "Mídia não encontrada neste workspace." };
  const unlicensed = media.filter((m) => !m.rightsConfirmed);
  if (unlicensed.length) {
    return { ok: false, error: "Confirme os direitos de uso de todas as mídias na Biblioteca antes de publicar." };
  }

  const issues = validateForInstagram(input.format, media, input.caption);
  if (issues.some((i) => i.level === "error")) {
    return { ok: false, error: "A mídia não atende aos requisitos do formato escolhido.", issues };
  }

  if (input.campaignId) {
    const campaigns = await repo.listCampaigns(ws);
    if (!campaigns.some((c) => c.id === input.campaignId)) return { ok: false, error: "Campanha inválida." };
  }

  const accounts = await repo.listAccounts(ws);
  const perAccount: Extract<ScheduleResult, { ok: true }>["perAccount"] = [];
  const eligible: ID[] = [];
  for (const id of Array.from(new Set(input.accountIds))) {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) {
      perAccount.push({ accountId: id, username: "?", status: "skipped", reason: "Conta não pertence ao workspace." });
    } else if (acc.status !== "active") {
      perAccount.push({ accountId: id, username: acc.username, status: "skipped", reason: "Conta precisa ser reconectada." });
    } else if (!acc.isDemo && !acc.scopes.includes("instagram_business_content_publish")) {
      perAccount.push({ accountId: id, username: acc.username, status: "skipped", reason: "Permissão de publicação não concedida." });
    } else {
      eligible.push(id);
    }
  }
  if (!eligible.length) return { ok: false, error: "Nenhuma conta selecionada está apta a publicar." };

  const limits = planLimits(ctx.workspace.plan);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const used = await repo.countTargetsCreatedSince(ws, monthStart);
  if (used + eligible.length > limits.maxScheduledPerMonth) {
    return {
      ok: false,
      error: `Limite do plano ${limits.name}: ${limits.maxScheduledPerMonth} publicações/mês (usadas: ${used}).`,
    };
  }

  const scheduledAt = input.publishNow ? now.toISOString() : new Date(input.scheduledAt).toISOString();
  const { publication, targets } = await repo.createPublication(
    ws,
    {
      campaignId: input.campaignId ?? null,
      mediaIds: input.mediaIds,
      caption: input.caption,
      format: input.format,
      scheduledAt,
      idempotencyKey: input.idempotencyKey,
      createdBy: ctx.userId,
    },
    eligible,
    "scheduled",
  );

  for (const t of targets) {
    const acc = accounts.find((a) => a.id === t.socialAccountId);
    perAccount.push({ accountId: t.socialAccountId, username: acc?.username ?? "?", status: "scheduled", targetId: t.id });
  }

  await repo.addAudit({
    workspaceId: ws,
    actorId: ctx.userId,
    action: "publication.scheduled",
    entity: "publication",
    entityId: publication.id,
    meta: { accounts: eligible.length, format: input.format, scheduledAt },
  });

  return { ok: true, publicationId: publication.id, duplicate: false, perAccount };
}

export async function cancelTargets(
  repo: WorkspaceRepository,
  ctx: { workspaceId: ID; userId: ID },
  ids: ID[],
): Promise<{ cancelled: number; skipped: number }> {
  let cancelled = 0;
  for (const id of ids) {
    const ok = await repo.updateTargetIf(ctx.workspaceId, id, ["draft", "scheduled", "queued"], {
      status: "cancelled",
      lockedBy: null,
      lockedUntil: null,
    });
    if (ok) cancelled++;
  }
  if (cancelled) {
    await repo.addAudit({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "target.cancelled",
      entity: "publication_target",
      entityId: ids.length === 1 ? ids[0]! : null,
      meta: { count: cancelled },
    });
  }
  return { cancelled, skipped: ids.length - cancelled };
}

export async function rescheduleTarget(
  repo: WorkspaceRepository,
  ctx: { workspaceId: ID; userId: ID },
  id: ID,
  when: Date,
  now: Date = new Date(),
): Promise<{ ok: boolean; error?: string }> {
  if (Number.isNaN(when.getTime()) || when.getTime() < now.getTime() - 60_000) {
    return { ok: false, error: "A nova data precisa estar no futuro." };
  }
  const target = await repo.getTarget(ctx.workspaceId, id);
  if (!target) return { ok: false, error: "Agendamento não encontrado." };
  if (!isReschedulable(target.status)) return { ok: false, error: "Este item não pode mais ser reagendado." };
  const patch: Partial<PublicationTarget> = {
    status: "scheduled",
    scheduledAt: when.toISOString(),
    nextAttemptAt: null,
    attempts: 0,
    lastError: null,
    errorKind: null,
    providerContainerId: null,
  };
  const ok = await repo.updateTargetIf(ctx.workspaceId, id, ["scheduled", "failed"], patch);
  if (ok) {
    await repo.addAudit({
      workspaceId: ctx.workspaceId,
      actorId: ctx.userId,
      action: "target.rescheduled",
      entity: "publication_target",
      entityId: id,
      meta: { scheduledAt: patch.scheduledAt },
    });
  }
  return ok ? { ok } : { ok: false, error: "O status mudou durante a operação. Atualize a página." };
}

export { isCancellable };
