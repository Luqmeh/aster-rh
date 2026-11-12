import type { EmployeeCategory, StoredContractType } from "@/domain/types/hr";
import type { LeaveLedgerAccount } from "@/domain/types/leave-ledger";

export type EntitlementPolicyKind =
  | "conges_payes"
  | "rtt"
  | "recuperation_usage"
  | "special_leave"
  | "carryover_cp"
  | "expiry_rtt";

export type EntitlementValidationStatus =
  | "guide_documented"
  | "requires_hr_decision"
  | "hr_configured"
  | "draft";

export type AccrualBatchStatus = "preview" | "posted" | "cancelled";

export type CarryoverRequestStatus =
  | "brouillon"
  | "en_attente_validation"
  | "approuvee"
  | "refusee";

/** Statut d'un calcul d'acquisition / éligibilité (visible RH). */
export type CalculationStatus =
  | "calculated"
  | "requires_hr_validation"
  | "missing_employment_information"
  | "missing_policy_configuration"
  | "ineligible";

export type RoundingMode =
  | "none"
  | "end_of_period_example_ceil_half"
  | "hr_configured";

export type PolicyJurisdiction = "FR" | "MA" | "UNSET";

export type EntitlementPolicyVersion = {
  id: string;
  policyId: string;
  policyCode: string;
  kind: EntitlementPolicyKind;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  validationStatus: EntitlementValidationStatus;
  /** FR = historique guide France (désactivé pour le Maroc). */
  jurisdiction: PolicyJurisdiction;
  /** false = exclue du moteur preview/post Maroc. */
  isActive: boolean;
  sourceReference: string;
  notes: string | null;
  rules: EntitlementPolicyRules;
  createdByEmployeeId: string | null;
  createdAt: string;
};

export type EntitlementPolicyRules = {
  /** Population contractuelle éligible (null = non restreint dans la règle). */
  eligibleContractTypes: StoredContractType[] | null;
  /** Cadre / non-cadre (null = les deux). */
  eligibleCategories: EmployeeCategory[] | null;
  /** Période d'acquisition récurrente. */
  acquisitionPeriod: {
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
  };
  monthlyAccrualDays?: number;
  annualEntitlementDays?: number;
  /** Compte ledger crédité. */
  ledgerAccount: LeaveLedgerAccount;
  unit: "days";
  allowHalfDay: boolean;
  rounding: {
    mode: RoundingMode;
    /** Exemple guide 10,4 → 11 en fin de période — opt-in uniquement. */
    notes: string;
  };
  carryover?: {
    maxDays: number;
    cumulative: boolean;
    requiresApprovalAboveMax: boolean;
  };
  expiry?: {
    onMonth: number;
    onDay: number;
    noCarryover: boolean;
  };
  negativeBalance?: {
    maxNegativeDays: number;
    checkpoints: Array<{ month: number; day: number; label: string }>;
  };
  usageTargets?: Array<{
    byMonth: number;
    byDay: number;
    percentOfProjectedAnnual: number;
    label: string;
  }>;
  requiresOfficeCalendar?: boolean;
  partTimeRequiresHrValidation?: boolean;
};

export type OfficeWorkCalendar = {
  id: string;
  code: string;
  label: string;
  siteKey: string | null;
  /** ISO dates — jours fériés tombant un jour ouvré. */
  workingHolidays: string[];
  validationStatus: EntitlementValidationStatus;
  notes: string | null;
};

export type AccrualPreviewLine = {
  employeeId: string;
  account: LeaveLedgerAccount;
  policyVersionId: string | null;
  policyCode: string | null;
  periodKey: string;
  quantity: number;
  calculationStatus: CalculationStatus;
  explanation: string;
  warnings: string[];
  idempotencyKey: string;
};

export type AccrualBatch = {
  id: string;
  periodKey: string;
  label: string;
  status: AccrualBatchStatus;
  createdByEmployeeId: string | null;
  postedByEmployeeId: string | null;
  createdAt: string;
  postedAt: string | null;
  notes: string | null;
  lines: AccrualLine[];
};

export type AccrualLine = {
  id: string;
  batchId: string;
  employeeId: string;
  account: LeaveLedgerAccount;
  policyVersionId: string | null;
  policyCode: string | null;
  periodKey: string;
  quantity: number;
  calculationStatus: CalculationStatus;
  explanation: string;
  warnings: string[];
  idempotencyKey: string;
  ledgerEntryId: string | null;
  postedAt: string | null;
  createdAt: string;
};

export type CarryoverRequest = {
  id: string;
  employeeId: string;
  sourcePeriodKey: string;
  targetPeriodKey: string;
  requestedDays: number;
  status: CarryoverRequestStatus;
  exceptionReason: string | null;
  leavePlanThrough: string | null;
  partnerApprovedById: string | null;
  partnerApprovedAt: string | null;
  rrhForwardedAt: string | null;
  decidedByEmployeeId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  ledgerCarryoverEntryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeEntitlementEligibility = {
  employeeId: string;
  cpEligible: boolean;
  rttEligible: boolean;
  isCadre: boolean;
  isPartTime: boolean;
  isAlternant: boolean;
  calculationStatuses: CalculationStatus[];
  warnings: string[];
  applicablePolicies: EntitlementPolicyVersion[];
};
