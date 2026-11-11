export interface StoredObjectMeta {
  key: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Port stockage documents — mock local ou Supabase Storage privé.
 */
export interface DocumentStoragePort {
  /** URL de téléchargement (signée / mock). Jamais une URL publique permanente pour les CV. */
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  putObject(
    key: string,
    data: Uint8Array,
    contentType: string,
  ): Promise<StoredObjectMeta>;
  /** Lecture privée optionnelle (reprise d'import / traitement serveur). */
  getObject?(key: string): Promise<Uint8Array | null>;
  deleteObject?(key: string): Promise<void>;
}
