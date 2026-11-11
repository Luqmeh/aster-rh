import ExcelJS from "exceljs";
import {
  resolveCanonicalHeader,
  type BalanceFieldKey,
  type EmployeeFieldKey,
} from "@/domain/rules/hr-import/templates";

export type ParsedSheet = {
  name: string;
  headers: string[];
  /** Lignes 1-indexées (numéro Excel). */
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
};

export type ParsedWorkbook = {
  worksheets: ParsedSheet[];
};

function cellToString(value: ExcelJS.CellValue): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "object") {
    const v = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (typeof v.text === "string") return v.text.trim();
    if (typeof v.result === "string" || typeof v.result === "number") {
      return String(v.result).trim();
    }
    if (Array.isArray(v.richText)) {
      return v.richText.map((t) => t.text).join("").trim();
    }
  }
  return String(value).trim();
}

export async function parseExcelWorkbook(
  data: ArrayBuffer | Buffer | Uint8Array,
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS typings accept Buffer / ArrayBuffer via read
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(data as any);
  const worksheets: ParsedSheet[] = [];

  workbook.eachSheet((sheet) => {
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    const maxCol = Math.max(headerRow.cellCount, 1);
    for (let c = 1; c <= maxCol; c += 1) {
      const h = cellToString(headerRow.getCell(c).value);
      if (h) headers[c - 1] = h;
    }
    const canonical = headers.map((h) => resolveCanonicalHeader(h) ?? h);
    const rows: ParsedSheet["rows"] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const cells: Record<string, string> = {};
      let any = false;
      for (let c = 1; c <= headers.length; c += 1) {
        const key = canonical[c - 1];
        if (!key) continue;
        const raw = cellToString(row.getCell(c).value);
        if (raw) any = true;
        cells[key] = raw;
      }
      if (!any) return;
      rows.push({ rowNumber, cells });
    });
    worksheets.push({
      name: sheet.name,
      headers: headers.filter(Boolean),
      rows,
    });
  });

  return { worksheets };
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
  // Also keep already-canonical keys from parse
  for (const [k, v] of Object.entries(cells)) {
    if (out[k] == null) out[k] = v;
  }
  return out;
}

function sheetHasBalanceHeaders(sheet: ParsedSheet): boolean {
  return sheet.headers.some((h) => {
    const c = resolveCanonicalHeader(h);
    return c === "cpDays" || c === "rttDays" || c === "recoveryHours";
  });
}

function sheetHasEmployeeHeaders(sheet: ParsedSheet): boolean {
  const keys = new Set(
    sheet.headers.map((h) => resolveCanonicalHeader(h)).filter(Boolean),
  );
  return keys.has("email") || (keys.has("firstName") && keys.has("lastName"));
}

export function pickEmployeeSheet(worksheets: ParsedSheet[]): ParsedSheet | null {
  const byName = worksheets.find(
    (s) =>
      /collab|employ|personnel|effectif/i.test(s.name) &&
      !sheetHasBalanceHeaders(s),
  );
  if (byName) return byName;
  const byHeaders = worksheets.find(
    (s) => sheetHasEmployeeHeaders(s) && !sheetHasBalanceHeaders(s),
  );
  if (byHeaders) return byHeaders;
  // Feuille unique mixte (collaborateurs + soldes) — rare
  const mixed = worksheets.find(
    (s) => sheetHasEmployeeHeaders(s) && sheetHasBalanceHeaders(s),
  );
  return mixed ?? null;
}

export function pickBalanceSheet(worksheets: ParsedSheet[]): ParsedSheet | null {
  const byName = worksheets.find((s) =>
    /solde|balance|ouverture/i.test(s.name),
  );
  if (byName && sheetHasBalanceHeaders(byName)) return byName;
  if (byName) return byName;
  return worksheets.find((s) => sheetHasBalanceHeaders(s)) ?? null;
}

export type { EmployeeFieldKey, BalanceFieldKey };
