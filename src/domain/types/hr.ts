/** Types métier RH — indépendants de la couche UI et de la persistence. */

/** Rôles applicatifs définitifs ASTER (ne pas réintroduire un Manager inférieur). */
export type DemoRole = "collaborateur" | "chef_de_projet" | "admin_rh";

export type ContractType = "cdi" | "cdd" | "alternance" | "stage";

/** @deprecated Remplacé par EmployeeGrade — ne plus utiliser. */
export type EmployeeCategory = "cadre" | "non_cadre" | "non_applicable";

import type {
  EmployeeGrade,
  PeopleManagerEntry,
} from "@/domain/types/employee-structure";
export type { EmployeeGrade, PeopleManagerEntry };
export {
  EMPLOYEE_GRADE_LABELS,
  EMPLOYEE_GRADE_OPTIONS,
  EMPLOYEE_GRADE_VALUES,
  employeeGradeLabel,
  employeeGradeSchema,
  parseEmployeeGrade,
  parseRegion,
  regionSchema,
} from "@/domain/types/employee-structure";

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
  | "recuperation"
  | "sans_solde"
  | "maladie"
  | "exceptionnel"
  | "parental";

export type WorkOnHolidayStatus =
  | "en_attente"
  | "approuvee"
  | "refusee"
  | "travail_effectue_a_confirmer"
  | "confirmee_credit_appliquee";

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
  /** People Manager catalogue (affectation organisationnelle — pas d'autorité d'approbation). */
  peopleManagerId: string | null;
  /** @deprecated Conservé pour compat tests historiques d'équipe ; préférer peopleManagerId. */
  managerId: string | null;
  /** Région (saisie libre). */
  region: string;
  contractType: ContractType;
  /** Classification organisationnelle — ne pilote ni soldes ni permissions. */
  grade: EmployeeGrade;
  hireDate: string;
  employmentStatus: EmploymentStatus;
  departureDate: string | null;
  departureNote: string | null;
  /** Dérivé de employmentStatus === actif — utilisé pour l'accès applicatif. */
  isActive: boolean;
  phoneInternal: string | null;
  avatarInitials: string;
  /**
   * Éligibilité télétravail (politique produit paramétrable).
   * false = restriction clairement affichée en démo.
   */
  teleworkEligible: boolean;
  /**
   * Capacité hebdomadaire indicative du profil (démo).
   * Capacité hebdomadaire indicative ; plafond produit planification : 2 j/semaine.
   */
  teleworkDaysPerWeek: number;
  /**
   * Heures journalières de référence pour convertir les crédits de récupération.
   * HYPOTHÈSE DÉMO (défaut 7) — ne pas présenter comme règle guide.
   */
  standardDailyHours: number;
  /** Temps partiel — sans barème validé → calcul CP « requires_hr_validation ». */
  isPartTime: boolean;
  /** Heures hebdomadaires contractuelles (null = non renseigné). */
  weeklyContractHours: number | null;
  /** % d'activité — ne pas multiplier silencieusement les CP. */
  workingTimePercent: number | null;
  /** Calendrier de bureau (config employeur). */
  officeCalendarId: string | null;
  /**
   * Groupe de politique RH Maroc (indépendant du titre).
   * null = non renseigné → calculs d’acquisition non auto-postés.
   */
  policyGroup: string | null;
  /** Date de naissance ISO — art. 231 (moins de 18 ans). */
  birthDate: string | null;
  /** Art. 238-2 : non_agricole (191 h) | agricole (208 h). */
  activitySector: "non_agricole" | "agricole";
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
  /** Récupération jours fériés travaillés (jours fractionnaires) — distincte des RTT annuels. */
  recoveryDaysAcquis: number;
  recoveryDaysPris: number;
  recoveryDaysRestants: number;
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

