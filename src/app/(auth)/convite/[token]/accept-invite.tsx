"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { acceptInvitationAction } from "@/app/app/_actions/members";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-6 grid gap-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <Button
        size="lg"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await acceptInvitationAction(token);
          if (!r.ok) {
            setBusy(false);
            return setError(r.error);
          }
          router.push("/app");
          router.refresh();
        }}
      >
        Aceitar convite
      </Button>
    </div>
  );
}
