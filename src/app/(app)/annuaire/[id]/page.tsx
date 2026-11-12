import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createEmployeeService } from "@/application/services/employee-service";
import { HrEmployeeForm } from "@/components/modules/hr-employee-form";
import { LifecycleRoleControls } from "@/components/modules/lifecycle-role-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { UserAvatar } from "@/components/ui/user-avatar";
import { employmentStatusLabel } from "@/domain/rules/lifecycle";
import {
  canBrowseDirectory,
  canManageEmployees,
  canManageLifecycle,
  hasPermission,
} from "@/domain/rules/permissions";
import { employeeGradeLabel } from "@/domain/types/employee-structure";
import { findAccountByEmployeeId } from "@/infrastructure/auth/account-store";
import { getContainer } from "@/infrastructure/container";
import { formatDateFr, fullName } from "@/lib/utils";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  if (!canBrowseDirectory(session.role)) {
    redirect("/profil");
  }

  const service = createEmployeeService(container);
  let employee;
  try {
    employee = await service.getProfile(session, id);
  } catch {
    notFound();
  }

  const [peopleManagers, docs, account] = await Promise.all([
    container.hr.listPeopleManagers({ includeInactive: true }),
    container.hr.listDocuments(employee.id),
    findAccountByEmployeeId(employee.id),
  ]);
  const peopleManager = employee.peopleManagerId
    ? peopleManagers.find((p) => p.id === employee.peopleManagerId) ?? null
    : null;
  const canManage = canManageEmployees(session.role);
  const canLifecycle = canManageLifecycle(session.role);
  const canAssignAll = hasPermission(session.role, "account.role.assign_all");
  const canEditRole =
    Boolean(account) &&
    (canAssignAll ||
      (hasPermission(session.role, "account.role.assign_collaborateur") &&
        account?.role === "collaborateur"));
  const canReprovisionPassword =
    canManage &&
    Boolean(account) &&
    account?.authProvider === "credentials" &&
    Boolean(account?.isActive);

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title={fullName(employee.firstName, employee.lastName)}
        description="Fiche collaborateur — informations d'emploi et coordonnées."
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
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
          <UserAvatar initials={employee.avatarInitials} size="lg" />
          <div>
            <p className="text-lg font-semibold tracking-tight text-[var(--aster-ink)]">
              {fullName(employee.firstName, employee.lastName)}
            </p>
            <p className="text-sm text-[var(--aster-muted)]">
              Matricule {employee.id}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">
                {employeeGradeLabel(employee.grade)}
              </Badge>
              <Badge
                variant={
                  employee.employmentStatus === "actif"
                    ? "success"
                    : employee.employmentStatus === "parti"
                      ? "danger"
                      : "secondary"
                }
              >
                {employmentStatusLabel(employee.employmentStatus)}
              </Badge>
              <Badge variant="outline">{employee.id}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail" value={employee.email} />
            <Field
              label="Téléphone interne"
              value={employee.phoneInternal ?? "—"}
            />
            <Field label="Région" value={employee.region} />
            <Field label="Matricule" value={employee.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emploi</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="People Manager"
              value={peopleManager?.displayName ?? "—"}
            />
            <Field label="Grade" value={employeeGradeLabel(employee.grade)} />
            <Field
              label="Contrat"
              value={
                employee.contractType === "cdi" || employee.contractType === "stage"
                  ? employee.contractType.toUpperCase() === "CDI"
                    ? "CDI"
                    : "Stage"
                  : String(employee.contractType).toUpperCase()
              }
            />
            <Field
              label="Date d'entrée"
              value={formatDateFr(employee.hireDate)}
            />
            <Field
              label="Éligibilité télétravail"
              value={
                employee.teleworkEligible
                  ? "Éligible (politique produit télétravail)"
                  : "Non éligible"
              }
            />
          </CardContent>
        </Card>
      </div>

      {canManage || canLifecycle ? (
        <Card>
          <CardHeader>
            <CardTitle>Cycle de vie et rôle</CardTitle>
          </CardHeader>
          <CardContent>
            <LifecycleRoleControls
              employeeId={employee.id}
              employmentStatus={employee.employmentStatus}
              currentRole={account?.role ?? null}
              canManageLifecycle={canLifecycle}
              canAssignPrivilegedRoles={canAssignAll}
              canEditRole={canEditRole}
              canReprovisionPassword={canReprovisionPassword}
              accountEmail={account?.email ?? null}
            />
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Gestion RH de la fiche</CardTitle>
          </CardHeader>
          <CardContent>
            <HrEmployeeForm
              employee={employee}
              peopleManagers={peopleManagers.filter((p) => p.isActive)}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Documents liés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.length === 0 ? (
            <p className="text-sm text-[var(--aster-muted)]">
              Aucun document associé.
            </p>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className="rounded-lg border border-[var(--aster-border)] px-3 py-2.5 text-sm"
              >
                <p className="font-medium text-[var(--aster-ink)]">{doc.title}</p>
                <p className="text-xs text-[var(--aster-muted)]">{doc.category}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--aster-muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--aster-ink)]">{value}</p>
    </div>
  );
}
