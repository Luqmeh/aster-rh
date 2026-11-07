import type { PayrollPort } from "@/infrastructure/payroll/types";

/** Adaptateur mock — aucun système de paie n'est contacté. */
export const mockPayroll: PayrollPort = {
  async exportApprovedAbsences() {
    return [];
  },
};
