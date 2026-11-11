import {
  detectHeaderRow,
  loadOoxmlWorkbook,
  type OoxmlSheet,
} from "@/domain/rules/hr-import/ooxml-workbook";
import {
  resolveCanonicalHeader,
  type BalanceFieldKey,
  type EmployeeFieldKey,
} from "@/domain/rules/hr-import/templates";

export type ParsedSheet = {
  name: string;
  state: "visible" | "hidden" | "veryHidden";
  headers: string[];
  headerRowNumber: number;
  /** Lignes 1-indexées (numéro Excel). */
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
};

export type ParsedWorkbook = {
  worksheets: ParsedSheet[];
};

function looksLikeHeaderRow(values: string[]): boolean {
  const normalized = values.filter(Boolean).map((v) =>
    v
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\*/g, ""),
  );
  if (normalized.length < 2) return false;
  // En-tête de colonne « Matricule » (pas un paragraphe d'instructions).
  const hasMatriculeCol = normalized.some(
    (v) => v === "matricule" || v.startsWith("matricule "),
  );
  if (!hasMatriculeCol) return false;
  const hasPerson =
    normalized.some((v) => v === "prenom" || v.startsWith("prenom")) ||
    normalized.some((v) => v === "nom" || v.startsWith("nom ")) ||
    normalized.some((v) => v.includes("mail"));
  const hasBalance = normalized.some(
    (v) =>
      v.includes("type de solde") ||
      v.includes("solde restant") ||
      v.includes("solde_cp") ||
      v.includes("type d'operation") ||
      v.includes("type doperation") ||
      v === "cp" ||
      v === "rtt",
  );
  return hasPerson || hasBalance;
}

function sheetToParsed(sheet: OoxmlSheet): ParsedSheet {
  const headerRowNumber = detectHeaderRow(sheet, looksLikeHeaderRow);
  const headerCells = sheet.cells.get(headerRowNumber) ?? new Map();
  const maxCol = Math.max(sheet.maxCol, ...headerCells.keys(), 1);
  const headers: string[] = [];
  for (let c = 1; c <= maxCol; c += 1) {
    const h = (headerCells.get(c) ?? "").trim();
    if (h) headers[c - 1] = h;
  }
  const canonical = headers.map((h) => (h ? resolveCanonicalHeader(h) ?? h : ""));
  const rows: ParsedSheet["rows"] = [];
  for (let r = headerRowNumber + 1; r <= sheet.maxRow; r += 1) {
    const row = sheet.cells.get(r);
    if (!row) continue;
    const cells: Record<string, string> = {};
    let any = false;
    for (let c = 1; c <= headers.length; c += 1) {
      const key = canonical[c - 1];
      if (!key) continue;
      const raw = (row.get(c) ?? "").trim();
      if (raw) any = true;
      cells[key] = raw;
    }
    if (!any) continue;
    rows.push({ rowNumber: r, cells });
  }
  return {
    name: sheet.name,
    state: sheet.state,
    headers: headers.filter(Boolean),
    headerRowNumber,
    rows,
  };
}

export async function parseExcelWorkbook(
  data: ArrayBuffer | Buffer | Uint8Array,
): Promise<ParsedWorkbook> {
  const sheets = await loadOoxmlWorkbook(data);
  return {
    worksheets: sheets.map(sheetToParsed),
  };
}

export function autoDetectColumnMapping(
  headers: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const canon = resolveCanonicalHeader(h);
    if (canon) mapping[canon] = h;
  }
  return mapping;
}

export function applyColumnMapping(
  cells: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [field, sourceHeader] of Object.entries(mapping)) {
    const direct = cells[field];
    if (direct != null && direct !== "") {
      out[field] = direct;
      continue;
    }
    const fromHeader = cells[sourceHeader];
    if (fromHeader != null) out[field] = fromHeader;
  }
  for (const [k, v] of Object.entries(cells)) {
    if (out[k] == null) out[k] = v;
  }
  return out;
}

function sheetHasBalanceHeaders(sheet: ParsedSheet): boolean {
  return sheet.headers.some((h) => {
    const c = resolveCanonicalHeader(h);
    return (
      c === "cpDays" ||
      c === "rttDays" ||
      c === "recoveryHours" ||
      c === "balanceType" ||
      c === "balanceAmount"
    );
  });
}

function sheetHasEmployeeHeaders(sheet: ParsedSheet): boolean {
  const keys = new Set(
    sheet.headers.map((h) => resolveCanonicalHeader(h)).filter(Boolean),
  );
  return (
    keys.has("email") ||
    (keys.has("firstName") && keys.has("lastName")) ||
    (keys.has("matricule") && keys.has("lastName"))
  );
}

function sheetHasHistoryHeaders(sheet: ParsedSheet): boolean {
  return sheet.headers.some((h) => resolveCanonicalHeader(h) === "eventType");
}

export function pickEmployeeSheet(worksheets: ParsedSheet[]): ParsedSheet | null {
  const visible = worksheets.filter((s) => s.state === "visible");
  const byName = visible.find(
    (s) =>
      /^collaborateurs$/i.test(s.name.trim()) ||
      (/collab|employ|personnel|effectif/i.test(s.name) &&
        !/solde|historique|lisez|listes/i.test(s.name)),
  );
  if (byName && sheetHasEmployeeHeaders(byName)) return byName;
  if (byName) return byName;
  return (
    visible.find(
      (s) => sheetHasEmployeeHeaders(s) && !sheetHasBalanceHeaders(s),
    ) ?? null
  );
}

export function pickBalanceSheet(worksheets: ParsedSheet[]): ParsedSheet | null {
  const visible = worksheets.filter((s) => s.state === "visible");
  const byName = visible.find((s) =>
    /solde|balance|ouverture|initiaux/i.test(s.name),
  );
  if (byName) return byName;
  return visible.find((s) => sheetHasBalanceHeaders(s)) ?? null;
}

export function pickHistorySheet(worksheets: ParsedSheet[]): ParsedSheet | null {
  const visible = worksheets.filter((s) => s.state === "visible");
  const byName = visible.find((s) => /historique/i.test(s.name));
  if (byName) return byName;
  return visible.find((s) => sheetHasHistoryHeaders(s)) ?? null;
}

export type { EmployeeFieldKey, BalanceFieldKey };
