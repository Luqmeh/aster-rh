/**
 * Port paie — non branché.
 * L'équipe autorisée implémentera l'adaptateur vers le système de paie
 * sans modifier les modules UI.
 */
export interface PayrollExportLine {
  employeeExternalId: string;
  leaveType: string;
  days: number;
  periodStart: string;
  periodEnd: string;
}

export interface PayrollPort {
  /** Prépare un export des absences validées pour une période. */
  exportApprovedAbsences(
    periodStart: string,
    periodEnd: string,
  ): Promise<PayrollExportLine[]>;
}
