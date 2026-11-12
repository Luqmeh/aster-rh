import type {
  DocumentRequestStatus,
  DocumentRequestType,
  Employee,
  EmploymentStatus,
} from "@/domain/types/hr";

/** Catalogue initial — types proposés ASTER (hors catalogue exhaustif du guide). */
export const DOCUMENT_REQUEST_TYPES: DocumentRequestType[] = [
  "attestation_travail",
  "attestation_employeur",
  "attestation_remuneration",
  "copie_contrat",
  "copie_avenant",
  "attestation_formation",
  "attestation_cncc",
  "certificat_travail",
  "attestation_france_travail",
  "recu_solde_tout_compte",
  "autre",
];

const DEPARTURE_ONLY_TYPES: ReadonlySet<DocumentRequestType> = new Set([
  "certificat_travail",
  "attestation_france_travail",
  "recu_solde_tout_compte",
]);

/** Statuts ouverts — une seule demande ouverte du même type par collaborateur. */
export const OPEN_DOCUMENT_REQUEST_STATUSES: ReadonlySet<DocumentRequestStatus> =
  new Set(["en_attente", "en_traitement", "informations_demandees"]);

export const MAX_DOCUMENT_REQUEST_BYTES = 5 * 1024 * 1024;

export const ALLOWED_DOCUMENT_REQUEST_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
] as const;

export function documentRequestTypeLabel(type: DocumentRequestType): string {
  const labels: Record<DocumentRequestType, string> = {
    attestation_travail: "Attestation de travail",
    attestation_employeur: "Attestation employeur",
    attestation_remuneration: "Attestation de rémunération / salaire",
    copie_contrat: "Copie du contrat de travail",
    copie_avenant: "Copie d'un avenant au contrat",
    attestation_formation: "Attestation de formation",
    attestation_cncc: "Attestation annuelle CNCC",
    certificat_travail: "Certificat de travail",
    attestation_france_travail: "Attestation France Travail",
    recu_solde_tout_compte: "Reçu pour solde de tout compte",
    autre: "Autre document (revue RH)",
  };
  return labels[type];
}

export function documentRequestStatusLabel(
  status: DocumentRequestStatus,
): string {
  const labels: Record<DocumentRequestStatus, string> = {
    en_attente: "En attente",
    en_traitement: "En traitement",
    informations_demandees: "Informations demandées",
    document_disponible: "Document disponible",
    refusee: "Refusée",
  };
  return labels[status];
}

export function isDepartureOnlyDocumentType(type: DocumentRequestType): boolean {
  return DEPARTURE_ONLY_TYPES.has(type);
}

/**
 * Documents liés au départ — proposés uniquement si le cycle de vie le justifie.
 * HYPOTHÈSE DÉMO : statut `parti` ou `inactif` avec date de départ.
 */
export function isDepartureDocumentEligible(
  employmentStatus: EmploymentStatus,
  departureDate: string | null | undefined,
): boolean {
  if (employmentStatus === "parti") return true;
  if (employmentStatus === "inactif" && departureDate) return true;
  return false;
}

/**
 * Attestation CNCC — guide p.81 (professionnels CAC éligibles).
 * HYPOTHÈSE DÉMO : grade Manager (le Poste a été retiré des fiches).
 * Ne pas généraliser sans confirmation guide / RH.
 */
export function isCnccAttestationEligible(employee: Employee): boolean {
  return employee.grade === "manager";
}

export function isDocumentTypeOfferedToEmployee(
  type: DocumentRequestType,
  employee: Employee,
): boolean {
  if (type === "attestation_cncc") {
    return isCnccAttestationEligible(employee);
  }
  if (isDepartureOnlyDocumentType(type)) {
    return isDepartureDocumentEligible(
      employee.employmentStatus,
      employee.departureDate,
    );
  }
  return true;
}

export function listOfferedDocumentTypes(
  employee: Employee,
): DocumentRequestType[] {
  return DOCUMENT_REQUEST_TYPES.filter((type) =>
    isDocumentTypeOfferedToEmployee(type, employee),
  );
}

export function canEmployeeAccessOwnDocuments(
  employee: Employee,
): boolean {
  // Accès libre-service révoqué si compte inactif / parti (HR conserve le traitement).
  return employee.isActive && employee.employmentStatus === "actif";
}

export function employeeDocumentStoragePrefix(
  employeeId: string,
  requestId: string,
): string {
  return `employee-documents/${employeeId}/${requestId}/`;
}

export function buildEmployeeDocumentStorageKey(
  employeeId: string,
  requestId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${employeeDocumentStoragePrefix(employeeId, requestId)}${Date.now()}-${safeName}`;
}

export function assertDocumentStorageKeyOwnsRequest(
  storageKey: string,
  employeeId: string,
  requestId: string,
): { ok: true } | { ok: false; message: string } {
  const prefix = employeeDocumentStoragePrefix(employeeId, requestId);
  if (!storageKey.startsWith(prefix)) {
    return {
      ok: false,
      message:
        "Clé de stockage incohérente avec la demande — accès refusé.",
    };
  }
  if (
    storageKey.includes("..") ||
    storageKey.includes("//") ||
    storageKey.startsWith("recruitment/")
  ) {
    return { ok: false, message: "Chemin de stockage document invalide." };
  }
  return { ok: true };
}

export function assertDocumentUploadFile(input: {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): { ok: true } | { ok: false; message: string } {
  const lower = input.fileName.toLowerCase();
  if (
    !(
      lower.endsWith(".pdf") ||
      lower.endsWith(".doc") ||
      lower.endsWith(".docx") ||
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg")
    )
  ) {
    return {
      ok: false,
      message: "Formats acceptés : PDF, DOC, DOCX, PNG, JPG.",
    };
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_DOCUMENT_REQUEST_BYTES) {
    return {
      ok: false,
      message: "La taille du fichier doit être comprise entre 1 octet et 5 Mo.",
    };
  }
  if (/\.(exe|sh|bat|js|mjs|dll|bin)$/i.test(lower)) {
    return { ok: false, message: "Fichier exécutable refusé." };
  }
  return { ok: true };
}

export function canTransitionDocumentRequest(
  from: DocumentRequestStatus,
  to: DocumentRequestStatus,
): boolean {
  const allowed: Record<DocumentRequestStatus, DocumentRequestStatus[]> = {
    en_attente: ["en_traitement", "informations_demandees", "refusee"],
    en_traitement: [
      "informations_demandees",
      "document_disponible",
      "refusee",
      "en_traitement",
    ],
    informations_demandees: [
      "en_traitement",
      "document_disponible",
      "refusee",
      "informations_demandees",
    ],
    document_disponible: [],
    refusee: [],
  };
  return allowed[from]?.includes(to) ?? false;
}
