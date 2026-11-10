import { describe, expect, it } from "vitest";
import {
  buildOpeningEntriesFromBalance,
  computeAccountBalance,
} from "@/domain/rules/leave-ledger-balance";
import type { LeaveLedgerEntry } from "@/domain/types/leave-ledger";
import type { LeaveRequest } from "@/domain/types/hr";

function entry(
  partial: Partial<LeaveLedgerEntry> &
    Pick<LeaveLedgerEntry, "id" | "quantity" | "transactionType">,
): LeaveLedgerEntry {
  return {
    employeeId: "emp-lea",
    account: "conges_payes",
    unit: "days",
    year: 2026,
    effectiveDate: "2026-01-01",
    createdAt: "2026-01-01T00:00:00.000Z",
    sourceKind: "test",
    sourceId: partial.id,
    reason: "test",
    actorEmployeeId: null,
    reversesEntryId: null,
    metadataJson: null,
    ...partial,
  };
}

function leave(
  partial: Partial<LeaveRequest> & Pick<LeaveRequest, "id" | "daysCount" | "status">,
): LeaveRequest {
  return {
    employeeId: "emp-lea",
    type: "conges_payes",
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    halfDayStart: false,
    halfDayEnd: false,
    comment: null,
    managerComment: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("leave-ledger-balance", () => {
  it("calcule acquis / consommé / ledger / réservations / projeté (exemple Phase 1)", () => {
    const entries = [
      entry({
        id: "o1",
        transactionType: "opening_balance",
        quantity: "25.0000",
        sourceId: "o1",
      }),
      entry({
        id: "o2",
        transactionType: "opening_balance",
        quantity: "-5.0000",
        sourceId: "o2",
      }),
    ];
    const current = leave({
      id: "cur",
      daysCount: 4,
      status: "en_attente_manager",
      startDate: "2026-09-01",
      endDate: "2026-09-04",
    });
    const others = [
      leave({
        id: "p1",
        daysCount: 3,
        status: "en_attente_manager",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
      }),
      leave({
        id: "rej",
        daysCount: 10,
        status: "refusee",
        startDate: "2026-05-01",
        endDate: "2026-05-10",
      }),
    ];

    const snap = computeAccountBalance({
      employeeId: "emp-lea",
      account: "conges_payes",
      year: 2026,
      entries,
      leaveRequests: [current, ...others],
      currentRequest: current,
    });

    expect(snap.totalCredited).toBe(25);
    expect(snap.totalConsumed).toBe(5);
    expect(snap.ledgerBalance).toBe(20);
    expect(snap.otherPendingReservations).toBe(3);
    expect(snap.availableAfterReservations).toBe(17);
    expect(snap.currentRequestDays).toBe(4);
    expect(snap.projectedAfterCurrentRequest).toBe(13);
  });

  it("ne mélange pas CP et RTT", () => {
    const entries = [
      entry({
        id: "cp",
        account: "conges_payes",
        transactionType: "opening_balance",
        quantity: "10.0000",
        sourceId: "cp",
      }),
      entry({
        id: "rtt",
        account: "rtt",
        transactionType: "opening_balance",
        quantity: "4.0000",
        sourceId: "rtt",
      }),
    ];
    const cp = computeAccountBalance({
      employeeId: "emp-lea",
      account: "conges_payes",
      year: 2026,
      entries,
      leaveRequests: [],
    });
    expect(cp.ledgerBalance).toBe(10);
  });

  it("construit des ouvertures sans inventer d'historique", () => {
    const drafts = buildOpeningEntriesFromBalance({
      employeeId: "emp-lea",
      year: 2026,
      account: "rtt",
      acquis: 10,
      pris: 3,
      restants: 7,
      effectiveDate: "2026-01-01",
    });
    expect(drafts).toHaveLength(2);
    expect(drafts[0].quantity).toBe(10);
    expect(drafts[1].quantity).toBe(-3);
    expect(drafts.every((d) => d.transactionType === "opening_balance")).toBe(
      true,
    );
  });
});
