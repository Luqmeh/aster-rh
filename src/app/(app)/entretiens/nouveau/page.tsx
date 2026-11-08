import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RecruitmentCreateForm } from "@/components/modules/recruitment-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { canManageRecruitment } from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";

export default async function NouveauRecrutementPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canManageRecruitment(session.role)) {
    redirect("/entretiens");
  }
  const departments = await container.hr.listDepartments();

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Nouveau dossier candidat"
        description="Création d'un dossier de recrutement externe (hors fiche Employee)."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/entretiens">
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Informations candidat</CardTitle>
        </CardHeader>
        <CardContent>
          <RecruitmentCreateForm departments={departments} />
        </CardContent>
      </Card>
    </div>
  );
}
