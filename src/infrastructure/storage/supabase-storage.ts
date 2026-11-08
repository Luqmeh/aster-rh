import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";
import { mockDocumentStorage } from "@/infrastructure/storage/mock-storage";

/** Bucket privé Supabase — nom exact requis pour les CV recrutement. */
export const ASTER_PRIVATE_DOCS_BUCKET = "aster-private-docs";

/** Durée max des URL signées (secondes). */
export const MAX_SIGNED_URL_SECONDS = 120;

type EnvLike = Record<string, string | undefined>;

export function resolveStorageConfig(env: EnvLike = process.env) {
  const url =
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim() || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const bucket =
    env.ASTER_STORAGE_BUCKET?.trim() || ASTER_PRIVATE_DOCS_BUCKET;
  return { url, serviceKey, bucket };
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

/**
 * En production / Vercel, le mock est interdit (sauf secours explicite ou build offline).
 */
export function assertProductionStorageReady(env: EnvLike = process.env): void {
  if (!isHostedRuntime(env) || isOfflineBuild(env)) return;
  if (env.ASTER_ALLOW_MOCK_STORAGE === "1") return;
  if (!isSupabaseStorageConfigured(env)) {
    throw new Error(
      "Stockage Supabase requis en production : définissez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (bucket privé aster-private-docs). Le fallback mock est interdit.",
    );
  }
  const { bucket } = resolveStorageConfig(env);
  if (bucket !== ASTER_PRIVATE_DOCS_BUCKET) {
    throw new Error(
      `ASTER_STORAGE_BUCKET doit être exactement "${ASTER_PRIVATE_DOCS_BUCKET}" (reçu : "${bucket}").`,
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

/**
 * Stockage privé via Supabase Storage (service role serveur uniquement).
 * Pas d'URL publique. En production : échec explicite si non configuré.
 */
export function createDocumentStorage(
  env: EnvLike = process.env,
): DocumentStoragePort {
  assertProductionStorageReady(env);

  const client = createServiceClient(env);
  if (!client) {
    return mockDocumentStorage;
  }

  const { bucket } = resolveStorageConfig(env);
  if (bucket !== ASTER_PRIVATE_DOCS_BUCKET && isHostedRuntime(env)) {
    throw new Error(
      `Bucket Storage invalide : attendu "${ASTER_PRIVATE_DOCS_BUCKET}".`,
    );
  }

  return {
    async putObject(key, data, contentType) {
      const { error } = await client.storage.from(bucket).upload(key, data, {
        contentType,
        upsert: true,
      });
      if (error) {
        throw new Error(`Échec upload stockage : ${error.message}`);
      }
      return { key, contentType, sizeBytes: data.byteLength };
    },

    async getDownloadUrl(key, expiresInSeconds = MAX_SIGNED_URL_SECONDS) {
      const ttl = Math.min(
        Math.max(1, expiresInSeconds ?? MAX_SIGNED_URL_SECONDS),
        MAX_SIGNED_URL_SECONDS,
      );
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(key, ttl);
      if (error || !data?.signedUrl) {
        throw new Error(
          `Impossible de signer l'URL de téléchargement : ${error?.message ?? "inconnu"}`,
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
      await client.storage.from(bucket).remove([key]);
    },
  };
}
