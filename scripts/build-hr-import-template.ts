/**
 * Régénère assets/hr-import/ASTER_Modele_Import_RH_Maroc.xlsx :
 * feuille Listes alignée sur accepted-values + data validations Excel.
 *
 * Usage : npx tsx scripts/build-hr-import-template.ts
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import JSZip from "jszip";
import {
  HR_IMPORT_LISTES_COLUMNS,
  HR_IMPORT_CONTRACT_OPTIONS,
  HR_IMPORT_DEPARTMENT_OPTIONS,
  HR_IMPORT_SITE_OPTIONS,
  HR_IMPORT_STATUS_OPTIONS,
  HR_IMPORT_BALANCE_TYPE_OPTIONS,
  HR_IMPORT_UNIT_OPTIONS,
  HR_IMPORT_VERIFICATION_OPTIONS,
  HR_IMPORT_HISTORY_EVENT_OPTIONS,
  HR_IMPORT_HISTORY_STATUS_OPTIONS,
} from "../src/domain/rules/hr-import/accepted-values";
import { OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH } from "../src/domain/rules/hr-import/templates";

const ROOT = process.cwd();
const TARGET = join(ROOT, OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH);
const DATA_END_ROW = 204;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colLetter(index1: number): string {
  let n = index1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildListesSheetData(): string {
  const maxRows = Math.max(
    ...HR_IMPORT_LISTES_COLUMNS.map((c) => c.values.length),
    0,
  );
  const rows: string[] = [];
  const headerCells = HR_IMPORT_LISTES_COLUMNS.map((c, i) => {
    const ref = `${colLetter(i + 1)}1`;
    return `<c r="${ref}" s="14" t="inlineStr"><is><t>${escapeXml(c.header)}</t></is></c>`;
  }).join("");
  rows.push(`<row r="1">${headerCells}</row>`);

  for (let r = 0; r < maxRows; r += 1) {
    const cells = HR_IMPORT_LISTES_COLUMNS.map((c, i) => {
      const value = c.values[r];
      if (value == null || value === "") return "";
      const ref = `${colLetter(i + 1)}${r + 2}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
    }).join("");
    rows.push(`<row r="${r + 2}">${cells}</row>`);
  }
  return `<sheetData>${rows.join("")}</sheetData>`;
}

function listRange(colIndex1: number, valueCount: number): string {
  const col = colLetter(colIndex1);
  return `'Listes'!$${col}$2:$${col}$${1 + valueCount}`;
}

function dv(attrs: {
  sqref: string;
  type: string;
  formula1: string;
  formula2?: string;
  allowBlank?: boolean;
  errorStyle?: "stop" | "warning" | "information";
  operator?: string;
  promptTitle: string;
  prompt: string;
  errorTitle: string;
  error: string;
}): string {
  const allowBlank = attrs.allowBlank === false ? "0" : "1";
  const errorStyle = attrs.errorStyle ?? "stop";
  const operator = attrs.operator ? ` operator="${attrs.operator}"` : "";
  const f2 = attrs.formula2
    ? `<formula2>${escapeXml(attrs.formula2)}</formula2>`
    : "";
  return (
    `<dataValidation sqref="${attrs.sqref}" type="${attrs.type}"` +
    `${operator} allowBlank="${allowBlank}" showDropDown="0"` +
    ` showInputMessage="1" showErrorMessage="1" errorStyle="${errorStyle}"` +
    ` promptTitle="${escapeXml(attrs.promptTitle)}" prompt="${escapeXml(attrs.prompt)}"` +
    ` errorTitle="${escapeXml(attrs.errorTitle)}" error="${escapeXml(attrs.error)}">` +
    `<formula1>${escapeXml(attrs.formula1)}</formula1>${f2}</dataValidation>`
  );
}

function replaceSheetData(xml: string, sheetData: string): string {
  if (/<sheetData[\s\S]*?<\/sheetData>/.test(xml)) {
    return xml.replace(/<sheetData[\s\S]*?<\/sheetData>/, sheetData);
  }
  if (/<sheetData\b[^>]*\/>/.test(xml)) {
    return xml.replace(/<sheetData\b[^>]*\/>/, sheetData);
  }
  throw new Error("sheetData introuvable");
}

function replaceDataValidations(xml: string, inner: string, count: number): string {
  const block = `<dataValidations count="${count}">${inner}</dataValidations>`;
  if (/<dataValidations[\s\S]*?<\/dataValidations>/.test(xml)) {
    return xml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, block);
  }
  // Insert before </worksheet>
  return xml.replace("</worksheet>", `${block}</worksheet>`);
}

function upsertDefinedNames(workbookXml: string, names: Array<{ name: string; refers: string }>): string {
  const extra = names
    .map(
      (n) =>
        `<definedName name="${escapeXml(n.name)}">${escapeXml(n.refers)}</definedName>`,
    )
    .join("");
  if (/<definedNames[\s\S]*?<\/definedNames>/.test(workbookXml)) {
    return workbookXml.replace(
      /<definedNames([\s\S]*?)<\/definedNames>/,
      (_m, inner: string) => {
        // Drop previous ASTER_* names, keep filter databases.
        const kept = String(inner).replace(
          /<definedName name="ASTER_[^"]*"[\s\S]*?<\/definedName>/g,
          "",
        );
        return `<definedNames>${kept}${extra}</definedNames>`;
      },
    );
  }
  return workbookXml.replace(
    "</workbook>",
    `<definedNames>${extra}</definedNames></workbook>`,
  );
}

async function main() {
  const source = readFileSync(TARGET);
  const zip = await JSZip.loadAsync(source);

  const listesPath = "xl/worksheets/sheet5.xml";
  const listesXml = await zip.file(listesPath)?.async("string");
  if (!listesXml) throw new Error("Feuille Listes manquante");
  zip.file(listesPath, replaceSheetData(listesXml, buildListesSheetData()));

  const col = {
    statut: 1,
    contrat: 2,
    solde: 3,
    unite: 4,
    verif: 5,
    histEvent: 6,
    dept: 7,
    site: 8,
    histStatus: 9,
  };

  const collabValidations = [
    dv({
      sqref: `E5:E${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.dept, HR_IMPORT_DEPARTMENT_OPTIONS.length),
      promptTitle: "Département",
      prompt: "Sélectionnez un code département du référentiel ASTER.",
      errorTitle: "Département invalide",
      error: "Choisissez un code de la liste (ex. AUD, RH).",
    }),
    dv({
      sqref: `G5:G${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.site, HR_IMPORT_SITE_OPTIONS.length),
      errorStyle: "warning",
      promptTitle: "Site",
      prompt:
        "Sélectionnez un site connu, ou saisissez un nouveau site (avertissement à l'import).",
      errorTitle: "Site hors liste",
      error:
        "Site absent du référentiel démo — l'import l'acceptera avec un avertissement.",
    }),
    dv({
      sqref: `H5:H${DATA_END_ROW}`,
      type: "date",
      operator: "greaterThanOrEqual",
      formula1: "DATE(1990,1,1)",
      promptTitle: "Date d'embauche",
      prompt: "Saisissez une date Excel (AAAA-MM-JJ ou JJ/MM/AAAA).",
      errorTitle: "Date invalide",
      error: "La date d'embauche doit être une date Excel valide.",
    }),
    dv({
      sqref: `I5:I${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.contrat, HR_IMPORT_CONTRACT_OPTIONS.length),
      promptTitle: "Type de contrat",
      prompt: "CDI, CDD, Alternance ou Stage.",
      errorTitle: "Contrat invalide",
      error: "Seuls CDI, CDD, Alternance et Stage sont acceptés.",
    }),
    dv({
      sqref: `J5:J${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.statut, HR_IMPORT_STATUS_OPTIONS.length),
      promptTitle: "Statut",
      prompt: "Actif, Suspendu ou Sorti.",
      errorTitle: "Statut invalide",
      error: "Sélectionnez Actif, Suspendu ou Sorti.",
    }),
    dv({
      sqref: `L5:L${DATA_END_ROW}`,
      type: "date",
      operator: "greaterThanOrEqual",
      formula1: "DATE(1990,1,1)",
      promptTitle: "Date de sortie",
      prompt: "Optionnel — date Excel si le collaborateur est sorti.",
      errorTitle: "Date invalide",
      error: "La date de sortie doit être une date Excel valide ou vide.",
    }),
  ].join("");

  const soldesValidations = [
    dv({
      sqref: `B5:B${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.solde, HR_IMPORT_BALANCE_TYPE_OPTIONS.length),
      promptTitle: "Type de solde",
      prompt: "CP, RTT ou RECUPERATION_HEURES.",
      errorTitle: "Type invalide",
      error: "Sélectionnez CP, RTT ou RECUPERATION_HEURES.",
    }),
    dv({
      sqref: `C5:C${DATA_END_ROW}`,
      type: "decimal",
      operator: "greaterThanOrEqual",
      formula1: "0",
      promptTitle: "Solde restant",
      prompt: "Nombre ≥ 0 (décimales autorisées).",
      errorTitle: "Solde invalide",
      error: "Le solde doit être un nombre positif ou nul.",
    }),
    dv({
      sqref: `D5:D${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.unite, HR_IMPORT_UNIT_OPTIONS.length),
      promptTitle: "Unité",
      prompt: "Jours pour CP/RTT · Heures pour RECUPERATION_HEURES.",
      errorTitle: "Unité invalide",
      error: "Sélectionnez Jours ou Heures.",
    }),
    dv({
      sqref: `E5:E${DATA_END_ROW}`,
      type: "date",
      operator: "greaterThanOrEqual",
      formula1: "DATE(1990,1,1)",
      promptTitle: "Date d'effet",
      prompt: "Date Excel d'ouverture du solde.",
      errorTitle: "Date invalide",
      error: "La date d'effet doit être une date Excel valide.",
    }),
    dv({
      sqref: `H5:H${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.verif, HR_IMPORT_VERIFICATION_OPTIONS.length),
      promptTitle: "Vérification RH",
      prompt: "À vérifier ou Vérifié par RH.",
      errorTitle: "Valeur hors liste",
      error: "Sélectionnez une valeur de vérification RH.",
    }),
  ].join("");

  const histValidations = [
    dv({
      sqref: `B5:B${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.histEvent, HR_IMPORT_HISTORY_EVENT_OPTIONS.length),
      promptTitle: "Type d'opération",
      prompt: "Historique optionnel — non exécuté par ASTER aujourd'hui.",
      errorTitle: "Type invalide",
      error: "Sélectionnez un type d'opération de la liste.",
    }),
    dv({
      sqref: `C5:C${DATA_END_ROW}`,
      type: "date",
      operator: "greaterThanOrEqual",
      formula1: "DATE(1990,1,1)",
      promptTitle: "Date de début",
      prompt: "Date Excel optionnelle.",
      errorTitle: "Date invalide",
      error: "Date de début invalide.",
    }),
    dv({
      sqref: `D5:D${DATA_END_ROW}`,
      type: "date",
      operator: "greaterThanOrEqual",
      formula1: "DATE(1990,1,1)",
      promptTitle: "Date de fin",
      prompt: "Date Excel optionnelle.",
      errorTitle: "Date invalide",
      error: "Date de fin invalide.",
    }),
    dv({
      sqref: `E5:E${DATA_END_ROW}`,
      type: "decimal",
      operator: "greaterThanOrEqual",
      formula1: "0",
      promptTitle: "Quantité",
      prompt: "Nombre ≥ 0 si renseigné.",
      errorTitle: "Quantité invalide",
      error: "La quantité doit être un nombre ≥ 0.",
    }),
    dv({
      sqref: `F5:F${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.unite, HR_IMPORT_UNIT_OPTIONS.length),
      promptTitle: "Unité",
      prompt: "Jours ou Heures.",
      errorTitle: "Unité invalide",
      error: "Sélectionnez Jours ou Heures.",
    }),
    dv({
      sqref: `G5:G${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(
        col.histStatus,
        HR_IMPORT_HISTORY_STATUS_OPTIONS.length,
      ),
      promptTitle: "Statut",
      prompt: "Statut d'historique optionnel.",
      errorTitle: "Statut invalide",
      error: "Sélectionnez un statut de la liste.",
    }),
  ].join("");

  for (const [path, inner, count] of [
    ["xl/worksheets/sheet2.xml", collabValidations, 6],
    ["xl/worksheets/sheet3.xml", soldesValidations, 5],
    ["xl/worksheets/sheet4.xml", histValidations, 6],
  ] as const) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) throw new Error(`Feuille manquante ${path}`);
    zip.file(path, replaceDataValidations(xml, inner, count));
  }

  const workbookPath = "xl/workbook.xml";
  const workbookXml = await zip.file(workbookPath)?.async("string");
  if (!workbookXml) throw new Error("workbook.xml manquant");
  const named = [
    {
      name: "ASTER_Statuts",
      refers: listRange(col.statut, HR_IMPORT_STATUS_OPTIONS.length),
    },
    {
      name: "ASTER_Contrats",
      refers: listRange(col.contrat, HR_IMPORT_CONTRACT_OPTIONS.length),
    },
    {
      name: "ASTER_TypesSolde",
      refers: listRange(col.solde, HR_IMPORT_BALANCE_TYPE_OPTIONS.length),
    },
    {
      name: "ASTER_Unites",
      refers: listRange(col.unite, HR_IMPORT_UNIT_OPTIONS.length),
    },
    {
      name: "ASTER_Verifications",
      refers: listRange(col.verif, HR_IMPORT_VERIFICATION_OPTIONS.length),
    },
    {
      name: "ASTER_TypesOperation",
      refers: listRange(col.histEvent, HR_IMPORT_HISTORY_EVENT_OPTIONS.length),
    },
    {
      name: "ASTER_Departements",
      refers: listRange(col.dept, HR_IMPORT_DEPARTMENT_OPTIONS.length),
    },
    {
      name: "ASTER_Sites",
      refers: listRange(col.site, HR_IMPORT_SITE_OPTIONS.length),
    },
    {
      name: "ASTER_StatutsHistorique",
      refers: listRange(
        col.histStatus,
        HR_IMPORT_HISTORY_STATUS_OPTIONS.length,
      ),
    },
  ];
  zip.file(workbookPath, upsertDefinedNames(workbookXml, named));

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  writeFileSync(TARGET, out);
  const hash = createHash("sha256").update(out).digest("hex");
  console.log(`Wrote ${TARGET}`);
  console.log(`sha256 ${hash}`);
  console.log(
    `contracts=${HR_IMPORT_CONTRACT_OPTIONS.join("|")} statuses=${HR_IMPORT_STATUS_OPTIONS.join("|")}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
