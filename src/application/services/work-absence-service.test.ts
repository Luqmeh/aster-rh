import { beforeEach, describe, expect, it } from "vitest";
import { createWorkAbsenceService } from "@/application/services/work-absence-service";
import { AuthError } from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import { mockEmail } from "@/infrastructure/email/mock-email";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import { resetDemoStore } from "@/infrastructure/persistence/demo-store";
import type { Employee } from "@/domain/types/hr";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";
import { buildWorkbook } from "@/infrastructure/reporting/excel-exports";
import { parseReportingFilters } from "@/application/services/reporting-service";
import ExcelJS from "exceljs";

function sessionFor(
  employee: Employee,
  role: AuthSession["role"],
): AuthSession {
  return {
    userId: `acc-${employee.id}`,
    email: employee.email,
    employee,
    role,
    authProvider: "credentials",
    isDemoMode: true,
  };
}

const memoryStorage: DocumentStoragePort = {
  async putObject(key, data, contentType) {
    return { key, contentType, sizeBytes: data.byteLength };
  },
  async getDownloadUrl(key) {
    return `https://signed.example/${encodeURIComponent(key)}?exp=120`;
  },
};

function service() {
  return createWorkAbsenceService({
    hr: demoHrRepository,
    email: mockEmail,
    storage: memoryStorage,
  });
}

function container() {
  return {
    hr: demoHrRepository,
    email: mockEmail,
    auth: { getSession: async () => null, signOut: async () => undefined },
    storage: memoryStorage,
    payroll: {} as never,
    persistence: "memory" as const,
  };
}

describe("work-absence-service", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  async function emp(id: string) {
    const e = await demoHrRepository.getEmployee(id);
    if (!e) throw new Error("missing");
    return e;
  }

  it("autorise la déclaration sans justificatif puis isole la propriété", async () => {
    const lea = await emp("emp-lea");
    const julien = await emp("emp-julien");
    const svc = service();
    const created = await svc.declare(sessionFor(lea, "collaborateur"), {
      category: "arret_maladie",
      startDate: "2026-11-10",
      endDate: "2026-11-14",
      comment: "Indisponible",
    });
    expect(created.status).toBe("en_attente_justificatif");
    expect(created.documentsReceived).toBe(false);

    await expect(
      svc.getVisible(sessionFor(julien, "collaborateur"), created.id),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("RH traite ; Chef voit sans accès documents médicaux", async () => {
    const lea = await emp("emp-lea");
    const camille = await emp("emp-camille");
    const julien = await emp("emp-julien");
    const svc = service();
    const created = await svc.declare(sessionFor(lea, "collaborateur"), {
      category: "arret_maladie",
      startDate: "2026-11-10",
      endDate: "2026-11-12",
    });
    await svc.uploadDocument(sessionFor(lea, "collaborateur"), created.id, {
      kind: "certificat_initial",
      fileName: "certificat.pdf",
      contentType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });

    const hrView = await svc.getVisible(
      sessionFor(camille, "admin_rh"),
      created.id,
    );
    expect(hrView.documents.length).toBe(1);

    const chefView = await svc.getVisible(
      sessionFor(julien, "chef_de_projet"),
      created.id,
    );
    expect(chefView.documents.length).toBe(0);
    await expect(
      svc.getDocumentDownloadUrl(
        sessionFor(julien, "chef_de_projet"),
        hrView.documents[0]!.id,
        created.id,
      ),
    ).rejects.toBeInstanceOf(AuthError);

    await svc.hrUpdateStatus(sessionFor(camille, "admin_rh"), created.id, {
      status: "enregistre",
      hrMessage: "Dossier enregistré",
    });
    await expect(
      svc.hrUpdateStatus(sessionFor(julien, "chef_de_projet"), created.id, {
        status: "termine",
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("signale un écart de prolongation et une rechute < 3 mois", async () => {
    const lea = await emp("emp-lea");
    const svc = service();
    const origin = await svc.declare(sessionFor(lea, "collaborateur"), {
      category: "arret_maladie",
      startDate: "2026-09-01",
      endDate: "2026-09-05",
    });
    const extension = await svc.declare(sessionFor(lea, "collaborateur"), {
      category: "prolongation_arret",
      startDate: "2026-09-10",
      endDate: "2026-09-12",
      parentAbsenceId: origin.id,
    });
    expect(extension.dateGapFlag).toBe(true);
    expect(extension.requiresHrReview).toBe(true);

    const rechute = await svc.declare(sessionFor(lea, "collaborateur"), {
      category: "rechute",
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      recurrenceOfId: origin.id,
    });
    expect(rechute.recurrenceWithin3MonthsFlag).toBe(true);
  });

  it("n'émet pas de doublon de notification immédiat", async () => {
    const lea = await emp("emp-lea");
    const camille = await emp("emp-camille");
    const svc = service();
    const created = await svc.declare(sessionFor(lea, "collaborateur"), {
      category: "mariage_pacs",
      startDate: "2026-12-01",
      endDate: "2026-12-04",
    });
    await svc.hrUpdateStatus(sessionFor(camille, "admin_rh"), created.id, {
      status: "informations_demandees",
      hrMessage: "Justificatif manquant",
    });
    await svc.hrUpdateStatus(sessionFor(camille, "admin_rh"), created.id, {
      status: "informations_demandees",
      hrMessage: "Justificatif manquant",
    });
    const notifs = await demoHrRepository.listNotifications(lea.id);
    const matching = notifs.filter(
      (n) => n.title === "Mise à jour de votre déclaration d'absence",
    );
    expect(matching.length).toBe(1);
  });

  it("exclut les données médicales de l'export Excel", async () => {
    const lea = await emp("emp-lea");
    const svc = service();
    const created = await svc.declare(sessionFor(lea, "collaborateur"), {
      category: "arret_maladie",
      startDate: "2026-11-10",
      endDate: "2026-11-14",
      comment: "diagnostic secret",
    });
    await svc.uploadDocument(sessionFor(lea, "collaborateur"), created.id, {
      kind: "certificat_initial",
      fileName: "secret-cert.pdf",
      contentType: "application/pdf",
      bytes: new Uint8Array([9, 9, 9]),
    });

    const { buffer, rowCount } = await buildWorkbook(
      container(),
      "arrets_absences",
      parseReportingFilters({
        preset: "personnalise",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
      }),
    );
    expect(rowCount).toBeGreaterThan(0);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Uint8Array.from(buffer) as never);
    const headers = (wb.worksheets[0].getRow(1).values as string[])
      .filter(Boolean)
      .join("|")
      .toLowerCase();
    expect(headers).not.toMatch(/certificat|diagnostic|note interne|storage|url/);
    const sheetText = JSON.stringify(wb.worksheets[0].getSheetValues()).toLowerCase();
    expect(sheetText).not.toContain("secret-cert");
    expect(sheetText).not.toContain("diagnostic secret");
  });
});
