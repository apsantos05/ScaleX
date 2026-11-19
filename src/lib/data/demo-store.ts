import fs from "node:fs/promises";
import path from "node:path";
import type {
  AuditEntry,
  Campaign,
  CaptionTemplate,
  ExecutionLog,
  Invitation,
  MediaAsset,
  Publication,
  PublicationTarget,
  Role,
  SocialAccount,
  User,
  Workspace,
} from "@/lib/domain/types";
import type { EncryptedCredential } from "./repository";

export type DemoUser = User & { passwordHash: string; createdAt: string };
export type DemoMember = { workspaceId: string; userId: string; role: Role; createdAt: string };
export type DemoInvitation = Invitation & { tokenHash: string; acceptedBy: string | null };

export type DemoDB = {
  version: 1;
  users: DemoUser[];
  workspaces: Workspace[];
  members: DemoMember[];
  invitations: DemoInvitation[];
  accounts: SocialAccount[];
  credentials: EncryptedCredential[];
  media: MediaAsset[];
  captions: CaptionTemplate[];
  campaigns: Campaign[];
  publications: Publication[];
  targets: PublicationTarget[];
  logs: ExecutionLog[];
  audit: AuditEntry[];
};

export function emptyDb(): DemoDB {
  return {
    version: 1,
    users: [],
    workspaces: [],
    members: [],
    invitations: [],
    accounts: [],
    credentials: [],
    media: [],
    captions: [],
    campaigns: [],
    publications: [],
    targets: [],
    logs: [],
    audit: [],
  };
}

const MAX_LOGS = 5_000;
const MAX_AUDIT = 2_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Armazenamento JSON local para o MODO DEMO.
 * - Cada mutação: lock entre processos (diretório .lock) → lê → altera → grava atomicamente (tmp + rename).
 * - Permite que o servidor Next e o worker (`npm run worker`) compartilhem o mesmo arquivo.
 * Não é adequado para produção (sem índices, sem concorrência real); serve para testar jornadas.
 */
export class DemoStore {
  private memory: DemoDB | null = null;

  constructor(private readonly filePath: string | null) {}

  static inMemory(): DemoStore {
    const s = new DemoStore(null);
    s.memory = emptyDb();
    return s;
  }

  async read(): Promise<DemoDB> {
    if (!this.filePath) return structuredClone(this.memory ?? emptyDb());
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const db = JSON.parse(raw) as DemoDB;
      db.invitations ??= []; // compatível com arquivos criados antes dos convites
      return db;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyDb();
      throw err;
    }
  }

  async mutate<T>(fn: (db: DemoDB) => T | Promise<T>): Promise<T> {
    if (!this.filePath) {
      const db = this.memory ?? emptyDb();
      const result = await fn(db);
      this.memory = db;
      return result;
    }
    const release = await this.lock();
    try {
      const db = await this.read();
      const result = await fn(db);
      if (db.logs.length > MAX_LOGS) db.logs = db.logs.slice(-MAX_LOGS);
      if (db.audit.length > MAX_AUDIT) db.audit = db.audit.slice(-MAX_AUDIT);
      const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db), "utf8");
      await renameWithRetry(tmp, this.filePath);
      return result;
    } finally {
      await release();
    }
  }

  private async lock(): Promise<() => Promise<void>> {
    const lockDir = `${this.filePath}.lock`;
    await fs.mkdir(path.dirname(lockDir), { recursive: true });
    const started = Date.now();
    for (;;) {
      try {
        await fs.mkdir(lockDir);
        return async () => {
          await fs.rm(lockDir, { recursive: true, force: true });
        };
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
        // Lock órfão (processo morreu): libera após 10s.
        try {
          const stat = await fs.stat(lockDir);
          if (Date.now() - stat.mtimeMs > 10_000) {
            await fs.rm(lockDir, { recursive: true, force: true });
            continue;
          }
        } catch {
          continue;
        }
        if (Date.now() - started > 15_000) throw new Error("Timeout aguardando lock do banco demo.");
        await sleep(15 + Math.random() * 25);
      }
    }
  }
}

/** No Windows, rename pode falhar momentaneamente se outro processo estiver lendo o arquivo. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (i >= 10 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw err;
      await sleep(20 * (i + 1));
    }
  }
}

export function demoDataDir(): string {
  return path.join(process.cwd(), ".data");
}

let singleton: DemoStore | null = null;
export function getDemoStore(): DemoStore {
  singleton ??= new DemoStore(path.join(demoDataDir(), "demo-db.json"));
  return singleton;
}
