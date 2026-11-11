import type { PrismaClient } from "@prisma/client";
import {
  departments,
  documents,
  employees,
  leaveBalances,
  leaveRequests,
  notifications,
  teleworkRequests,
} from "@/data/demo-seed";
import { hashPassword } from "@/infrastructure/auth/password";
import { isDemoModeEnabled } from "@/infrastructure/persistence/persistence-mode";
import { getPrismaClient } from "@/infrastructure/persistence/prisma-client";
import { dateOnlyToUtc } from "@/infrastructure/persistence/prisma-mappers";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";

const SEED_ACCOUNTS: Array<{
  id: string;
  email: string;
  employeeId: string;
  role: "collaborateur" | "chef_de_projet" | "admin_rh";
}> = [
  {
    id: "user-lea",
    email: "imane.chraibi@demo.aster-rh.local",
    employeeId: "emp-lea",
    role: "collaborateur",
  },
  {
    id: "user-julien",
    email: "youssef.alaoui@demo.aster-rh.local",
    employeeId: "emp-julien",
    role: "chef_de_projet",
  },
  {
    id: "user-camille",
    email: "sara.benali@demo.aster-rh.local",
    employeeId: "emp-camille",
    role: "admin_rh",
  },
];

/**
 * Seed / reset idempotent des données de démonstration ASTER uniquement.
 * Ne touche pas à d'autres schémas ou tables hors modèles Prisma ASTER.
 *
 * Sans `resetMutable` : create-or-keep (`update: {}`) — préserve les IDs et
 * les modifications déjà présentes (congés, télétravail, etc.). Aucun DELETE.
 * Avec `resetMutable` : réservé au reset démo UI — deleteMany puis recreate.
 */
