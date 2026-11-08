import { afterEach, describe, expect, it } from "vitest";
import {
  ASTER_PRIVATE_DOCS_BUCKET,
  assertProductionStorageReady,
  createDocumentStorage,
  isSupabaseStorageConfigured,
  resolveStorageConfig,
} from "@/infrastructure/storage/supabase-storage";
import { mockDocumentStorage } from "@/infrastructure/storage/mock-storage";

describe("supabase storage factory", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("utilise le bucket aster-private-docs par défaut", () => {
    expect(resolveStorageConfig({}).bucket).toBe(ASTER_PRIVATE_DOCS_BUCKET);
    expect(ASTER_PRIVATE_DOCS_BUCKET).toBe("aster-private-docs");
  });

  it("autorise le mock en local sans clés Supabase", () => {
    const storage = createDocumentStorage({
      NODE_ENV: "development",
      VERCEL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    });
    expect(storage).toBe(mockDocumentStorage);
    expect(
      isSupabaseStorageConfigured({
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      }),
    ).toBe(false);
  });

  it("échoue clairement en production si Supabase Storage est absent", () => {
    expect(() =>
      assertProductionStorageReady({
        VERCEL: "1",
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      }),
    ).toThrow(/Stockage Supabase requis/i);

    expect(() =>
      createDocumentStorage({
        VERCEL: "1",
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      }),
    ).toThrow(/Stockage Supabase requis/i);
  });

  it("rejette un nom de bucket incorrect en production", () => {
    expect(() =>
      assertProductionStorageReady({
        VERCEL: "1",
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        ASTER_STORAGE_BUCKET: "public-docs",
      }),
    ).toThrow(/aster-private-docs/);
  });

  it("autorise le mock pendant le build offline", () => {
    expect(() =>
      assertProductionStorageReady({
        VERCEL: "1",
        NODE_ENV: "production",
        ASTER_BUILD_WITHOUT_DB: "1",
      }),
    ).not.toThrow();
  });
});
