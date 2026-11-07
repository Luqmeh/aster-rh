/** Types métier RH — indépendants de la couche UI et de la persistence. */

export type DemoRole = "collaborateur" | "manager" | "admin_rh";

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
