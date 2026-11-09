import ExcelJS from "exceljs";

export type SheetColumn = {
  header: string;
  key: string;
  width?: number;
};

export async function createStyledWorkbook(
  sheetName: string,
  columns: SheetColumn[],
  rows: Record<string, string | number | null | undefined>[],
): Promise<{ buffer: Buffer; rowCount: number }> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ASTER";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 18,
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1B2A4A" },
  };
  header.alignment = { vertical: "middle", wrapText: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  if (rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  } else {
    sheet.addRow(
      Object.fromEntries(
        columns.map((c, i) => [c.key, i === 0 ? "Aucune donnée pour ces filtres." : ""]),
      ),
    );
  }

  const raw = await workbook.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(raw),
    rowCount: rows.length,
  };
}

export function formatNumberFr(value: number, digits = 2): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}
