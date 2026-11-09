/** Types métier RH — indépendants de la couche UI et de la persistence. */

/** Rôles applicatifs définitifs ASTER (ne pas réintroduire un Manager inférieur). */
export type DemoRole = "collaborateur" | "chef_de_projet" | "admin_rh";

export type ContractType = "cdi" | "cdd" | "alternance" | "stage";

export type EmployeeCategory = "cadre" | "non_cadre";

export type RequestStatus =
  | "brouillon"
  | "soumise"
  | "en_attente_manager"
  | "en_attente_rh"
  | "approuvee"
  | "refusee"
  | "annulee";

export type LeaveType =
  | "conges_payes"
  | "rtt"
  | "sans_solde"
  | "maladie"
  | "exceptionnel"
  | "parental";

export type TeleworkType = "regulier" | "occasionnel" | "exceptionnel";

export type EmploymentStatus = "actif" | "inactif" | "parti";

export type RecruitmentStatus =
  | "brouillon"
  | "soumis_revue"
  | "refuse"
  | "approuve"
  | "intervieweur_assigne"
  | "entretien_planifie"
  | "entretien_termine";

/** Catalogue de demandes documentaires collaborateur (ASTER) — hors inventaire exhaustif du guide. */
export type DocumentRequestType =
  | "attestation_travail"
  | "attestation_employeur"
  | "attestation_remuneration"
  | "copie_contrat"
  | "copie_avenant"
  | "attestation_formation"
  | "attestation_cncc"
  | "certificat_travail"
  | "attestation_france_travail"
  | "recu_solde_tout_compte"
  | "autre";

export type DocumentRequestStatus =
  | "en_attente"
  | "en_traitement"
  | "informations_demandees"
  | "document_disponible"
  | "refusee";

export interface OrganizationUnit {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
}

export interface Employee {
  id: string;
  /** Identifiant de démonstration — ne pas confondre avec un compte Entra ID. */
  demoIdentityId: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  departmentId: string;
  managerId: string | null;
  site: string;
  contractType: ContractType;
  category: EmployeeCategory;
  hireDate: string;
  employmentStatus: EmploymentStatus;
  departureDate: string | null;
  departureNote: string | null;
  /** Dérivé de employmentStatus === actif — utilisé pour l'accès applicatif. */
  isActive: boolean;
  phoneInternal: string | null;
  avatarInitials: string;
  /**
   * Éligibilité télétravail (guide RH p.106 : tâches compatibles + continuité de service).
   * false = restriction clairement affichée en démo.
   */
  teleworkEligible: boolean;
  /**
   * Capacité hebdomadaire indicative du profil (démo).
   * Le plafond planification mensuelle reste 2 j/semaine (p.106 / règle produit).
   */
  teleworkDaysPerWeek: number;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  congesPayesAcquis: number;
  congesPayesPris: number;
  congesPayesRestants: number;
  rttAcquis: number;
  rttPris: number;
  rttRestants: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDayStart: boolean;
  halfDayEnd: boolean;
  daysCount: number;
  status: RequestStatus;
  comment: string | null;
  managerComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeleworkRequest {
  id: string;
  employeeId: string;
  type: TeleworkType;
  /** Mois planifié (yyyy-mm) pour les plans mensuels ; null pour l'historique ponctuel. */
  month: string | null;
  startDate: string;
  endDate: string;
  days: string[];
  status: RequestStatus;
  reason: string | null;
  managerComment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export interface HrDocument {
  id: string;
  employeeId: string | null;
  title: string;
  category: string;
  uploadedAt: string;
  /** Chemin mock — pas de stockage réel. */
  storageKey: string;
  isCompanyWide: boolean;
}

export interface DemoIdentity {
  id: string;
  label: string;
  role: DemoRole;
  employeeId: string;
  description: string;
}

export interface ApprovalAction {
  requestId: string;
  requestKind: "leave" | "telework";
  decision: "approuvee" | "refusee";
  comment?: string;
  actorEmployeeId: string;
}

export interface RoleChangeAuditEntry {
  id: string;
  targetAccountId: string;
  previousRole: DemoRole;
  newRole: DemoRole;
  actorEmployeeId: string;
  createdAt: string;
}

export interface RecruitmentCandidate {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  positionTitle: string;
  departmentId: string | null;
  cvStorageKey: string | null;
  cvFileName: string | null;
  cvContentType: string | null;
  hrNotes: string | null;
  status: RecruitmentStatus;
  submittedAt: string | null;
  createdByEmployeeId: string;
  decidedByEmployeeId: string | null;
  decisionComment: string | null;
  decidedAt: string | null;
  interviewerEmployeeId: string | null;
  assignedByEmployeeId: string | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentEvent {
  id: string;
  candidateId: string;
  kind: string;
  message: string;
  actorId: string | null;
  createdAt: string;
}

export interface DocumentRequest {
  id: string;
  employeeId: string;
  documentType: DocumentRequestType;
  /** Libellé libre si documentType = autre. */
  customLabel: string | null;
  reason: string;
  status: DocumentRequestStatus;
  /** Message RH visible par le collaborateur (clarification / refus). */
  hrMessage: string | null;
  /** Note interne RH — jamais exposée au collaborateur. */
  hrInternalNote: string | null;
  storageKey: string | null;
  fileName: string | null;
  contentType: string | null;
  /** true uniquement après action explicite « Mettre à disposition ». */
  published: boolean;
  publishedAt: string | null;
  processedByEmployeeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRequestEvent {
  id: string;
  requestId: string;
  kind: string;
  message: string;
  actorId: string | null;
  createdAt: string;
}
