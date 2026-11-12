import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EmployeeOnboardForm } from "@/components/modules/employee-onboard-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  canProvisionEmployees,
  hasPermission,
} from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";

export default async function NouvelEmployePage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canProvisionEmployees(session.role)) {
    redirect("/annuaire");
  }

  const peopleManagers = await container.hr.listPeopleManagers();

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Nouvel collaborateur"
        description="Création de fiche RH et provisioning sécurisé du compte applicatif."
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/annuaire">
              <ArrowLeft className="h-3.5 w-3.5" />
              Annuaire
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeOnboardForm
            peopleManagers={peopleManagers}
            canAssignPrivilegedRoles={hasPermission(
              session.role,
              "account.role.assign_all",
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
