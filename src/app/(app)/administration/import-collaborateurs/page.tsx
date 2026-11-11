import { HrImportWizard } from "@/components/modules/hr-import-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { createHrImportService } from "@/application/services/hr-import-service";
import {
  canExecuteHrImport,
  canViewHrImport,
} from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ImportCollaborateursPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canViewHrImport(session.role)) {
    redirect("/tableau-de-bord");
  }

  const importService = createHrImportService({
    hr: container.hr,
    storage: container.storage,
  });
  const batches = importService.listBatches(session);
  const latest = batches[0] ?? null;
  const canExecute = canExecuteHrImport(session.role);

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Import des collaborateurs"
        description="Migration Excel contrôlée — fiches collaborateurs et soldes d'ouverture ledger (append-only). Pas de recalcul d'acquisition historique."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/administration">Retour administration</Link>
          </Button>
        }
      />
      <HrImportWizard canExecute={canExecute} latestBatch={latest} />
    </div>
  );
}
