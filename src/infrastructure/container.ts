import { sessionAuth } from "@/infrastructure/auth/session-auth";
import type { AuthPort } from "@/infrastructure/auth/types";
import { mockEmail } from "@/infrastructure/email/mock-email";
import type { EmailPort } from "@/infrastructure/email/types";
import { mockPayroll } from "@/infrastructure/payroll/mock-payroll";
import type { PayrollPort } from "@/infrastructure/payroll/types";
import { demoHrRepository } from "@/infrastructure/persistence/demo-hr-repository";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import {
  resolvePersistenceMode,
  type PersistenceMode,
} from "@/infrastructure/persistence/persistence-mode";
import { prismaHrRepository } from "@/infrastructure/persistence/prisma-hr-repository";
import { createDocumentStorage } from "@/infrastructure/storage/supabase-storage";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";

/**
 * Composition root — branche les adaptateurs (auth Auth.js, HR mémoire ou Prisma).
 * Le stockage est résolu à la demande : une config Storage manquante ne doit pas
 * faire échouer le rendu de tout le layout (React #441), seulement les opérations CV.
 */
export interface AppContainer {
  auth: AuthPort;
  hr: HrRepository;
  email: EmailPort;
  storage: DocumentStoragePort;
  payroll: PayrollPort;
  persistence: PersistenceMode;
}

export function getContainer(): AppContainer {
  const persistence = resolvePersistenceMode();
  const hr =
    persistence === "prisma" ? prismaHrRepository : demoHrRepository;

  let storage: DocumentStoragePort | undefined;

  return {
    auth: sessionAuth,
    hr,
    email: mockEmail,
    get storage() {
      if (!storage) {
        storage = createDocumentStorage();
      }
      return storage;
    },
    payroll: mockPayroll,
    persistence,
  };
}
