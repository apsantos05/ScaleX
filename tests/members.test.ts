import { beforeEach, describe, expect, it } from "vitest";
import { DemoRepository } from "@/lib/data/demo-repository";
import { DemoStore } from "@/lib/data/demo-store";
import { MemberError } from "@/lib/domain/members";
import type { Workspace } from "@/lib/domain/types";
import { hashToken, isWellFormedToken, newToken } from "@/lib/security/tokens";

let repo: DemoRepository;
let store: DemoStore;
let ws: Workspace;
const OWNER = "owner-1";
const in7d = () => new Date(Date.now() + 7 * 86_400_000).toISOString();

async function invite(email: string, role: "admin" | "editor" | "viewer" = "editor", expiresAt = in7d()) {
  const token = newToken();
  const inv = await repo.createInvitation(ws.id, { email, role, tokenHash: hashToken(token), invitedBy: OWNER, expiresAt });
  return { token, inv };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof MemberError ? e.code : String(e);
  }
};

beforeEach(async () => {
  store = DemoStore.inMemory();
  repo = new DemoRepository(store);
  ws = await repo.createWorkspace(OWNER, "Agência");
});

describe("tokens de convite", () => {
  it("gera tokens únicos, bem formados e guarda só o hash", () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
    expect(isWellFormedToken("x")).toBe(false);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("convites", () => {
  it("convidado com o mesmo e-mail entra com o papel do convite", async () => {
    const { token } = await invite("Socio@Empresa.com", "admin");
    const preview = await repo.previewInvitation(hashToken(token));
    expect(preview).toMatchObject({ workspaceName: "Agência", role: "admin", status: "valid" });
    const joined = await repo.acceptInvitation(hashToken(token), { id: "user-2", email: "socio@empresa.com" });
    expect(joined).toBe(ws.id);
    expect((await repo.getMembership(ws.id, "user-2"))?.role).toBe("admin");
    expect(await repo.listInvitations(ws.id)).toHaveLength(0);
  });

  it("rejeita e-mail diferente, link reutilizado, revogado, expirado e inexistente", async () => {
    const { token } = await invite("a@x.com");
    expect(await code(repo.acceptInvitation(hashToken(token), { id: "u", email: "outro@x.com" }))).toBe("email_mismatch");
    await repo.acceptInvitation(hashToken(token), { id: "u", email: "a@x.com" });
    expect(await code(repo.acceptInvitation(hashToken(token), { id: "u", email: "a@x.com" }))).toBe("accepted");

    const r = await invite("b@x.com");
    expect(await repo.revokeInvitation(ws.id, r.inv.id)).toBe(true);
    expect(await code(repo.acceptInvitation(hashToken(r.token), { id: "u2", email: "b@x.com" }))).toBe("revoked");

    const e = await invite("c@x.com", "editor", new Date(Date.now() - 1000).toISOString());
    expect(await code(repo.acceptInvitation(hashToken(e.token), { id: "u3", email: "c@x.com" }))).toBe("expired");

    expect(await code(repo.acceptInvitation(hashToken(newToken()), { id: "u4", email: "d@x.com" }))).toBe("not_found");
  });

  it("o hash do token não aparece na listagem", async () => {
    await invite("a@x.com");
    const [listed] = await repo.listInvitations(ws.id);
    expect(Object.keys(listed!)).not.toContain("tokenHash");
  });

  it("convites de um workspace não aparecem em outro", async () => {
    await invite("a@x.com");
    const other = await repo.createWorkspace("outro-dono", "Outro");
    expect(await repo.listInvitations(other.id)).toHaveLength(0);
    expect(await repo.revokeInvitation(other.id, (await repo.listInvitations(ws.id))[0]!.id)).toBe(false);
  });
});

describe("papéis e remoção", () => {
  async function addMember(id: string, role: "admin" | "editor" | "viewer") {
    const { token } = await invite(`${id}@x.com`, role);
    await repo.acceptInvitation(hashToken(token), { id, email: `${id}@x.com` });
  }

  it("protege o último proprietário e impede alterar o próprio papel", async () => {
    expect(await code(repo.setMemberRole(ws.id, OWNER, OWNER, "editor"))).toBe("self");
    expect(await code(repo.removeMember(ws.id, OWNER, OWNER))).toBe("self");
    await addMember("adm", "admin");
    expect(await code(repo.removeMember(ws.id, "adm", OWNER))).toBe("forbidden");
    expect(await code(repo.setMemberRole(ws.id, "adm", OWNER, "viewer"))).toBe("forbidden");
  });

  it("admin gerencia editores, mas não promove a proprietário", async () => {
    await addMember("adm", "admin");
    await addMember("ed", "editor");
    expect(await code(repo.setMemberRole(ws.id, "adm", "ed", "viewer"))).toBe("ok");
    expect(await code(repo.setMemberRole(ws.id, "adm", "ed", "owner"))).toBe("forbidden");
    expect(await code(repo.removeMember(ws.id, "adm", "ed"))).toBe("ok");
    expect(await repo.getMembership(ws.id, "ed")).toBeNull();
  });

  it("editor e leitor não gerenciam membros", async () => {
    await addMember("ed", "editor");
    await addMember("vw", "viewer");
    expect(await code(repo.setMemberRole(ws.id, "ed", "vw", "editor"))).toBe("forbidden");
    expect(await code(repo.removeMember(ws.id, "vw", "ed"))).toBe("forbidden");
  });

  it("com dois proprietários, um pode rebaixar o outro", async () => {
    await addMember("socio", "admin");
    await repo.setMemberRole(ws.id, OWNER, "socio", "owner");
    expect(await code(repo.setMemberRole(ws.id, "socio", OWNER, "admin"))).toBe("ok");
    expect(await code(repo.setMemberRole(ws.id, OWNER, "socio", "admin"))).toBe("forbidden");
  });
});
