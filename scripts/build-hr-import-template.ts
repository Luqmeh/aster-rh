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
  HR_IMPORT_GRADE_OPTIONS,
  HR_IMPORT_STATUS_OPTIONS,
  HR_IMPORT_BALANCE_TYPE_OPTIONS,
  HR_IMPORT_UNIT_OPTIONS,
  HR_IMPORT_VERIFICATION_OPTIONS,
  HR_IMPORT_HISTORY_EVENT_OPTIONS,
  HR_IMPORT_HISTORY_STATUS_OPTIONS,
} from "../src/domain/rules/hr-import/accepted-values";
import {
  EMPLOYEE_TEMPLATE_COLUMNS,
  OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH,
} from "../src/domain/rules/hr-import/templates";

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

/** Encodage des accents comme dans la feuille Lisez-moi (entités numériques). */
function escapeXmlNumeric(s: string): string {
  return escapeXml(s).replace(/[^\x20-\x7e]/g, (ch) => {
    const cp = ch.codePointAt(0)!;
    return `&#${cp};`;
  });
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
      /<definedNames[^>]*>([\s\S]*?)<\/definedNames>/,
      (_m, inner: string) => {
        // Drop previous ASTER_* names, keep filter databases.
        const kept = String(inner).replace(/^>+/, "").replace(
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

  // Lisez-moi — alignement structure Grade / People Manager / Région.
  const lisezPath = "xl/worksheets/sheet1.xml";
  const lisezXml = await zip.file(lisezPath)?.async("string");
  if (!lisezXml) throw new Error("Feuille Lisez-moi manquante");
  let lisezPatched = lisezXml;
  const lisezReplacements: Array<[string, string]> = [
    [
      "Une ligne par collaborateur. Utilisez un matricule unique et stable. Ne créez pas de matricule si l'entreprise n'en utilise pas : demandez à RH de définir un identifiant de référence.",
      "Une ligne par collaborateur. Matricule unique et stable. Grade* = Auditeur junior / Auditeur senior / Manager (liste). People Manager = texte libre (avec ou sans compte ASTER). Région* = texte libre (pas de liste). Ne pas utiliser Site ni catégorie cadre/non-cadre.",
    ],
    [
      "Laissez vide et ajoutez une remarque. N'inventez pas de date, d'adresse e-mail, de solde ou de catégorie.",
      "Laissez vide et ajoutez une remarque. N'inventez pas de date, d'adresse e-mail, de solde ou de grade.",
    ],
    [
      "Renseignez uniquement si un solde RTT existe réellement et est suivi par l'entreprise. Laissez vide si non applicable ou non confirmé.",
      "Historique / import uniquement si un solde RTT existe réellement. L'acquisition RTT Maroc n'est pas automatique ; le solde calculé canonique est la Récupération (heures).",
    ],
  ];
  for (const [from, to] of lisezReplacements) {
    const fromEnc = escapeXmlNumeric(from);
    const toEnc = escapeXmlNumeric(to);
    if (lisezPatched.includes(fromEnc)) {
      lisezPatched = lisezPatched.replaceAll(fromEnc, toEnc);
    } else if (lisezPatched.includes(toEnc)) {
      // Déjà patché — régénération idempotente.
      continue;
    } else {
      throw new Error(
        `Lisez-moi : fragment introuvable pour remplacement (« ${from.slice(0, 48)}… »).`,
      );
    }
  }
  zip.file(lisezPath, lisezPatched);

  const listesPath = "xl/worksheets/sheet5.xml";
  const listesXml = await zip.file(listesPath)?.async("string");
  if (!listesXml) throw new Error("Feuille Listes manquante");
  zip.file(listesPath, replaceSheetData(listesXml, buildListesSheetData()));

  // Feuille Listes : Statut, Contrat, Solde, Unité, Vérif, HistEvent, Grade, HistStatus
  const col = {
    statut: 1,
    contrat: 2,
    solde: 3,
    unite: 4,
    verif: 5,
    histEvent: 6,
    grade: 7,
    histStatus: 8,
  };

  // Feuille Collaborateurs : en-têtes (ligne 4) + largeur de table alignées sur
  // EMPLOYEE_TEMPLATE_COLUMNS (Grade / People Manager / Région — pas de Site / cadre).
  const collabPath = "xl/worksheets/sheet2.xml";
  const collabXml = await zip.file(collabPath)?.async("string");
  if (!collabXml) throw new Error("Feuille Collaborateurs manquante");
  const nCols = EMPLOYEE_TEMPLATE_COLUMNS.length;
  const lastCol = colLetter(nCols);
  const headerCells = EMPLOYEE_TEMPLATE_COLUMNS.map((c, i) => {
    const ref = `${colLetter(i + 1)}4`;
    return `<c r="${ref}" s="14" t="inlineStr"><is><t>${escapeXml(c.header)}</t></is></c>`;
  }).join("");
  const headerRow = `<row r="4">${headerCells}</row>`;
  if (!/<row r="4"[\s\S]*?<\/row>/.test(collabXml)) {
    throw new Error("Ligne d'en-tête Collaborateurs (r=4) introuvable");
  }
  const colsXml = `<cols>${EMPLOYEE_TEMPLATE_COLUMNS.map(
    (c, i) =>
      `<col width="${Math.max(c.width ?? 16, 16)}" customWidth="1" min="${i + 1}" max="${i + 1}"/>`,
  ).join("")}</cols>`;
  const collabPatched = collabXml
    .replace(/<row r="4"[\s\S]*?<\/row>/, headerRow)
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${lastCol}${DATA_END_ROW}"/>`)
    .replace(/<cols>[\s\S]*?<\/cols>/, colsXml)
    .replace(/<autoFilter ref="[^"]*"\/>/, `<autoFilter ref="A4:${lastCol}${DATA_END_ROW}"/>`)
    .replace(/<mergeCell ref="A2:[A-Z]+2"\/>/, `<mergeCell ref="A2:${lastCol}2"/>`)
    .replace(/<mergeCell ref="A1:[A-Z]+1"\/>/, `<mergeCell ref="A1:${lastCol}1"/>`);
  zip.file(collabPath, collabPatched);

  const tablePath = "xl/tables/table1.xml";
  const tableXml = await zip.file(tablePath)?.async("string");
  if (!tableXml) throw new Error("Table Collaborateurs manquante");
  const tableRef = `A4:${lastCol}${DATA_END_ROW}`;
  const tableCols = EMPLOYEE_TEMPLATE_COLUMNS.map(
    (c, i) => `<tableColumn id="${i + 1}" name="${escapeXml(c.header)}"/>`,
  ).join("");
  zip.file(
    tablePath,
    tableXml
      .replace(/ ref="[^"]*" headerRowCount/, ` ref="${tableRef}" headerRowCount`)
      .replace(/<autoFilter ref="[^"]*"\/>/, `<autoFilter ref="${tableRef}"/>`)
      .replace(
        /<tableColumns[\s\S]*?<\/tableColumns>/,
        `<tableColumns count="${nCols}">${tableCols}</tableColumns>`,
      ),
  );

  // Commentaires d'en-tête : Matricule (A4) et Date d'embauche (colonne J).
  const hireCol = colLetter(
    EMPLOYEE_TEMPLATE_COLUMNS.findIndex((c) => c.key === "hireDate") + 1,
  );
  const commentPath = "xl/comments/comment1.xml";
  const commentXml = await zip.file(commentPath)?.async("string");
  if (!commentXml) throw new Error("Commentaires Collaborateurs manquants");
  const vmlPath = "xl/drawings/commentsDrawing1.vml";
  const vmlXml = await zip.file(vmlPath)?.async("string");
  if (vmlXml) {
    // Ancre du 2e commentaire (index 0-based de la colonne Date d'embauche).
    const hireIdx = EMPLOYEE_TEMPLATE_COLUMNS.findIndex((c) => c.key === "hireDate");
    zip.file(
      vmlPath,
      vmlXml.replace(
        /(<ns2:Row>3<\/ns2:Row><ns2:Column>)[1-9]\d*(<\/ns2:Column>)/,
        `$1${hireIdx}$2`,
      ),
    );
  }
  zip.file(
    commentPath,
    commentXml.replace(
      /<comment ref="[A-Z]+4" authorId="0" shapeId="0"><text><t>Date réelle/,
      `<comment ref="${hireCol}4" authorId="0" shapeId="0"><text><t>Date réelle`,
    ),
  );

  // Collaborateurs : A Matricule … E Grade, F PM, G Région, H Embauche, I Contrat, J Statut, K Sortie, L Remarques
  const collabValidations = [
    dv({
      sqref: `E5:E${DATA_END_ROW}`,
      type: "list",
      formula1: listRange(col.grade, HR_IMPORT_GRADE_OPTIONS.length),
      promptTitle: "Grade",
      prompt: "Auditeur junior, Auditeur senior ou Manager.",
      errorTitle: "Grade invalide",
      error: "Seuls Auditeur junior, Auditeur senior et Manager sont acceptés.",
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
      prompt: "CDI ou Stage.",
      errorTitle: "Contrat invalide",
      error: "Seuls CDI et Stage sont acceptés.",
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
      sqref: `K5:K${DATA_END_ROW}`,
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
    ["xl/worksheets/sheet2.xml", collabValidations, 5],
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
      name: "ASTER_Grades",
      refers: listRange(col.grade, HR_IMPORT_GRADE_OPTIONS.length),
    },
    {
      name: "ASTER_StatutsHistorique",
      refers: listRange(
        col.histStatus,
        HR_IMPORT_HISTORY_STATUS_OPTIONS.length,
      ),
    },
  ];
  const workbookPatched = workbookXml
    .replace(/<definedNames>>+/, "<definedNames>")
    .replace(
      /('Collaborateurs'!\$A\$4:\$)[A-Z]+(\$204)/,
      `$1${lastCol}$2`,
    );
  zip.file(workbookPath, upsertDefinedNames(workbookPatched, named));

  // Horodatage fixe → hash SHA-256 stable entre régénérations.
  const FIXED_DATE = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
  zip.forEach((_path, entry) => {
    entry.date = FIXED_DATE;
  });
  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX",
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