export interface HolidayOverride {
  id: string;
  sourceKey: string;
  date: string;
  nameFr: string;
  kind: "national" | "religious" | "company";
  confirmation: "confirmed" | "provisional";
  isActive: boolean;
  year: number;
  createdByEmployeeId: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface WorkOnHolidayRequest {
  id: string;
  employeeId: string;
  holidayDate: string;
  holidaySourceKey: string;
  holidayName: string;
  plannedHours: number;
  plannedStart: string | null;
  plannedEnd: string | null;
  reason: string;
  status: WorkOnHolidayStatus;
  decidedByEmployeeId: string | null;
  decisionComment: string | null;
  decidedAt: string | null;
  actualHours: number | null;
  actualDeclaredAt: string | null;
  confirmedHours: number | null;
  confirmedByEmployeeId: string | null;
  confirmedAt: string | null;
  creditLedgerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryCreditLedgerEntry {
  id: string;
  employeeId: string;
  year: number;
  sourceKind: "work_on_holiday";
  sourceRequestId: string;
  hoursConfirmed: number;
  daysCredited: number;
  dailyHoursUsed: number;
  actorEmployeeId: string;
  createdAt: string;
}

/** Famille d'absence administrative (hors CP/RTT LeaveRequest). */
export type AbsenceFamily = "arret" | "conge_special";

export type WorkAbsenceCategory =
  | "arret_maladie"
  | "accident_travail"
  | "accident_trajet"
  | "maladie_professionnelle"
  | "conge_maternite"
  | "conge_paternite"
  | "conge_pathologique"
  | "prolongation_arret"
  | "rechute"
  | "mariage_pacs"
  | "naissance_adoption"
  | "deces_proche"
  | "demenagement"
  | "hospitalisation_enfant"
  | "annonce_handicap_ald"
  | "rdv_medicaux_handicap"
  | "preparation_examen_alternant";

export type WorkAbsenceStatus =
  | "declare"
  | "en_attente_justificatif"
  | "en_cours_verification"
  | "informations_demandees"
  | "enregistre"
  | "termine"
  | "refuse";

export type AbsenceDocumentKind =
  | "certificat_initial"
  | "certificat_prolongation"
  | "bulletin_hospitalisation"
  | "dossier_at_mp"
  | "calendrier_maternite"
  | "notification_paternite"
  | "justificatif_special"
  | "autre";

export type ReturnVisitStatus =
  | "non_applicable"
  | "a_planifier"
  | "planifiee"
  | "realisee"
  | "non_requise";

export interface WorkAbsenceDocument {
  id: string;
  absenceId: string;
  kind: AbsenceDocumentKind;
  fileName: string;
  contentType: string;
  storageKey: string;
  uploadedByEmployeeId: string;
  receivedByHrAt: string | null;
  createdAt: string;
}

export interface WorkAbsenceEvent {
  id: string;
  absenceId: string;
  kind: string;
  message: string;
  actorId: string | null;
  createdAt: string;
}

export interface WorkAbsence {
  id: string;
  employeeId: string;
  family: AbsenceFamily;
  category: WorkAbsenceCategory;
  status: WorkAbsenceStatus;
  startDate: string;
  endDate: string;
  daysCount: number;
  employeeComment: string | null;
  hrInternalNote: string | null;
  hrMessage: string | null;
  rejectionReason: string | null;
  parentAbsenceId: string | null;
  recurrenceOfId: string | null;
  dateGapFlag: boolean;
  recurrenceWithin3MonthsFlag: boolean;
  requiresHrReview: boolean;
  hospitalAdmissionDate: string | null;
  hospitalDischargeDate: string | null;
  documentsReceived: boolean;
  firstDocumentReceivedAt: string | null;
  payrollProcessingMonth: string | null;
  expectedReturnDate: string | null;
  actualReturnDate: string | null;
  returnVisitRequired: boolean;
  returnVisitStatus: ReturnVisitStatus;
  returnVisitPlannedDate: string | null;
  returnVisitDeadline: string | null;
  processedByEmployeeId: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
