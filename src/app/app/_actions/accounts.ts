"use server";

import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/auth/context";
import { getSystemRepo } from "@/lib/data";
import { accountOrganizeSchema } from "@/lib/domain/schemas";
import { getGraphAdapter, ProviderError } from "@/lib/integrations/instagram";
import { decryptSecret } from "@/lib/security/crypto";
import { toError, type Result } from "./result";

export async function organizeAccountsAction(input: {
  accountIds: string[];
  tags?: string[];
  group?: string | null;
  mode: "set-group" | "add-tags" | "remove-tags" | "clear-tags";
}): Promise<Result> {
  try {
    const ctx = await authorize("editor");
    const parsed = accountOrganizeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    const ws = ctx.workspace.id;
    if (input.mode === "set-group") {
      await ctx.repo.updateAccounts(ws, parsed.data.accountIds, { group: parsed.data.group?.trim() || null });
    } else {
      const accounts = (await ctx.repo.listAccounts(ws)).filter((a) => parsed.data.accountIds.includes(a.id));
      for (const a of accounts) {
        const tags =
          input.mode === "clear-tags"
            ? []
            : input.mode === "add-tags"
              ? Array.from(new Set([...a.tags, ...(parsed.data.tags ?? [])])).slice(0, 20)
              : a.tags.filter((t) => !(parsed.data.tags ?? []).includes(t));
        await ctx.repo.updateAccounts(ws, [a.id], { tags });
      }
    }
    await ctx.repo.addAudit({ workspaceId: ws, actorId: ctx.user.id, action: `accounts.${input.mode}`, entity: "social_account", entityId: null, meta: { count: parsed.data.accountIds.length } });
    revalidatePath("/app/accounts");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function disconnectAccountsAction(ids: string[]): Promise<Result> {
  try {
    const ctx = await authorize("admin");
    const system = getSystemRepo();
    for (const id of ids) {
      const acc = await ctx.repo.getAccount(ctx.workspace.id, id);
      if (!acc) continue;
      await system.deleteCredential(id);
      await ctx.repo.deleteAccount(ctx.workspace.id, id);
      await ctx.repo.addAudit({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "account.disconnected", entity: "social_account", entityId: id, meta: { username: acc.username } });
    }
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    return toError(e);
  }
}

export async function syncAccountsAction(ids: string[]): Promise<Result<{ synced: number; failed: string[] }>> {
  try {
    const ctx = await authorize("editor");
    const system = getSystemRepo();
    const adapter = getGraphAdapter();
    let synced = 0;
    const failed: string[] = [];
    for (const id of ids) {
      const acc = await ctx.repo.getAccount(ctx.workspace.id, id);
      if (!acc) continue;
      if (acc.isDemo) {
        // Contas demo não têm perfil remoto: apenas registra a verificação local.
        await ctx.repo.updateAccounts(ctx.workspace.id, [id], { lastSyncedAt: new Date().toISOString() });
        synced++;
        continue;
      }
      try {
        if (!adapter) throw new Error("Integração não configurada.");
        const cred = await system.getCredential(id);
        if (!cred) throw new ProviderError("Credencial ausente.", "auth");
        const profile = await adapter.getProfile(decryptSecret(cred.ciphertext), acc.providerAccountId);
        await ctx.repo.updateAccounts(ctx.workspace.id, [id], {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          followersCount: profile.followersCount,
          lastSyncedAt: new Date().toISOString(),
          status: "active",
        });
        synced++;
      } catch (err) {
        if (err instanceof ProviderError && err.kind === "auth") {
          await ctx.repo.updateAccounts(ctx.workspace.id, [id], { status: "needs_reauth" });
        }
        failed.push(acc.username);
      }
    }
    revalidatePath("/app/accounts");
    return { ok: true, data: { synced, failed } };
  } catch (e) {
    return toError(e);
  }
}
