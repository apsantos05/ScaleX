/**
 * Cria (ou recria) o usuário de QA definido em QA_TEST_EMAIL/QA_TEST_PASSWORD no .env.local,
 * já com e-mail confirmado — nenhum e-mail é enviado. Uso: npm run qa:user [-- --delete]
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());
const email = process.env.QA_TEST_EMAIL;
const password = process.env.QA_TEST_PASSWORD;
if (!email || !password) throw new Error("Defina QA_TEST_EMAIL e QA_TEST_PASSWORD no .env.local");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = data?.users.find((u) => u.email === email);
  if (existing) {
    const ws = await admin.from("workspace_members").select("workspace_id").eq("user_id", existing.id);
    const ids = (ws.data ?? []).map((w) => w.workspace_id as string);
    if (ids.length) await admin.from("workspaces").delete().in("id", ids);
    await admin.auth.admin.deleteUser(existing.id);
  }
  if (process.argv.includes("--delete")) return console.log("Usuário de QA removido.");
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: "QA ScaleX" } });
  if (error) throw new Error(error.message);
  console.log(`Usuário de QA pronto: ${email}`);
}

void main();