export async function seedAsterDemoData(
  prisma: PrismaClient,
  options: { resetMutable?: boolean } = {},
): Promise<void> {
  const preserveExisting = !options.resetMutable;

  // Départements (parents d'abord)
  const sortedDepts = [...departments].sort((a, b) => {
    if (a.parentId === null && b.parentId !== null) return -1;
    if (a.parentId !== null && b.parentId === null) return 1;
    return a.id.localeCompare(b.id);
  });

  for (const dept of sortedDepts) {
    await prisma.organizationUnit.upsert({
      where: { id: dept.id },
      create: {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        parentId: null,
      },
      update: preserveExisting
        ? {}
        : {
            name: dept.name,
            code: dept.code,
          },
    });
  }

  // Relier les parents après création (évite les cycles à l'insert).
  for (const dept of sortedDepts) {
    if (!dept.parentId) continue;
    if (preserveExisting) {
      const row = await prisma.organizationUnit.findUnique({
        where: { id: dept.id },
      });
      if (row?.parentId) continue;
    }
    await prisma.organizationUnit.update({
      where: { id: dept.id },
      data: { parentId: dept.parentId },
    });
  }

  // Employés sans manager, puis rattachements.
  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { id: emp.id },
      create: {
        id: emp.id,
        demoIdentityId: emp.demoIdentityId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        jobTitle: emp.jobTitle,
        departmentId: emp.departmentId,
        managerId: null,
        site: emp.site,
        contractType: emp.contractType,
        category: emp.category,
        hireDate: dateOnlyToUtc(emp.hireDate),
        employmentStatus: emp.employmentStatus,
        departureDate: emp.departureDate
          ? dateOnlyToUtc(emp.departureDate)
          : null,
        departureNote: emp.departureNote,
        isActive: emp.isActive,
        phoneInternal: emp.phoneInternal,
        avatarInitials: emp.avatarInitials,
        teleworkEligible: emp.teleworkEligible,
        teleworkDaysPerWeek: emp.teleworkDaysPerWeek,
        standardDailyHours: emp.standardDailyHours ?? 7,
        isPartTime: emp.isPartTime ?? false,
        weeklyContractHours: emp.weeklyContractHours ?? null,
        workingTimePercent: emp.workingTimePercent ?? null,
        officeCalendarId: emp.officeCalendarId ?? null,
        policyGroup: emp.policyGroup ?? null,
      },
      update: preserveExisting
        ? {}
        : {
            demoIdentityId: emp.demoIdentityId,
            firstName: emp.firstName,
            lastName: emp.lastName,
            email: emp.email,
            jobTitle: emp.jobTitle,
            departmentId: emp.departmentId,
            site: emp.site,
            contractType: emp.contractType,
            category: emp.category,
            hireDate: dateOnlyToUtc(emp.hireDate),
            employmentStatus: emp.employmentStatus,
            departureDate: emp.departureDate
              ? dateOnlyToUtc(emp.departureDate)
              : null,
            departureNote: emp.departureNote,
            isActive: emp.isActive,
            phoneInternal: emp.phoneInternal,
            avatarInitials: emp.avatarInitials,
            teleworkEligible: emp.teleworkEligible,
            teleworkDaysPerWeek: emp.teleworkDaysPerWeek,
            standardDailyHours: emp.standardDailyHours ?? 7,
            isPartTime: emp.isPartTime ?? false,
            weeklyContractHours: emp.weeklyContractHours ?? null,
            workingTimePercent: emp.workingTimePercent ?? null,
            officeCalendarId: emp.officeCalendarId ?? null,
            policyGroup: emp.policyGroup ?? null,
          },
    });
  }

  for (const emp of employees) {
    if (preserveExisting) {
      const row = await prisma.employee.findUnique({ where: { id: emp.id } });
      if (row?.managerId) continue;
    }
    await prisma.employee.update({
      where: { id: emp.id },
      data: { managerId: emp.managerId },
    });
  }

  for (const balance of leaveBalances) {
    await prisma.leaveBalance.upsert({
      where: {
        employeeId_year: {
          employeeId: balance.employeeId,
          year: balance.year,
        },
      },
      create: {
        employeeId: balance.employeeId,
        year: balance.year,
        congesPayesAcquis: balance.congesPayesAcquis,
        congesPayesPris: balance.congesPayesPris,
        congesPayesRestants: balance.congesPayesRestants,
        rttAcquis: balance.rttAcquis,
        rttPris: balance.rttPris,
        rttRestants: balance.rttRestants,
        recoveryDaysAcquis: balance.recoveryDaysAcquis ?? 0,
        recoveryDaysPris: balance.recoveryDaysPris ?? 0,
        recoveryDaysRestants: balance.recoveryDaysRestants ?? 0,
      },
      update: preserveExisting
        ? {}
        : {
            congesPayesAcquis: balance.congesPayesAcquis,
            congesPayesPris: balance.congesPayesPris,
            congesPayesRestants: balance.congesPayesRestants,
            rttAcquis: balance.rttAcquis,
            rttPris: balance.rttPris,
            rttRestants: balance.rttRestants,
            recoveryDaysAcquis: balance.recoveryDaysAcquis ?? 0,
            recoveryDaysPris: balance.recoveryDaysPris ?? 0,
            recoveryDaysRestants: balance.recoveryDaysRestants ?? 0,
          },
    });
  }

  // Grand livre : ouverture idempotente depuis les soldes existants (pas d'historique inventé).
  if (options.resetMutable) {
    await prisma.leaveLedgerEntry.deleteMany();
  }
  const { createLeaveLedgerService } = await import(
    "@/application/services/leave-ledger-service"
  );
  const { prismaHrRepository } = await import(
    "@/infrastructure/persistence/prisma-hr-repository"
  );
  await createLeaveLedgerService({ hr: prismaHrRepository }).backfillOpeningBalancesFromSnapshots({
    year: 2026,
    effectiveDate: "2026-01-01",
  });

  if (options.resetMutable) {
    await prisma.notificationItem.deleteMany();
    await prisma.leaveRequest.deleteMany();
    await prisma.teleworkRequest.deleteMany();
    await prisma.hrDocument.deleteMany();
  }

  for (const item of leaveRequests) {
    await prisma.leaveRequest.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        employeeId: item.employeeId,
        type: item.type,
        startDate: dateOnlyToUtc(item.startDate),
        endDate: dateOnlyToUtc(item.endDate),
        halfDayStart: item.halfDayStart,
        halfDayEnd: item.halfDayEnd,
        daysCount: item.daysCount,
        status: item.status,
        comment: item.comment,
        managerComment: item.managerComment,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
      update: preserveExisting
        ? {}
        : {
            employeeId: item.employeeId,
            type: item.type,
            startDate: dateOnlyToUtc(item.startDate),
            endDate: dateOnlyToUtc(item.endDate),
            halfDayStart: item.halfDayStart,
            halfDayEnd: item.halfDayEnd,
            daysCount: item.daysCount,
            status: item.status,
            comment: item.comment,
            managerComment: item.managerComment,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          },
    });
  }

  for (const item of teleworkRequests) {
    await prisma.teleworkRequest.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        employeeId: item.employeeId,
        type: item.type,
        month: item.month,
        startDate: dateOnlyToUtc(item.startDate),
        endDate: dateOnlyToUtc(item.endDate),
        days: item.days,
        status: item.status,
        reason: item.reason,
        managerComment: item.managerComment,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
      update: preserveExisting
        ? {}
        : {
            employeeId: item.employeeId,
            type: item.type,
            month: item.month,
            startDate: dateOnlyToUtc(item.startDate),
            endDate: dateOnlyToUtc(item.endDate),
            days: item.days,
            status: item.status,
            reason: item.reason,
            managerComment: item.managerComment,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          },
    });
  }

  for (const item of notifications) {
    await prisma.notificationItem.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        recipientId: item.recipientId,
        title: item.title,
        body: item.body,
        href: item.href,
        read: item.read,
        createdAt: new Date(item.createdAt),
      },
      update: preserveExisting
        ? {}
        : {
            recipientId: item.recipientId,
            title: item.title,
            body: item.body,
            href: item.href,
            read: item.read,
            createdAt: new Date(item.createdAt),
          },
    });
  }

  for (const doc of documents) {
    await prisma.hrDocument.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        employeeId: doc.employeeId,
        title: doc.title,
        category: doc.category,
        uploadedAt: new Date(doc.uploadedAt),
        storageKey: doc.storageKey,
        isCompanyWide: doc.isCompanyWide,
      },
      update: preserveExisting
        ? {}
        : {
            employeeId: doc.employeeId,
            title: doc.title,
            category: doc.category,
            uploadedAt: new Date(doc.uploadedAt),
            storageKey: doc.storageKey,
            isCompanyWide: doc.isCompanyWide,
          },
    });
  }

  // Comptes applicatifs — mot de passe uniquement si ASTER_SEED_PASSWORD est défini.
  const seedPassword = process.env.ASTER_SEED_PASSWORD?.trim();
  const passwordHash = seedPassword ? await hashPassword(seedPassword) : null;
  if (!passwordHash) {
    console.warn(
      "ASTER_SEED_PASSWORD absent : comptes créés sans mot de passe credentials (SSO / provisioning ultérieur).",
    );
  }

  for (const account of SEED_ACCOUNTS) {
    const existing = await prisma.userAccount.findUnique({
      where: { id: account.id },
    });
    if (existing && preserveExisting) {
      continue;
    }
    await prisma.userAccount.upsert({
      where: { id: account.id },
      create: {
        id: account.id,
        email: account.email,
        passwordHash,
        authProvider: "credentials",
        externalSubject: null,
        role: account.role,
        employeeId: account.employeeId,
        isActive: true,
        mustChangePassword: false,
      },
      update: {
        email: account.email,
        passwordHash,
        authProvider: "credentials",
        role: account.role,
        employeeId: account.employeeId,
        isActive: true,
        mustChangePassword: false,
      },
    });
  }
}

export async function resetPrismaDemoData(): Promise<void> {
  if (!isDemoModeEnabled()) {
    throw new Error(
      "Réinitialisation refusée : ASTER_MODE n'est pas en mode démonstration.",
    );
  }
  const prisma = getPrismaClient();
  await seedAsterDemoData(prisma, { resetMutable: true });
}

export type DemoResetResult = {
  persistence: "memory" | "prisma";
  message: string;
};

/**
 * Réinitialise uniquement les données de démo ASTER selon le mode actif.
 */
export async function resetAsterDemoData(
  persistence: "memory" | "prisma",
): Promise<DemoResetResult> {
  if (!isDemoModeEnabled()) {
    throw new Error(
      "Réinitialisation réservée au mode démonstration (ASTER_MODE=demo).",
    );
  }

  if (persistence === "prisma") {
    await resetPrismaDemoData();
    return {
      persistence: "prisma",
      message:
        "Données de démonstration PostgreSQL réinitialisées (congés, télétravail, notifications, documents).",
    };
  }

  resetDemoStore();
  return {
    persistence: "memory",
    message: "Magasin mémoire de démonstration réinitialisé.",
  };
}
