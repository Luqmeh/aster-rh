import type { DocumentStoragePort } from "@/infrastructure/storage/types";

const memoryFiles = new Map<string, { data: Uint8Array; contentType: string }>();

/** Adaptateur mock — fichiers en mémoire, URLs non publiques. */
export const mockDocumentStorage: DocumentStoragePort = {
  async getDownloadUrl(key) {
    if (!memoryFiles.has(key) && !key.startsWith("demo/")) {
      // allow demo keys without bytes
    }
    return `#aster-private:${encodeURIComponent(key)}`;
  },

  async putObject(key, data, contentType) {
    memoryFiles.set(key, { data, contentType });
    return { key, contentType, sizeBytes: data.byteLength };
  },

  async getObject(key) {
    return memoryFiles.get(key)?.data ?? null;
  },

  async deleteObject(key) {
    memoryFiles.delete(key);
  },
};

export function getMockStoredObject(key: string) {
  return memoryFiles.get(key) ?? null;
}

export function resetMockStorageForTests() {
  memoryFiles.clear();
}
