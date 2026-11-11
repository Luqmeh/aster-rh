import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import {
  buildFilledOfficialWorkbook,
  officialTemplateBytes,
} from "@/domain/rules/hr-import/official-workbook-fixture";
import {
  parseExcelWorkbook,
  pickBalanceSheet,
  pickEmployeeSheet,
  pickHistorySheet,
} from "@/domain/rules/hr-import/parse";
import { resolveCanonicalHeader } from "@/domain/rules/hr-import/templates";
import {
  validateBalanceRows,
  validateEmployeeRows,
} from "@/domain/rules/hr-import/validate";
import type { Employee, OrganizationUnit } from "@/domain/types/hr";

const departments: OrganizationUnit[] = [
  { id: "dept-audit", name: "Audit & Assurance", code: "AUD", parentId: null },
  { id: "dept-rh", name: "Ressources Humaines", code: "RH", parentId: null },
];

describe("official ASTER_Modele_Import_RH_Maroc.xlsx", () => {
  it("parses all five sheets with headers on the correct rows", async () => {
    const parsed = await parseExcelWorkbook(officialTemplateBytes());
    expect(parsed.worksheets.map((s) => s.name)).toEqual([
      "Lisez-moi",
      "Collaborateurs",
      "Soldes initiaux",
      "Historique optionnel",
      "Listes",
    ]);
    expect(parsed.worksheets.find((s) => s.name === "Listes")?.state).toBe(
      "hidden",
    );
    const emp = pickEmployeeSheet(parsed.worksheets)!;
    const bal = pickBalanceSheet(parsed.worksheets)!;
    const hist = pickHistorySheet(parsed.worksheets)!;
    expect(emp.headerRowNumber).toBe(4);
    expect(bal.headerRowNumber).toBe(4);
    expect(hist.headerRowNumber).toBe(4);
    expect(resolveCanonicalHeader("E-mail professionnel")).toBe("email");
    expect(resolveCanonicalHeader("Type de solde*")).toBe("balanceType");
    expect(emp.rows).toHaveLength(0);
    expect(bal.rows).toHaveLength(0);
  });

  it("downloads asset is byte-identical to source fixture path", () => {
    const bytes = officialTemplateBytes();
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(hash).toBe(
      "e0b2bcb8137ab3c0c584d5cb1cd243546bd1a645996805831110be1a92f42ccd",
    );
  });

  it("validates filled official workbook (long balances, accents, mixed order)", async () => {
    const filled = await buildFilledOfficialWorkbook({
      employees: [
        [
          "emp-ma-01",
          "Benali",
          "Sara",
          "sara.benali@demo.aster-rh.local",
          "AUD",
          "Consultante",
          "Casablanca (démo)",
          "2024-03-01",
          "CDI",
          "Actif",
          "emp-julien",
          "",
          "",
        ],
        [
          "emp-ma-02",
          "Alaoui",
          "Youssef",
          "",
          "RH",
          "Assistant",
          "Rabat (démo)",
          "15/01/2023",
          "CDD",
          "Actif",
          "",
          "",
          "Sans e-mail pro",
        ],
      ],
      balances: [
        // Different order vs employees
        [
          "emp-ma-02",
          "RTT",
          "1,5",
          "Jours",
          "2026-01-01",
          "Inventaire RH",
          "Feuille soldes",
          "Vérifié par RH",
          "",
        ],
        [
          "emp-ma-01",
          "CP",
          "10",
          "Jours",
          "2026-01-01",
          "Inventaire RH",
          "Feuille soldes",
          "Vérifié par RH",
          "",
        ],
        [
          "emp-ma-01",
          "RECUPERATION_HEURES",
          "3,5",
          "Heures",
          "2026-01-01",
          "Inventaire RH",
          "Feuille soldes",
          "Vérifié par RH",
          "",
        ],
      ],
      history: [
        [
          "emp-ma-01",
          "CONGE_APPROUVE",
          "2025-08-01",
          "2025-08-05",
          "5",
          "Jours",
          "Approuvé",
          "HIST-1",
          "Optionnel",
        ],
      ],
    });

    const parsed = await parseExcelWorkbook(filled);
    const empSheet = pickEmployeeSheet(parsed.worksheets)!;
    const balSheet = pickBalanceSheet(parsed.worksheets)!;
    expect(empSheet.rows.length).toBe(2);
    expect(balSheet.rows.length).toBe(3);

    const employees: Employee[] = [];
    const drafts = validateEmployeeRows({
      rows: empSheet.rows,
      mapping: {},
      departmentMapping: {},
      departments,
      existingEmployees: employees,
      updateExisting: false,
    });
    expect(drafts.every((d) => d.severity !== "error")).toBe(true);
    expect(drafts.find((d) => d.matricule === "emp-ma-02")?.emailMissing).toBe(
      true,
    );

    const balances = validateBalanceRows({
      rows: balSheet.rows,
      mapping: {},
      employeeDrafts: drafts,
      existingEmployees: employees,
    });
    expect(balances.every((b) => b.severity !== "error")).toBe(true);
    const recup = balances.find((b) => b.balanceType === "RECUPERATION_HEURES");
    expect(recup?.recoveryHours).toBe(3.5);
    expect(recup?.recoveryDays).toBeNull();
  });
});
