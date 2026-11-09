import { afterEach, describe, expect, it, vi } from "vitest";

describe("getContainer storage laziness", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock("@/infrastructure/storage/supabase-storage");
  });

  it("ne crée pas le stockage tant qu'il n'est pas accédé", async () => {
    const createDocumentStorage = vi.fn(() => ({
      putObject: vi.fn(),
      getDownloadUrl: vi.fn(),
      deleteObject: vi.fn(),
    }));
    vi.doMock("@/infrastructure/storage/supabase-storage", () => ({
      createDocumentStorage,
    }));
    vi.doMock("@/infrastructure/persistence/persistence-mode", () => ({
      resolvePersistenceMode: () => "demo",
    }));
    vi.doMock("@/infrastructure/persistence/demo-hr-repository", () => ({
      demoHrRepository: {},
    }));
    vi.doMock("@/infrastructure/persistence/prisma-hr-repository", () => ({
      prismaHrRepository: {},
    }));
    vi.doMock("@/infrastructure/auth/session-auth", () => ({
      sessionAuth: {},
    }));
    vi.doMock("@/infrastructure/email/mock-email", () => ({
      mockEmail: {},
    }));
    vi.doMock("@/infrastructure/payroll/mock-payroll", () => ({
      mockPayroll: {},
    }));

    const { getContainer } = await import("@/infrastructure/container");
    const container = getContainer();
    expect(createDocumentStorage).not.toHaveBeenCalled();
    expect(container.hr).toBeDefined();
    expect(createDocumentStorage).not.toHaveBeenCalled();
    void container.storage;
    expect(createDocumentStorage).toHaveBeenCalledOnce();
  });
});
