/**
 * Vérifie le bucket privé aster-private-docs (nom, public=false).
 * Usage :
 *   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx scripts/verify-storage-bucket.ts
 *
 * Note : le service role contourne RLS. L'absence de policies anon/authenticated
 * sur un bucket privé est la configuration attendue pour ASTER (accès serveur uniquement).
 */
import { createClient } from "@supabase/supabase-js";
import { ASTER_PRIVATE_DOCS_BUCKET } from "../src/infrastructure/storage/supabase-storage";

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error(
      "Manque NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) {
    console.error("listBuckets failed:", error.message);
    process.exit(1);
  }

  const bucket = buckets?.find((b) => b.name === ASTER_PRIVATE_DOCS_BUCKET);
  if (!bucket) {
    console.error(
      `Bucket "${ASTER_PRIVATE_DOCS_BUCKET}" introuvable. Créez-le en privé dans Supabase Storage.`,
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
