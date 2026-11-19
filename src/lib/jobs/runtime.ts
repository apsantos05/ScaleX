import { getSystemRepo } from "@/lib/data/system";
import { dailyPublishLimit } from "@/lib/env";
import { adapterFor } from "@/lib/integrations/instagram";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import { publicFetchUrl } from "@/lib/storage";
import { runExecutor, runScheduler, type EngineDeps } from "./engine";

/** Dependências reais do motor (usadas pelo worker e pelo endpoint de cron). */
export function createEngineDeps(): EngineDeps {
  const repo = getSystemRepo();
  return {
    repo,
    adapterFor,
    now: () => new Date(),
    dailyLimit: dailyPublishLimit(),
    mediaFetchUrl: (m) => publicFetchUrl(m.storagePath),
    getAccessToken: async (account) => {
      const cred = await repo.getCredential(account.id);
      if (!cred) return null;
      try {
        return decryptSecret(cred.ciphertext);
      } catch {
        return null;
      }
    },
    saveAccessToken: async (account, token, expiresAt) => {
      await repo.saveCredential(account.id, encryptSecret(token), expiresAt);
      await repo.updateAccountSystem(account.id, { tokenExpiresAt: expiresAt });
    },
    logger: (entry) => console.log(JSON.stringify({ ts: new Date().toISOString(), svc: "engine", ...entry })),
  };
}

/** Uma rodada completa: agendador e executor são etapas separadas e independentes. */
export async function tick(workerId: string) {
  const deps = createEngineDeps();
  const promoted = await runScheduler(deps);
  const results = await runExecutor(deps, workerId);
  return { promoted, results };
}
