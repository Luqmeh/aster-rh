-- ASTER — bucket CV recrutement (à exécuter dans le SQL Editor Supabase si besoin).
-- Objectif : bucket PRIVÉ, sans accès anon/authenticated. L'app utilise le service_role.

-- 1) Créer le bucket s'il n'existe pas (idempotent via insert conditionnel).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aster-private-docs',
  'aster-private-docs',
  false,
  5242880,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Retirer toute policy éventuelle trop permissive sur ce bucket.
DROP POLICY IF EXISTS "Public read aster-private-docs" ON storage.objects;
DROP POLICY IF EXISTS "Public upload aster-private-docs" ON storage.objects;
DROP POLICY IF EXISTS "Anon read aster-private-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read aster-private-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload aster-private-docs" ON storage.objects;

-- 3) Ne PAS ajouter de policy pour anon / authenticated.
-- Sans policy : accès refusé via clé anon ; le service_role (serveur ASTER) contourne RLS.
-- Vérification manuelle :
--   select id, name, public from storage.buckets where id = 'aster-private-docs';
--   select policyname, roles, cmd from pg_policies
--     where tablename = 'objects' and schemaname = 'storage';
