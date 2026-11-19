import { instagramConfig } from "@/lib/env";
import type { SocialAccount } from "@/lib/domain/types";
import { DemoInstagramAdapter } from "./demo-adapter";
import { GraphInstagramAdapter } from "./graph-adapter";
import type { InstagramAdapter } from "./types";

export * from "./types";
export { GraphInstagramAdapter, INSTAGRAM_SCOPES } from "./graph-adapter";

const demo = new DemoInstagramAdapter();

/** Integração oficial configurada? (App ID/secret + chave de criptografia). */
export function isInstagramConfigured(): boolean {
  return instagramConfig() !== null;
}

export function getGraphAdapter(): GraphInstagramAdapter | null {
  const cfg = instagramConfig();
  return cfg ? new GraphInstagramAdapter(cfg) : null;
}

/** Contas demo sempre usam o simulador; contas reais exigem a integração configurada. */
export function adapterFor(account: Pick<SocialAccount, "isDemo">): InstagramAdapter | null {
  if (account.isDemo) return demo;
  return getGraphAdapter();
}
