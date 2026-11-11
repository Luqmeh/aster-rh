import { beforeEach, describe, expect, it, vi } from "vitest";
import { testSessionFor } from "@/infrastructure/auth/test-session";

const confirmAndExecute = vi.fn();
const downloadTemplate = vi.fn();
const getSession = vi.fn();

vi.mock("@/infrastructure/container", () => ({
  getContainer: () => ({
    auth: { getSession },
    hr: {},
    email: {},
    storage: {},
    payroll: {},
    persistence: "memory" as const,
  }),
}));

vi.mock("@/application/services/hr-import-service", () => ({
  createHrImportService: () => ({
    confirmAndExecute,
    downloadTemplate,
    uploadWorkbook: vi.fn(),
    validateBatch: vi.fn(),
    downloadExecutionReport: vi.fn(),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("hr-import actions — pas de throw métier (#441)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(testSessionFor("emp-camille", "admin_rh"));
  });

  it("executeHrImportAction renvoie ok:false avec le message métier (pas d'exception)", async () => {
    confirmAndExecute.mockRejectedValue(
      new Error(
        "Des lignes invalides restent présentes — corrigez le fichier ou retirez-les.",
      ),
    );
    const { executeHrImportAction } = await import("@/app/actions/hr-import");
    const fd = new FormData();
    fd.set("batchId", "batch-1");
    fd.set("confirmationPhrase", "IMPORTER");
    const result = await executeHrImportAction(fd);
    expect(result).toEqual({
      ok: false,
      message:
        "Des lignes invalides restent présentes — corrigez le fichier ou retirez-les.",
    });
  });

  it("executeHrImportAction renvoie ok:true après succès", async () => {
    confirmAndExecute.mockResolvedValue({ id: "batch-1", status: "completed" });
    const { executeHrImportAction } = await import("@/app/actions/hr-import");
    const fd = new FormData();
    fd.set("batchId", "batch-1");
    fd.set("confirmationPhrase", "IMPORTER");
    await expect(executeHrImportAction(fd)).resolves.toEqual({
      ok: true,
      batchId: "batch-1",
    });
  });
});
