/**
 * Verificação de integração contra o projeto Supabase configurado no .env.local.
 *   npm run verify:supabase
 *
 * Cria 2 usuários temporários (e-mails @scalex.test, senhas aleatórias nunca exibidas), exercita RLS,
 * storage e funções do worker, e REMOVE tudo ao final (usuários, workspaces em cascata e arquivos).
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !ANON || !SERVICE) throw new Error("Variáveis do Supabase ausentes no .env.local");

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const results: { ok: boolean; name: string; detail?: string }[] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push({ ok, name, detail });

async function makeUser(tag: string) {
  const email = `verify-${tag}-${Date.now()}@scalex.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: `Verify ${tag}` } });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const s = await client.auth.signInWithPassword({ email, password });
  if (s.error) throw new Error(`signIn: ${s.error.message}`);
  return { id: data.user.id, client, email };
}

async function main() {
  const created: string[] = [];
  const files: string[] = [];
  try {
    // 1) Bucket privado
    const { data: bucket } = await admin.storage.getBucket("media");
    check("bucket `media` existe e é privado", !!bucket && bucket.public === false);

    // 2) Usuários + perfis via trigger
    const a = await makeUser("a");
    const b = await makeUser("b");
    created.push(a.id, b.id);
    const prof = await admin.from("profiles").select("id").in("id", [a.id, b.id]);
    check("trigger cria perfis", prof.data?.length === 2);

    // 3) Workspaces via RPC
    const wsA = await a.client.rpc("create_workspace", { p_name: "Verify A", p_slug: `verify-a-${randomUUID().slice(0, 6)}` });
    const wsB = await b.client.rpc("create_workspace", { p_name: "Verify B", p_slug: `verify-b-${randomUUID().slice(0, 6)}` });
    check("create_workspace (RPC) funciona", !wsA.error && !wsB.error, wsA.error?.message ?? wsB.error?.message);
    const A = (wsA.data as { id: string }).id;
    check("workspace de B criado", !!(wsB.data as { id?: string } | null)?.id);

    // 4) Dados de A
    const acc = await a.client.from("social_accounts").insert({ workspace_id: A, provider_account_id: "v1", username: "verify_a", scopes: ["instagram_business_content_publish"] }).select("id").single();
    check("membro insere conta no próprio workspace", !acc.error, acc.error?.message);
    const accId = acc.data!.id as string;

    // 5) Isolamento
    const bSeesWs = await b.client.from("workspaces").select("id").eq("id", A);
    check("B não vê o workspace de A", bSeesWs.data?.length === 0);
    const bSeesAcc = await b.client.from("social_accounts").select("id").eq("workspace_id", A);
    check("B não vê contas de A", bSeesAcc.data?.length === 0);
    const bInsert = await b.client.from("social_accounts").insert({ workspace_id: A, provider_account_id: "x", username: "invasor" });
    check("B não insere no workspace de A", !!bInsert.error);
    const bUpdate = await b.client.from("social_accounts").update({ username: "hack" }).eq("id", accId).select("id");
    check("B não altera conta de A", (bUpdate.data?.length ?? 0) === 0);
    const bMember = await b.client.from("workspace_members").insert({ workspace_id: A, user_id: b.id, role: "owner" });
    check("B não se adiciona como membro de A", !!bMember.error);
    const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
    const anonRead = await anonClient.from("social_accounts").select("id");
    check("anônimo não lê dados", (anonRead.data?.length ?? 0) === 0);

    // 6) Credenciais inacessíveis para usuários
    await admin.from("social_account_credentials").insert({ account_id: accId, ciphertext: "v1.test.test.test" });
    const aCred = await a.client.from("social_account_credentials").select("*");
    check("nem o dono lê credenciais via API (só service role)", (aCred.data?.length ?? 0) === 0);
    const sCred = await admin.from("social_account_credentials").select("account_id").eq("account_id", accId);
    check("service role lê credenciais", sCred.data?.length === 1);

    // 7) Storage por pasta do workspace
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8])], { type: "image/jpeg" });
    const pathA = `${A}/${randomUUID()}.jpg`;
    const upA = await a.client.storage.from("media").upload(pathA, blob);
    if (!upA.error) files.push(pathA);
    check("A envia arquivo para sua pasta", !upA.error, upA.error?.message);
    const pathBinA = `${A}/${randomUUID()}.jpg`;
    const upB = await b.client.storage.from("media").upload(pathBinA, blob);
    if (!upB.error) files.push(pathBinA);
    check("B não envia arquivo na pasta de A", !!upB.error);
    const dlB = await b.client.storage.from("media").download(pathA);
    check("B não baixa arquivo de A", !!dlB.error);

    // 7b) Convites e papéis (RLS + funções)
    const c = await makeUser("c");
    created.push(c.id);
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const inv = await a.client.from("workspace_invitations").insert({ workspace_id: A, email: b.email, role: "editor", token_hash: tokenHash, invited_by: a.id, expires_at: new Date(Date.now() + 86_400_000).toISOString() }).select("id").single();
    check("owner cria convite", !inv.error, inv.error?.message);
    const bInvites = await b.client.from("workspace_invitations").select("id").eq("workspace_id", A);
    check("não-membro não lista convites alheios", (bInvites.data?.length ?? 0) === 0);
    const anonPrev = await createClient(URL, ANON, { auth: { persistSession: false } }).rpc("get_invitation_preview", { p_token_hash: tokenHash });
    check("anônimo não pré-visualiza convite", !!anonPrev.error);
    const prev = await b.client.rpc("get_invitation_preview", { p_token_hash: tokenHash });
    check("convidado pré-visualiza o convite", (prev.data as { status: string }[] | null)?.[0]?.status === "valid", prev.error?.message);
    const wrong = await c.client.rpc("accept_invitation", { p_token_hash: tokenHash });
    check("outro e-mail não aceita o convite", !!wrong.error && wrong.error.message.includes("email_mismatch"), wrong.error?.message);
    const accepted = await b.client.rpc("accept_invitation", { p_token_hash: tokenHash });
    check("convidado aceita e vira membro", accepted.data === A, accepted.error?.message);
    const again = await b.client.rpc("accept_invitation", { p_token_hash: tokenHash });
    check("link não pode ser reutilizado", !!again.error && again.error.message.includes("accepted"));
    const bSeesNow = await b.client.from("social_accounts").select("id").eq("workspace_id", A);
    check("novo membro passa a ver os dados do workspace", (bSeesNow.data?.length ?? 0) === 1);
    const bPromote = await b.client.rpc("set_member_role", { p_workspace: A, p_user: b.id, p_role: "owner" });
    check("editor não altera papéis", !!bPromote.error);
    const bDirect = await b.client.from("workspace_members").update({ role: "owner" }).eq("workspace_id", A).eq("user_id", b.id).select("user_id");
    check("escrita direta em membros é bloqueada", (bDirect.data?.length ?? 0) === 0);
    const selfDemote = await a.client.rpc("set_member_role", { p_workspace: A, p_user: a.id, p_role: "viewer" });
    check("dono não altera o próprio papel", !!selfDemote.error && selfDemote.error.message.includes("self"));
    const toViewer = await a.client.rpc("set_member_role", { p_workspace: A, p_user: b.id, p_role: "viewer" });
    check("dono altera papel de membro", !toViewer.error, toViewer.error?.message);
    const rm = await a.client.rpc("remove_member", { p_workspace: A, p_user: b.id });
    const gone = await admin.from("workspace_members").select("user_id").eq("workspace_id", A).eq("user_id", b.id);
    check("dono remove membro", !rm.error && gone.data?.length === 0, rm.error?.message);

    // 8) Publicação idempotente + fila do worker
    const key = randomUUID();
    const media = await a.client.from("media_assets").insert({ workspace_id: A, kind: "image", file_name: "v.jpg", mime_type: "image/jpeg", size_bytes: 12, storage_path: pathA, rights_confirmed: true }).select("id").single();
    const args = { p_workspace: A, p_campaign: null, p_media: [media.data!.id], p_caption: "verify", p_format: "FEED", p_scheduled_at: new Date(Date.now() - 1000).toISOString(), p_key: key, p_accounts: [accId], p_status: "scheduled" };
    const p1 = await a.client.rpc("create_publication", args);
    const p2 = await a.client.rpc("create_publication", args);
    check("create_publication é idempotente", !p1.error && p1.data === p2.data, p1.error?.message);
    const bPub = await b.client.rpc("create_publication", { ...args, p_key: randomUUID() });
    check("B não cria publicação no workspace de A", !!bPub.error);
    const userClaim = await a.client.rpc("claim_publication_targets", { p_worker: "x", p_now: new Date().toISOString(), p_lease_ms: 1000, p_limit: 1 });
    check("usuário comum não executa funções do worker", !!userClaim.error);
    const promoted = await admin.rpc("promote_due_targets", { p_now: new Date().toISOString(), p_limit: 100 });
    const claimed = await admin.rpc("claim_publication_targets", { p_worker: "verify", p_now: new Date().toISOString(), p_lease_ms: 60_000, p_limit: 10 });
    const mine = ((claimed.data as { publication_id: string }[]) ?? []).filter((t) => t.publication_id === p1.data);
    check("worker promove e reivindica o job", !promoted.error && mine.length === 1, promoted.error?.message ?? claimed.error?.message);
  } catch (e) {
    check("execução sem exceções", false, (e as Error).message);
  } finally {
    if (files.length) await admin.storage.from("media").remove(files);
    for (const id of created) {
      const ws = await admin.from("workspace_members").select("workspace_id").eq("user_id", id);
      const ids = (ws.data ?? []).map((w) => w.workspace_id as string);
      if (ids.length) await admin.from("workspaces").delete().in("id", ids);
      await admin.auth.admin.deleteUser(id);
    }
  }
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações passaram; dados temporários removidos.`);
  process.exit(failed ? 1 : 0);
}

void main();
