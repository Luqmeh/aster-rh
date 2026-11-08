import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";
import { mockDocumentStorage } from "@/infrastructure/storage/mock-storage";

const DEFAULT_BUCKET = "aster-private-docs";

function resolveConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const bucket =
    process.env.ASTER_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
  return { url, serviceKey, bucket };
}

function createServiceClient(): SupabaseClient | null {
  const { url, serviceKey } = resolveConfig();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Stockage privé via Supabase Storage (service role serveur uniquement).
 * Si les variables ne sont pas configurées, bascule sur le mock mémoire.
 */
export function createDocumentStorage(): DocumentStoragePort {
  const client = createServiceClient();
  if (!client) return mockDocumentStorage;

  const { bucket } = resolveConfig();

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

    async getDownloadUrl(key, expiresInSeconds = 120) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(key, expiresInSeconds);
      if (error || !data?.signedUrl) {
        throw new Error(
          `Impossible de signer l'URL de téléchargement : ${error?.message ?? "inconnu"}`,
        );
      }
      return data.signedUrl;
    },

    async deleteObject(key) {
      await client.storage.from(bucket).remove([key]);
    },
  };
}

export function isSupabaseStorageConfigured(): boolean {
  const { url, serviceKey } = resolveConfig();
  return Boolean(url && serviceKey);
}
