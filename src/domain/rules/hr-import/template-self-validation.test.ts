import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  HR_IMPORT_BALANCE_TYPE_OPTIONS,
  HR_IMPORT_CONTRACT_OPTIONS,
  HR_IMPORT_FREE_TEXT_EMPLOYEE_FIELDS,
  HR_IMPORT_GRADE_OPTIONS,
  HR_IMPORT_HISTORY_EVENT_OPTIONS,
  HR_IMPORT_HISTORY_STATUS_OPTIONS,
  HR_IMPORT_STATUS_OPTIONS,
  HR_IMPORT_UNIT_OPTIONS,
  HR_IMPORT_VERIFICATION_OPTIONS,
} from "@/domain/rules/hr-import/accepted-values";
import {
  parseExcelWorkbook,
  pickBalanceSheet,
  pickEmployeeSheet,
} from "@/domain/rules/hr-import/parse";
import { OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH } from "@/domain/rules/hr-import/templates";
import {
  normalizeBalanceType,
  normalizeBalanceUnit,
  normalizeContractType,
  normalizeEmploymentStatus,
  validateEmployeeRows,
} from "@/domain/rules/hr-import/validate";
import { departments } from "@/data/demo-seed";
import { buildFilledOfficialWorkbook } from "@/domain/rules/hr-import/official-workbook-fixture";
import { parseEmployeeGrade } from "@/domain/types/employee-structure";

const TEMPLATE_PATH = join(
  process.cwd(),
  OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH,
);

/** Hash du modèle auto-validant régénéré (scripts/build-hr-import-template.ts). */
export const OFFICIAL_HR_IMPORT_TEMPLATE_SHA256 =
  "88672aa999a017a008d724bbce3fe624c3f3ecc5821b4617a199730b51ef1145";

function columnValues(
  listesRows: Array<{ cells: Record<string, string> }>,
  key: string,
): string[] {
  return listesRows.map((r) => r.cells[key] ?? "").filter(Boolean);
}

