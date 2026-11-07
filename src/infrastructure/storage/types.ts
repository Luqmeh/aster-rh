export interface StoredObjectMeta {
  key: string;
  contentType: string;
  sizeBytes: number;
}

/**
 * Port stockage documents — remplaçable par SharePoint / Azure Blob / Supabase Storage.
 */
export interface DocumentStoragePort {
  getDownloadUrl(key: string): Promise<string>;
  putObject?(
    key: string,
    data: Uint8Array,
    contentType: string,
  ): Promise<StoredObjectMeta>;
}
