import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { requireWorkspace, roleAtLeast } from "@/lib/auth/context";
import { ALL_STATUSES } from "@/lib/domain/status";
import type { TargetStatus } from "@/lib/domain/types";
import { HistoryTable } from "./history-table";

export const metadata: Metadata = { title: "Histórico" };

export default async function HistoryPage({ searchParams }: PageProps<"/app/history">) {
  const { repo, workspace, role } = await requireWorkspace();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (ALL_STATUSES as string[]).includes(sp.status) ? (sp.status as TargetStatus) : undefined;
  const [targets, accounts, audit] = await Promise.all([
    repo.listTargets(workspace.id, { statuses: status ? [status] : undefined, limit: 500 }),
    repo.listAccounts(workspace.id),
    repo.listAudit(workspace.id, 30),
  ]);
  return (
    <>
      <PageHeader title="Histórico de execução" description="Cada linha é a execução de uma publicação em uma conta. Até 500 registros mais recentes." />
      <HistoryTable
        targets={targets}
        accounts={accounts.map((a) => ({ id: a.id, username: a.username }))}
        initialStatus={status ?? ""}
        canEdit={roleAtLeast(role, "editor")}
        audit={audit}
      />
    </>
  );
}
