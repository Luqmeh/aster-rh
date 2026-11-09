import { afterEach, describe, expect, it } from "vitest";
import {
  ASTER_PRIVATE_DOCS_BUCKET,
  assertProductionStorageReady,
  createDocumentStorage,
  extractSupabaseProjectRef,
  formatStorageDiagnostics,
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

  it("extrait la référence projet depuis l'URL (sans secret)", () => {
    expect(
      extractSupabaseProjectRef("https://abcdefghijklmnop.supabase.co"),
    ).toBe("abcdefghijklmnop");
    expect(
      extractSupabaseProjectRef("https://abcdefghijklmnop.supabase.co/"),
    ).toBe("abcdefghijklmnop");
    expect(extractSupabaseProjectRef("not-a-url")).toBeNull();
    expect(extractSupabaseProjectRef("")).toBeNull();
  });

  it("préfère SUPABASE_URL (serveur) à NEXT_PUBLIC_SUPABASE_URL", () => {
    const config = resolveStorageConfig({
      SUPABASE_URL: "https://serverproject.supabase.co",
      NEXT_PUBLIC_SUPABASE_URL: "https://publicproject.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    });
    expect(config.projectRef).toBe("serverproject");
    expect(config.urlSource).toBe("SUPABASE_URL");
    expect(config.bucket).toBe(ASTER_PRIVATE_DOCS_BUCKET);
    expect(formatStorageDiagnostics(config)).toContain("projet=serverproject");
    expect(formatStorageDiagnostics(config)).toContain(
      `bucket=${ASTER_PRIVATE_DOCS_BUCKET}`,
    );
    expect(formatStorageDiagnostics(config)).not.toMatch(/service-role|eyJ/);
  });

  it("retombe sur NEXT_PUBLIC_SUPABASE_URL si SUPABASE_URL absente", () => {
    const config = resolveStorageConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://publiconly.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    });
    expect(config.projectRef).toBe("publiconly");
    expect(config.urlSource).toBe("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("accepte SUPABASE_SECRET_KEY si SERVICE_ROLE absente", () => {
    const config = resolveStorageConfig({
      SUPABASE_URL: "https://serverproject.supabase.co",
      SUPABASE_SECRET_KEY: "new-secret-key",
    });
    expect(config.serviceKey).toBe("new-secret-key");
    expect(isSupabaseStorageConfigured({
      SUPABASE_URL: "https://serverproject.supabase.co",
      SUPABASE_SECRET_KEY: "new-secret-key",
    })).toBe(true);
  });

  it("autorise le mock en local sans clés Supabase", () => {
    const storage = createDocumentStorage({
      NODE_ENV: "development",
      VERCEL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SUPABASE_SECRET_KEY: undefined,
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
        SUPABASE_URL: undefined,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
      }),
    ).toThrow(/Stockage Supabase requis/i);

    expect(() =>
      createDocumentStorage({
        VERCEL: "1",
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: undefined,
        SUPABASE_URL: undefined,
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