describe("HR import template self-validation", () => {
  it("keeps Nom/Prénom/Région/People Manager as free-text fields", () => {
    expect(HR_IMPORT_FREE_TEXT_EMPLOYEE_FIELDS).toEqual(
      expect.arrayContaining([
        "lastName",
        "firstName",
        "region",
        "peopleManager",
      ]),
    );
  });

  it("accepted Excel options are all accepted by importer normalizers", () => {
    for (const v of HR_IMPORT_CONTRACT_OPTIONS) {
      expect(normalizeContractType(v)).not.toBeNull();
    }
    expect(normalizeContractType("Autre")).toBeNull();
    expect(normalizeContractType("À préciser")).toBeNull();
    expect(normalizeContractType("CDD")).toBeNull();
    expect(normalizeContractType("Alternance")).toBeNull();

    for (const v of HR_IMPORT_STATUS_OPTIONS) {
      expect(normalizeEmploymentStatus(v)).not.toBeNull();
    }
    for (const v of HR_IMPORT_BALANCE_TYPE_OPTIONS) {
      expect(normalizeBalanceType(v)).not.toBeNull();
    }
    for (const v of HR_IMPORT_UNIT_OPTIONS) {
      expect(normalizeBalanceUnit(v)).not.toBeNull();
    }
    for (const label of HR_IMPORT_GRADE_OPTIONS) {
      expect(parseEmployeeGrade(label).ok).toBe(true);
    }
  });

  it("canonical workbook Listes sheet matches accepted-values 1:1", async () => {
    const bytes = readFileSync(TEMPLATE_PATH);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      OFFICIAL_HR_IMPORT_TEMPLATE_SHA256,
    );
    const parsed = await parseExcelWorkbook(bytes);
    const listes = parsed.worksheets.find((s) => s.name === "Listes");
    expect(listes?.state).toBe("hidden");
    expect(columnValues(listes!.rows, "employmentStatus")).toEqual([
      ...HR_IMPORT_STATUS_OPTIONS,
    ]);
    expect(columnValues(listes!.rows, "contractType")).toEqual([
      ...HR_IMPORT_CONTRACT_OPTIONS,
    ]);
    expect(columnValues(listes!.rows, "balanceType")).toEqual([
      ...HR_IMPORT_BALANCE_TYPE_OPTIONS,
    ]);
    expect(columnValues(listes!.rows, "balanceUnit")).toEqual([
      ...HR_IMPORT_UNIT_OPTIONS,
    ]);
    expect(columnValues(listes!.rows, "verificationStatus")).toEqual([
      ...HR_IMPORT_VERIFICATION_OPTIONS,
    ]);
    expect(columnValues(listes!.rows, "eventType")).toEqual([
      ...HR_IMPORT_HISTORY_EVENT_OPTIONS,
    ]);
    expect(columnValues(listes!.rows, "department")).toEqual([]);
    expect(columnValues(listes!.rows, "grade")).toEqual([
      ...HR_IMPORT_GRADE_OPTIONS,
    ]);
    expect(columnValues(listes!.rows, "Statut historique")).toEqual([
      ...HR_IMPORT_HISTORY_STATUS_OPTIONS,
    ]);
  });

  it("embeds Excel data validations for Grade, dates and categorical columns", async () => {
    const zip = await JSZip.loadAsync(readFileSync(TEMPLATE_PATH));
    const collab = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    const soldes = await zip.file("xl/worksheets/sheet3.xml")!.async("string");
    const hist = await zip.file("xl/worksheets/sheet4.xml")!.async("string");
    const workbook = await zip.file("xl/workbook.xml")!.async("string");

    // 12 cols : A Matricule … E Grade, F PM, G Région, H Embauche, I Contrat, J Statut, K Sortie, L Remarques
    expect(collab).toMatch(/sqref="E5:E204"/); // grade
    expect(collab).toMatch(/sqref="H5:H204"[^>]*type="date"/); // embauche
    expect(collab).toMatch(/sqref="I5:I204"/); // contrat
    expect(collab).toMatch(/sqref="J5:J204"/); // statut
    expect(collab).toMatch(/sqref="K5:K204"[^>]*type="date"/); // sortie
    expect(collab).not.toMatch(/sqref="B5:B204"/); // Nom libre
    expect(collab).not.toMatch(/sqref="C5:C204"/); // Prénom libre
    expect(collab).not.toMatch(/sqref="F5:F204"/); // People Manager libre
    expect(collab).not.toMatch(/sqref="G5:G204"/); // Région libre

    expect(soldes).toMatch(/sqref="B5:B204"/);
    expect(soldes).toMatch(/sqref="C5:C204"[^>]*type="decimal"/);
    expect(soldes).toMatch(/sqref="D5:D204"/);
    expect(soldes).toMatch(/sqref="E5:E204"[^>]*type="date"/);

    expect(hist).toMatch(/sqref="B5:B204"/);
    expect(hist).toMatch(/type="decimal"/);

    expect(workbook).toContain('name="ASTER_Contrats"');
    expect(workbook).toContain('name="ASTER_Statuts"');
    expect(workbook).toContain('name="ASTER_Grades"');
    expect(workbook).not.toContain('name="ASTER_Departements"');
    expect(workbook).not.toContain('name="ASTER_Sites"');
    expect(collab).toContain('showErrorMessage="1"');
    expect(collab).toContain("Seuls CDI et Stage sont acceptés");
  });

  it("still validates server-side and rejects unsupported categorical values", () => {
    const drafts = validateEmployeeRows({
      rows: [
        {
          rowNumber: 5,
          cells: {
            matricule: "emp-bad-contrat",
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@demo.aster-rh.local",
            grade: "Auditeur junior",
            region: "Casablanca",
            hireDate: "2024-01-01",
            contractType: "Autre",
            employmentStatus: "Actif",
          },
        },
      ],
      mapping: {},
      departmentMapping: {},
      departments,
      existingEmployees: [],
      updateExisting: false,
    });
    expect(drafts[0]?.severity).toBe("error");
    expect(drafts[0]?.messages.join(" ")).toMatch(/contrat/i);
  });

  it("rejects obsolete Site / cadre / Département / Poste without silent mapping", () => {
    const drafts = validateEmployeeRows({
      rows: [
        {
          rowNumber: 5,
          cells: {
            matricule: "emp-old",
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada2@demo.aster-rh.local",
            department: "AUD",
            jobTitle: "Consultante",
            site: "Casablanca",
            category: "cadre",
            hireDate: "2024-01-01",
            contractType: "CDI",
            employmentStatus: "Actif",
          },
        },
      ],
      mapping: {},
      departmentMapping: {},
      departments,
      existingEmployees: [],
      updateExisting: false,
    });
    expect(drafts[0]?.severity).toBe("error");
    expect(drafts[0]?.messages.join(" ")).toMatch(
      /Site|Grade|cadre|Département|Poste/i,
    );
  });

  it("accepts a filled official workbook using dropdown values (preview only)", async () => {
    const filled = await buildFilledOfficialWorkbook({
      employees: [
        [
          "emp-sv-01",
          "Benali",
          "Sara",
          "sara.sv@demo.aster-rh.local",
          "Auditeur senior",
          "Youssef Alaoui",
          "Casablanca (démo)",
          "2024-03-01",
          "Stage",
          "Actif",
          "",
          "",
        ],
      ],
      balances: [
        [
          "emp-sv-01",
          "CP",
          "2,5",
          "Jours",
          "2026-01-01",
          "Inventaire",
          "Soldes",
          "Vérifié par RH",
          "",
        ],
      ],
    });
    const parsed = await parseExcelWorkbook(filled);
    const emp = pickEmployeeSheet(parsed.worksheets)!;
    const bal = pickBalanceSheet(parsed.worksheets)!;
    const drafts = validateEmployeeRows({
      rows: emp.rows,
      mapping: {},
      departmentMapping: {},
      departments,
      existingEmployees: [],
      updateExisting: false,
    });
    expect(drafts.every((d) => d.severity !== "error")).toBe(true);
    expect(drafts[0]?.contractType).toBe("stage");
    expect(drafts[0]?.grade).toBe("auditeur_senior");
    expect(drafts[0]?.region).toBe("Casablanca (démo)");
    expect(bal.rows).toHaveLength(1);
  });
});
