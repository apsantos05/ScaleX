import { randomUUID } from "node:crypto";
import { ProviderError, type InstagramAdapter } from "./types";

/**
 * Adapter SIMULADO usado por contas de demonstração.
 * Não faz nenhuma chamada de rede e não publica nada. Os resultados são marcados como
 * `simulated` em toda a interface.
 *
 * Gatilhos para testar falhas pela legenda:
 *   #demo-falha-temporaria  → erro transitório (testa retentativa com backoff)
 *   #demo-falha-permanente  → erro permanente (vai direto para Failed)
 */
export class DemoInstagramAdapter implements InstagramAdapter {
  readonly simulated = true;
  private readonly containers = new Map<string, number>();

  async getProfile(): Promise<never> {
    throw new ProviderError("Contas demo não possuem perfil remoto.", "permanent");
  }

  async createContainer(_t: string, _u: string, input: { caption: string }) {
    if (input.caption.includes("#demo-falha-permanente")) {
      throw new ProviderError("[Simulação] Mídia rejeitada pela plataforma.", "permanent", "DEMO");
    }
    if (input.caption.includes("#demo-falha-temporaria") && Math.random() < 0.7) {
      throw new ProviderError("[Simulação] Serviço temporariamente indisponível.", "transient", "DEMO");
    }
    const id = `demo-container-${randomUUID()}`;
    this.containers.set(id, Date.now());
    return id;
  }

  async getContainerStatus() {
    return { status: "FINISHED" as const };
  }

  async publishContainer() {
    return { mediaId: `demo-media-${randomUUID()}` };
  }

  async getPermalink() {
    return null;
  }

  async getPublishingQuota() {
    return null;
  }

  async refreshToken(accessToken: string) {
    return { accessToken, expiresInSec: 60 * 24 * 3600 };
  }

  async getMediaInsights() {
    return { reach: null, views: null, likes: null, comments: null, saved: null, shares: null };
  }
}
