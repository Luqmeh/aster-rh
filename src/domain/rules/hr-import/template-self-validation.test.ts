import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  HR_IMPORT_BALANCE_TYPE_OPTIONS,
  HR_IMPORT_CONTRACT_OPTIONS,
  HR_IMPORT_DEPARTMENT_OPTIONS,
  HR_IMPORT_FREE_TEXT_EMPLOYEE_FIELDS,
  HR_IMPORT_HISTORY_EVENT_OPTIONS,
  HR_IMPORT_HISTORY_STATUS_OPTIONS,
  HR_IMPORT_SITE_OPTIONS,
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
  resolveDepartmentId,
  validateEmployeeRows,
} from "@/domain/rules/hr-import/validate";
import { departments } from "@/data/demo-seed";
import { buildFilledOfficialWorkbook } from "@/domain/rules/hr-import/official-workbook-fixture";

const TEMPLATE_PATH = join(
  process.cwd(),
  OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH,
);

/** Hash du modèle auto-validant régénéré (scripts/build-hr-import-template.ts). */
export const OFFICIAL_HR_IMPORT_TEMPLATE_SHA256 =
  "e0b2bcb8137ab3c0c584d5cb1cd243546bd1a645996805831110be1a92f42ccd";

function columnValues(
  listesRows: Array<{ cells: Record<string, string> }>,
  key: string,
): string[] {
  return listesRows.map((r) => r.cells[key] ?? "").filter(Boolean);
}

describe("HR import template self-validation", () => {
  it("keeps Nom/Prénom as free-text fields (no categorical restriction)", () => {
    expect(HR_IMPORT_FREE_TEXT_EMPLOYEE_FIELDS).toEqual(
      expect.arrayContaining(["lastName", "firstName"]),
    );
  });

  it("accepted Excel options are all accepted by importer normalizers", () => {
    for (const v of HR_IMPORT_CONTRACT_OPTIONS) {
      expect(normalizeContractType(v)).not.toBeNull();
    }
    expect(normalizeContractType("Autre")).toBeNull();
    expect(normalizeContractType("À préciser")).toBeNull();

    for (const v of HR_IMPORT_STATUS_OPTIONS) {
      expect(normalizeEmploymentStatus(v)).not.toBeNull();
    }
    for (const v of HR_IMPORT_BALANCE_TYPE_OPTIONS) {
      expect(normalizeBalanceType(v)).not.toBeNull();
    }
    for (const v of HR_IMPORT_UNIT_OPTIONS) {
      expect(normalizeBalanceUnit(v)).not.toBeNull();
    }
    for (const code of HR_IMPORT_DEPARTMENT_OPTIONS) {
      expect(resolveDepartmentId(code, departments, {})).not.toBeNull();
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
    expect(columnValues(listes!.rows, "department")).toEqual([
      ...HR_IMPORT_DEPARTMENT_OPTIONS,
    ]);
    expect(columnValues(listes!.rows, "site")).toEqual([
      ...HR_IMPORT_SITE_OPTIONS,
    ]);
    expect(columnValues(listes!.rows, "Statut historique")).toEqual([
      ...HR_IMPORT_HISTORY_STATUS_OPTIONS,
    ]);
  });

  it("embeds Excel data validations for categorical, date and numeric columns", async () => {
    const zip = await JSZip.loadAsync(readFileSync(TEMPLATE_PATH));
    const collab = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    const soldes = await zip.file("xl/worksheets/sheet3.xml")!.async("string");
    const hist = await zip.file("xl/worksheets/sheet4.xml")!.async("string");
    const workbook = await zip.file("xl/workbook.xml")!.async("string");

    expect(collab).toMatch(/sqref="E5:E204"/); // département
    expect(collab).toMatch(/sqref="G5:G204"/); // site
    expect(collab).toMatch(/sqref="H5:H204"[^>]*type="date"/); // embauche
    expect(collab).toMatch(/sqref="I5:I204"/); // contrat
    expect(collab).toMatch(/sqref="J5:J204"/); // statut
    expect(collab).toMatch(/sqref="L5:L204"[^>]*type="date"/); // sortie
    expect(collab).not.toMatch(/sqref="B5:B204"/); // Nom libre
    expect(collab).not.toMatch(/sqref="C5:C204"/); // Prénom libre

    expect(soldes).toMatch(/sqref="B5:B204"/);
    expect(soldes).toMatch(/sqref="C5:C204"[^>]*type="decimal"/);
    expect(soldes).toMatch(/sqref="D5:D204"/);
    expect(soldes).toMatch(/sqref="E5:E204"[^>]*type="date"/);

    expect(hist).toMatch(/sqref="B5:B204"/);
    expect(hist).toMatch(/type="decimal"/);

    expect(workbook).toContain('name="ASTER_Contrats"');
    expect(workbook).toContain('name="ASTER_Statuts"');
    expect(workbook).toContain('name="ASTER_Departements"');
    expect(collab).toContain("showErrorMessage=\"1\"");
    expect(collab).toContain("Choisissez un code de la liste");
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
            department: "AUD",
            jobTitle: "Consultante",
            site: "Casablanca (démo)",
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

  it("accepts a filled official workbook using dropdown values (preview only)", async () => {
    const filled = await buildFilledOfficialWorkbook({
      employees: [
        [
          "emp-sv-01",
          "Benali",
          "Sara",
          "sara.sv@demo.aster-rh.local",
          "AUD",
          "Consultante",
          "Casablanca (démo)",
          "2024-03-01",
          "Alternance",
          "Actif",
          "",
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
      knownSites: [...HR_IMPORT_SITE_OPTIONS],
      existingEmployees: [],
      updateExisting: false,
    });
    expect(drafts.every((d) => d.severity !== "error")).toBe(true);
    expect(drafts[0]?.contractType).toBe("alternance");
    expect(bal.rows).toHaveLength(1);
  });
});
