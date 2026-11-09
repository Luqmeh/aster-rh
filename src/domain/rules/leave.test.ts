import { describe, expect, it } from "vitest";
import {
  assertSufficientBalance,
  countBusinessDays,
  defaultAnnualEntitlement,
  leaveRequestInputSchema,
  usesLeaveBalance,
} from "@/domain/rules/leave";
import type { LeaveBalance } from "@/domain/types/hr";

const balance: LeaveBalance = {
  employeeId: "emp-x",
  year: 2026,
  congesPayesAcquis: 25,
  congesPayesPris: 10,
  congesPayesRestants: 15,
  rttAcquis: 10,
  rttPris: 2,
  rttRestants: 8,
  recoveryDaysAcquis: 0,
  recoveryDaysPris: 0,
  recoveryDaysRestants: 0,
};

describe("countBusinessDays", () => {
  it("compte les jours ouvrés sur une semaine complète", () => {
    expect(countBusinessDays("2026-11-09", "2026-11-13", false, false)).toBe(5);
  });

  it("ignore le week-end", () => {
    expect(countBusinessDays("2026-11-07", "2026-11-08", false, false)).toBe(0);
  });

  it("gère une demi-journée sur un seul jour", () => {
    expect(countBusinessDays("2026-11-10", "2026-11-10", true, false)).toBe(0.5);
  });
});

describe("soldes et catégories", () => {
  it("distingue cadre et non-cadre pour les RTT de démo", () => {
    expect(defaultAnnualEntitlement("cadre").rtt).toBe(10);
    expect(defaultAnnualEntitlement("non_cadre").rtt).toBe(8);
  });

  it("bloque un dépassement de solde CP", () => {
    const result = assertSufficientBalance(balance, "conges_payes", 20);
    expect(result.ok).toBe(false);
  });

  it("autorise la maladie sans consommer le solde", () => {
    expect(usesLeaveBalance("maladie")).toBe(false);
    expect(assertSufficientBalance(balance, "maladie", 30).ok).toBe(true);
  });
});

describe("leaveRequestInputSchema", () => {
  it("rejette une fin avant le début", () => {
    const parsed = leaveRequestInputSchema.safeParse({
      type: "rtt",
      startDate: "2026-11-12",
      endDate: "2026-11-10",
      halfDayStart: false,
      halfDayEnd: false,
    });
    expect(parsed.success).toBe(false);
  });
});
