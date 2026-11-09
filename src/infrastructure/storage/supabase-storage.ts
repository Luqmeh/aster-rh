import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";
import { mockDocumentStorage } from "@/infrastructure/storage/mock-storage";

/** Bucket privé Supabase — nom exact requis pour les CV recrutement. */
export const ASTER_PRIVATE_DOCS_BUCKET = "aster-private-docs";

/** Durée max des URL signées (secondes). */
export const MAX_SIGNED_URL_SECONDS = 120;

type EnvLike = Record<string, string | undefined>;

export type StorageConfig = {
  url: string;
  serviceKey: string;
  bucket: string;
  /** Quelle variable a fourni l'URL (jamais la valeur complète dans les logs). */
  urlSource: "SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_URL" | "none";
  /** Référence projet dérivée de l'hôte — pas un secret. */
  projectRef: string | null;
};

/**
 * Extrait la référence projet depuis une URL Supabase (hôte uniquement).
 * Ne journalise jamais la clé ni l'URL complète côté appelant si évitable.
 */
export function extractSupabaseProjectRef(
  url: string | undefined | null,
): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    const match = host.match(/^([a-z0-9-]+)\.supabase\.(co|in)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Config Storage serveur.
 * Préfère SUPABASE_URL (intégration / serveur) à NEXT_PUBLIC_… pour rester
 * aligné avec le même projet que Postgres, puis la clé service_role.
 */
export function resolveStorageConfig(env: EnvLike = process.env): StorageConfig {
  const serverUrl = env.SUPABASE_URL?.trim() || "";
  const publicUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const url = serverUrl || publicUrl;
  const urlSource: StorageConfig["urlSource"] = serverUrl
    ? "SUPABASE_URL"
    : publicUrl
      ? "NEXT_PUBLIC_SUPABASE_URL"
      : "none";

  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    env.SUPABASE_SECRET_KEY?.trim() ||
    "";
  const bucket =
    env.ASTER_STORAGE_BUCKET?.trim() || ASTER_PRIVATE_DOCS_BUCKET;

  return {
    url,
    serviceKey,
    bucket,
    urlSource,
    projectRef: extractSupabaseProjectRef(url),
  };
}

export function isSupabaseStorageConfigured(
  env: EnvLike = process.env,
): boolean {
  const { url, serviceKey } = resolveStorageConfig(env);
  return Boolean(url && serviceKey);
}

function isHostedRuntime(env: EnvLike): boolean {
  return env.VERCEL === "1" || env.NODE_ENV === "production";
}

function isOfflineBuild(env: EnvLike): boolean {
  return (
    env.ASTER_BUILD_WITHOUT_DB === "1" ||
    env.NEXT_PHASE === "phase-production-build"
  );
}

/** Contexte diagnostic sûr (pas de credentials). */
export function formatStorageDiagnostics(config: StorageConfig): string {
  const ref = config.projectRef ?? "inconnu";
  return `projet=${ref} bucket=${config.bucket} urlSource=${config.urlSource}`;
}

/**
 * En production / Vercel, le mock est interdit (sauf secours explicite ou build offline).
 */
export function assertProductionStorageReady(env: EnvLike = process.env): void {
  if (!isHostedRuntime(env) || isOfflineBuild(env)) return;
  if (env.ASTER_ALLOW_MOCK_STORAGE === "1") return;
  if (!isSupabaseStorageConfigured(env)) {
    throw new Error(
      "Stockage Supabase requis en production : définissez SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY (bucket privé aster-private-docs). Le fallback mock est interdit.",
    );
  }
  const config = resolveStorageConfig(env);
  if (config.bucket !== ASTER_PRIVATE_DOCS_BUCKET) {
    throw new Error(
      `ASTER_STORAGE_BUCKET doit être exactement "${ASTER_PRIVATE_DOCS_BUCKET}" (reçu : "${config.bucket}").`,
    );
  }
}

function createServiceClient(env: EnvLike): SupabaseClient | null {
  const { url, serviceKey } = resolveStorageConfig(env);
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function logStorageContext(config: StorageConfig, event: string): void {
  // Diagnostic sûr uniquement — jamais de clé ni d'URL complète.
  console.info(`[aster-storage] ${event} ${formatStorageDiagnostics(config)}`);
}

function enrichStorageError(
  config: StorageConfig,
  operation: string,
  message: string,
): Error {
  return new Error(
    `${operation} : ${message} (${formatStorageDiagnostics(config)})`,
  );
}

/**
 * Stockage privé via Supabase Storage (service role serveur uniquement).
 * Pas d'URL publique. En production : échec explicite si non configuré.
 */
export function createDocumentStorage(
  env: EnvLike = process.env,
): DocumentStoragePort {
  assertProductionStorageReady(env);

  const config = resolveStorageConfig(env);
  const client = createServiceClient(env);
  if (!client) {
    return mockDocumentStorage;
  }

  if (config.bucket !== ASTER_PRIVATE_DOCS_BUCKET && isHostedRuntime(env)) {
    throw new Error(
      `Bucket Storage invalide : attendu "${ASTER_PRIVATE_DOCS_BUCKET}".`,
    );
  }

  logStorageContext(config, "client_ready");

  let bucketVerified = false;

  async function assertBucketPresent(): Promise<void> {
    if (bucketVerified) return;
    const { data, error } = await client!.storage.listBuckets();
    if (error) {
      throw enrichStorageError(
        config,
        "Vérification bucket",
        error.message,
      );
    }
    const found = data?.find(
      (b) => b.id === config.bucket || b.name === config.bucket,
    );
    if (!found) {
      const visible =
        data && data.length > 0
          ? data.map((b) => b.name).join(", ")
          : "(aucun bucket visible avec cette clé)";
      throw enrichStorageError(
        config,
        "Échec upload stockage",
        `Bucket not found — le bucket "${config.bucket}" n'existe pas sur ce projet Supabase. Buckets visibles : ${visible}. Créez "${ASTER_PRIVATE_DOCS_BUCKET}" (privé) sur ce projet, ou alignez SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY sur le projet où le bucket existe.`,
      );
    }
    if (found.public) {
      throw enrichStorageError(
        config,
        "Configuration bucket",
        `Le bucket "${config.bucket}" est public — il doit rester privé.`,
      );
    }
    bucketVerified = true;
    logStorageContext(config, "bucket_verified_private");
  }

  return {
    async putObject(key, data, contentType) {
      await assertBucketPresent();
      const { error } = await client.storage.from(config.bucket).upload(key, data, {
        contentType,
        upsert: true,
      });
      if (error) {
        logStorageContext(config, `upload_failed key_prefix=${key.split("/")[0] ?? "?"}`);
        throw enrichStorageError(
          config,
          "Échec upload stockage",
          error.message,
        );
      }
      return { key, contentType, sizeBytes: data.byteLength };
    },

    async getDownloadUrl(key, expiresInSeconds = MAX_SIGNED_URL_SECONDS) {
      await assertBucketPresent();
      const ttl = Math.min(
        Math.max(1, expiresInSeconds ?? MAX_SIGNED_URL_SECONDS),
        MAX_SIGNED_URL_SECONDS,
      );
      const { data, error } = await client.storage
        .from(config.bucket)
        .createSignedUrl(key, ttl);
      if (error || !data?.signedUrl) {
        throw enrichStorageError(
          config,
          "Impossible de signer l'URL de téléchargement",
          error?.message ?? "inconnu",
        );
      }
      // Défense : jamais renvoyer une URL /object/public/
      if (data.signedUrl.includes("/object/public/")) {
        throw new Error(
          "URL publique détectée — refusée. Le bucket doit rester privé.",
        );
      }
      return data.signedUrl;
    },

    async deleteObject(key) {
      await assertBucketPresent();
      await client.storage.from(config.bucket).remove([key]);
    },
  };
}
