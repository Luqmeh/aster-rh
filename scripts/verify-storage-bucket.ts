/**
 * Vérifie le bucket privé aster-private-docs (nom, public=false).
 * Usage :
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/verify-storage-bucket.ts
 *
 * Note : le service role contourne RLS. L'absence de policies anon/authenticated
 * sur un bucket privé est la configuration attendue pour ASTER (accès serveur uniquement).
 */
import { createClient } from "@supabase/supabase-js";
import {
  ASTER_PRIVATE_DOCS_BUCKET,
  formatStorageDiagnostics,
  resolveStorageConfig,
} from "../src/infrastructure/storage/supabase-storage";

async function main() {
  const config = resolveStorageConfig(process.env);
  if (!config.url || !config.serviceKey) {
    console.error(
      "Manque SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  console.log(`Diagnostic: ${formatStorageDiagnostics(config)}`);

  const client = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) {
    console.error("listBuckets failed:", error.message);
    process.exit(1);
  }

  console.log(
    `Buckets visibles: ${
      buckets && buckets.length > 0
        ? buckets.map((b) => `${b.name}(public=${b.public})`).join(", ")
        : "(aucun)"
    }`,
  );

  const bucket = buckets?.find(
    (b) =>
      b.name === ASTER_PRIVATE_DOCS_BUCKET || b.id === ASTER_PRIVATE_DOCS_BUCKET,
  );
  if (!bucket) {
    console.error(
      `Bucket "${ASTER_PRIVATE_DOCS_BUCKET}" introuvable sur projet=${config.projectRef ?? "inconnu"}. Créez-le en privé dans CE projet Supabase Storage, ou alignez les variables Vercel sur le bon projet.`,
    );
    process.exit(1);
  }

  console.log(`Bucket: ${bucket.name}`);
  console.log(`public: ${bucket.public}`);
  if (bucket.public) {
    console.error(
      "ERREUR : le bucket est public. Passez-le en privé (public = false).",
    );
    process.exit(1);
  }

  console.log(
    "OK — bucket privé trouvé. Les CV doivent être lus uniquement via createSignedUrl côté serveur après autorisation ASTER.",
  );
  console.log(
    "RLS : ne créez PAS de policy SELECT/INSERT pour anon ou authenticated sur ce bucket. Service role uniquement.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
