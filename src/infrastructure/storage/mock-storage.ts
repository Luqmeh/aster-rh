import type { DocumentStoragePort } from "@/infrastructure/storage/types";

/** Adaptateur mock — pas de fichiers réels. */
export const mockDocumentStorage: DocumentStoragePort = {
  async getDownloadUrl(key) {
    return `#demo-document:${encodeURIComponent(key)}`;
  },
};
