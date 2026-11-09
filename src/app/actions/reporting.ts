"use server";

import {
  createReportingService,
  parseReportingFilters,
} from "@/application/services/reporting-service";
import {
  REPORT_EXPORT_KEYS,
  type ReportExportKey,
} from "@/domain/rules/reporting";
import { AuthError, requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";

type ActionFail = { ok: false; message: string };
type ExportOk = {
  ok: true;
  filename: string;
  mimeType: string;
  base64: string;
  rowCount: number;
};

function toError(error: unknown, fallback: string): ActionFail {
  if (error instanceof AuthError) {
    return { ok: false, message: error.message };
  }
  if (error instanceof Error && error.message.trim()) {
    return { ok: false, message: error.message };
  }
  return { ok: false, message: fallback };
}

export async function exportHrReportAction(input: {
  reportKey: string;
  preset?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  departmentId?: string | null;
  employeeId?: string | null;
  employmentStatus?: string | null;
  requestStatus?: string | null;
}): Promise<ExportOk | ActionFail> {
  try {
    if (
      !REPORT_EXPORT_KEYS.includes(input.reportKey as ReportExportKey)
    ) {
      return { ok: false, message: "Type d'export inconnu." };
    }
    const container = getContainer();
    const session = requireSession(await container.auth.getSession());
    const service = createReportingService(container);
    const result = await service.exportReport(
      session,
      input.reportKey as ReportExportKey,
      {
        preset: input.preset,
        startDate: input.startDate,
        endDate: input.endDate,
        departmentId: input.departmentId,
        employeeId: input.employeeId,
        employmentStatus: input.employmentStatus,
        requestStatus: input.requestStatus,
      },
    );
    return {
      ok: true,
      filename: result.filename,
      mimeType: result.mimeType,
      base64: result.base64,
      rowCount: result.rowCount,
    };
  } catch (error) {
    return toError(error, "Export Excel impossible.");
  }
}

/** Validation serveur des filtres (utilisée aussi pour tests). */
export async function validateReportingFiltersAction(input: {
  preset?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  try {
    const filters = parseReportingFilters(input);
    return { ok: true as const, filters };
  } catch (error) {
    return toError(error, "Filtres invalides.");
  }
}
