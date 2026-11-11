import JSZip from "jszip";
import { readFileSync } from "fs";
import { join } from "path";
import { OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH } from "@/domain/rules/hr-import/templates";

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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineCell(ref: string, value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  const text = escapeXml(String(value));
  return `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
}

/**
 * Produit une copie temporaire du modèle officiel remplie avec des données fictives.
 * Ne modifie jamais le fichier canonique assets/.
 */
export async function buildFilledOfficialWorkbook(input: {
  employees: Array<Array<string | number>>;
  balances: Array<Array<string | number>>;
  history?: Array<Array<string | number>>;
}): Promise<Uint8Array> {
  const source = readFileSync(
    join(process.cwd(), OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH),
  );
  const zip = await JSZip.loadAsync(source);

  async function inject(
    sheetPath: string,
    startRow: number,
    rows: Array<Array<string | number>>,
  ) {
    const xml = await zip.file(sheetPath)?.async("string");
    if (!xml) throw new Error(`Feuille manquante ${sheetPath}`);
    let out = xml;
    // Remove pre-existing empty table body rows beyond header if present — append cells.
    const rowXml = rows
      .map((vals, i) => {
        const r = startRow + i;
        const cells = vals
          .map((v, c) => inlineCell(`${colLetter(c + 1)}${r}`, v))
          .join("");
        return `<row r="${r}">${cells}</row>`;
      })
      .join("");
    if (/<\/sheetData>/.test(out)) {
      out = out.replace("</sheetData>", `${rowXml}</sheetData>`);
    } else {
      out = out.replace(
        /<sheetData\b[^>]*\/>/,
        `<sheetData>${rowXml}</sheetData>`,
      );
    }
    zip.file(sheetPath, out);
  }

  await inject("xl/worksheets/sheet2.xml", 5, input.employees);
  await inject("xl/worksheets/sheet3.xml", 5, input.balances);
  if (input.history?.length) {
    await inject("xl/worksheets/sheet4.xml", 5, input.history);
  }

  const buffer = await zip.generateAsync({ type: "uint8array" });
  return buffer;
}

export function officialTemplateBytes(): Uint8Array {
  return new Uint8Array(
    readFileSync(join(process.cwd(), OFFICIAL_HR_IMPORT_TEMPLATE_RELATIVE_PATH)),
  );
}
