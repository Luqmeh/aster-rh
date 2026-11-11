import JSZip from "jszip";

export type OoxmlSheet = {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  /** Sparse map rowNumber(1-based) -> colIndex(1-based) -> string */
  cells: Map<number, Map<number, string>>;
  maxRow: number;
  maxCol: number;
};

function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!m) return null;
  return { col: colToIndex(m[1]!), row: Number(m[2]) };
}

function excelSerialToIso(serial: number): string {
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + Math.floor(serial) * 86400000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const block = m[1] ?? "";
    const texts = [...block.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((t) =>
      decodeXmlEntities(t[1] ?? ""),
    );
    out.push(texts.join("").trim());
  }
  return out;
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(tag);
  return m ? decodeXmlEntities(m[1]!) : null;
}

function parseWorkbookSheets(
  wbXml: string,
  relXml: string,
): Array<{ name: string; state: OoxmlSheet["state"]; target: string }> {
  const ridToTarget = new Map<string, string>();
  const relRe = /<Relationship\b[^>]*>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = relRe.exec(relXml))) {
    const tag = rm[0];
    const id = attr(tag, "Id");
    const target = attr(tag, "Target");
    if (id && target) ridToTarget.set(id, target);
  }

  const sheets: Array<{ name: string; state: OoxmlSheet["state"]; target: string }> =
    [];
  const sheetRe = /<sheet\b[^>]*\/?>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = sheetRe.exec(wbXml))) {
    const tag = sm[0];
    const name = attr(tag, "name") ?? "Feuille";
    const stateRaw = (attr(tag, "state") ?? "visible").toLowerCase();
    const state: OoxmlSheet["state"] =
      stateRaw === "hidden"
        ? "hidden"
        : stateRaw === "veryhidden"
          ? "veryHidden"
          : "visible";
    const rid =
      attr(tag, "r:id") ??
      attr(tag, "id") ??
      (() => {
        const m = /\br:id="([^"]+)"/i.exec(tag);
        return m?.[1] ?? null;
      })();
    if (!rid) continue;
    let target = ridToTarget.get(rid);
    if (!target) continue;
    target = target.replace(/^\//, "");
    if (!target.startsWith("xl/")) target = `xl/${target}`;
    sheets.push({ name, state, target });
  }
  return sheets;
}

function parseSheetCells(
  sheetXml: string,
  shared: string[],
): { cells: Map<number, Map<number, string>>; maxRow: number; maxCol: number } {
  const cells = new Map<number, Map<number, string>>();
  let maxRow = 0;
  let maxCol = 0;
  const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(sheetXml))) {
    const openAttrs = m[1] ?? m[3] ?? "";
    const inner = m[2] ?? "";
    const ref = attr(`<c ${openAttrs}>`, "r");
    if (!ref) continue;
    const parsed = parseRef(ref);
    if (!parsed) continue;
    const t = attr(`<c ${openAttrs}>`, "t");
    const vMatch = /<v\b[^>]*>([\s\S]*?)<\/v>/i.exec(inner);
    const vText = vMatch ? decodeXmlEntities(vMatch[1] ?? "") : "";
    const inlineTexts = [
      ...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi),
    ].map((x) => decodeXmlEntities(x[1] ?? ""));
    const inline = inlineTexts.join("");

    let value = "";
    if (t === "s") {
      const idx = Number(vText);
      value = Number.isFinite(idx) ? (shared[idx] ?? "") : "";
    } else if (t === "inlineStr" || t === "str") {
      value = (inline || vText).trim();
    } else if (t === "b") {
      value = vText === "1" ? "true" : "false";
    } else if (vText && /^\d+(\.\d+)?$/.test(vText)) {
      const n = Number(vText);
      if (n > 20000 && n < 80000 && Number.isInteger(n)) {
        value = excelSerialToIso(n);
      } else {
        value = String(n);
      }
    } else {
      value = (vText || inline).trim();
    }

    if (!cells.has(parsed.row)) cells.set(parsed.row, new Map());
    cells.get(parsed.row)!.set(parsed.col, value);
    maxRow = Math.max(maxRow, parsed.row);
    maxCol = Math.max(maxCol, parsed.col);
  }
  return { cells, maxRow, maxCol };
}

/**
 * Lecture OOXML robuste — contourne les plantages ExcelJS sur commentaires / tables
 * du modèle RH officiel ASTER.
 */
export async function loadOoxmlWorkbook(
  data: ArrayBuffer | Buffer | Uint8Array,
): Promise<OoxmlSheet[]> {
  const zip = await JSZip.loadAsync(data);
  const wbXml = await zip.file("xl/workbook.xml")?.async("string");
  if (!wbXml) throw new Error("Classeur Excel invalide (workbook.xml manquant).");
  const relXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!relXml) throw new Error("Classeur Excel invalide (rels manquant).");
  const sharedXml = await zip.file("xl/sharedStrings.xml")?.async("string");
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];

  const meta = parseWorkbookSheets(wbXml, relXml);
  const sheets: OoxmlSheet[] = [];
  for (const s of meta) {
    const sheetXml = await zip.file(s.target)?.async("string");
    if (!sheetXml) continue;
    const parsed = parseSheetCells(sheetXml, shared);
    sheets.push({
      name: s.name,
      state: s.state,
      cells: parsed.cells,
      maxRow: parsed.maxRow,
      maxCol: parsed.maxCol,
    });
  }
  return sheets;
}

/** Trouve la ligne d'en-têtes (ex. ligne 4 du modèle officiel avec titre au-dessus). */
export function detectHeaderRow(
  sheet: OoxmlSheet,
  isHeaderCandidate: (values: string[]) => boolean,
): number {
  const limit = Math.min(sheet.maxRow, 40);
  for (let r = 1; r <= limit; r += 1) {
    const row = sheet.cells.get(r);
    if (!row) continue;
    const values: string[] = [];
    for (let c = 1; c <= Math.max(sheet.maxCol, 1); c += 1) {
      values.push((row.get(c) ?? "").trim());
    }
    if (isHeaderCandidate(values)) return r;
  }
  return 1;
}
