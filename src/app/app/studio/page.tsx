import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireWorkspace, roleAtLeast } from "@/lib/auth/context";
import { viewUrls } from "@/lib/storage";
import { Users } from "lucide-react";
import { Studio } from "./studio";

export const metadata: Metadata = { title: "Estúdio de publicação" };

export default async function StudioPage() {
  const { repo, workspace, role } = await requireWorkspace();
  const [accounts, media, captions, campaigns] = await Promise.all([
    repo.listAccounts(workspace.id),
    repo.listMedia(workspace.id),
    repo.listCaptions(workspace.id),
    repo.listCampaigns(workspace.id),
  ]);
  const urls = await viewUrls(media);

  return (
    <>
      <PageHeader title="Estúdio de publicação" description="Prepare um conteúdo e programe para uma ou várias contas." />
      {!roleAtLeast(role, "editor") ? (
        <Card>
          <EmptyState icon={Users} title="Acesso somente leitura" description="Seu papel neste workspace não permite criar publicações." />
        </Card>
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Conecte uma conta primeiro"
            description="Você precisa de ao menos uma conta conectada para programar publicações."
            action={
              <Button asChild>
                <Link href="/app/accounts">Ir para Contas</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <Studio accounts={accounts} media={media} urls={urls} captions={captions} campaigns={campaigns} />
      )}
    </>
  );
}
