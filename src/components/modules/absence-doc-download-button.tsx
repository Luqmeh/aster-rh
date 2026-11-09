"use client";

import { useTransition } from "react";
import { getWorkAbsenceDocumentUrlAction } from "@/app/actions/work-absence";
import { Button } from "@/components/ui/button";

export function AbsenceDocDownloadButton({
  absenceId,
  documentId,
}: {
  absenceId: string;
  documentId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await getWorkAbsenceDocumentUrlAction({
            absenceId,
            documentId,
          });
          if (res.ok) {
            window.open(res.url, "_blank", "noopener,noreferrer");
          }
        });
      }}
    >
      {pending ? "…" : "Ouvrir"}
    </Button>
  );
}
