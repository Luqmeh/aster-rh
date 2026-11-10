import { describe, expect, it } from "vitest";
import {
  buildLeaveBalanceContext,
  buildLeaveHistoryEntries,
  isLeavePendingStatus,
  isLeaveTakenStatus,
  selectLastTakenLeave,
  sumLeaveDays,
  sumSpecialLeaveDaysUsedThisYear,
} from "@/domain/rules/leave-approval-context";
import type {
  LeaveBalance,
  LeaveRequest,
  WorkAbsence,
} from "@/domain/types/hr";

function leave(
  partial: Partial<LeaveRequest> &
    Pick<LeaveRequest, "id" | "type" | "status" | "daysCount">,
): LeaveRequest {
  return {
    employeeId: "emp-lea",
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

const balance: LeaveBalance = {
  employeeId: "emp-lea",
  year: 2026,
  congesPayesAcquis: 25,
  congesPayesPris: 5,
  congesPayesRestants: 20,
  rttAcquis: 10,
  rttPris: 2,
  rttRestants: 8,
  recoveryDaysAcquis: 1.5,
  recoveryDaysPris: 0.5,
  recoveryDaysRestants: 1,
};

describe("leave-approval-context balances", () => {
  it("calcule disponible, projeté et distingue pending sans double-compte", () => {
    const current = leave({
      id: "lr-current",
      type: "conges_payes",
      status: "en_attente_manager",
      daysCount: 3,
      startDate: "2026-07-01",
      endDate: "2026-07-03",
    });
    const others = [
      leave({
        id: "lr-pending",
        type: "conges_payes",
        status: "en_attente_manager",
        daysCount: 2,
        startDate: "2026-08-01",
        endDate: "2026-08-02",
      }),
      leave({
        id: "lr-approved",
        type: "conges_payes",
        status: "approuvee",
        daysCount: 4,
        startDate: "2026-03-01",
        endDate: "2026-03-04",
      }),
      leave({
        id: "lr-rejected",
        type: "conges_payes",
        status: "refusee",
        daysCount: 10,
        startDate: "2026-04-01",
        endDate: "2026-04-10",
      }),
      leave({
        id: "lr-cancelled",
        type: "conges_payes",
        status: "annulee",
        daysCount: 7,
        startDate: "2026-05-01",
        endDate: "2026-05-07",
      }),
    ];

    const ctx = buildLeaveBalanceContext({
      balance,
      leaveType: "conges_payes",
      employeeRequests: [current, ...others],
      currentRequest: current,
      year: 2026,
    });

    expect(ctx.tracked).toBe(true);
    expect(ctx.entitlement).toBe(25);
    expect(ctx.consumedRecorded).toBe(5);
    expect(ctx.availableNow).toBe(20);
    expect(ctx.requestDays).toBe(3);
    expect(ctx.projectedAvailableAfterApproval).toBe(17);
    expect(ctx.otherPendingReservedDays).toBe(2);
    expect(ctx.approvedDaysFromRequests).toBe(4);
    expect(ctx.insufficientForRequest).toBe(false);
    // Refusés / annulés exclus des réservations et consommations demandes
    expect(
      sumLeaveDays(others, (r) => isLeavePendingStatus(r.status)),
    ).toBe(2);
  });

  it("signale un solde insuffisant sans décider à la place du Chef", () => {
    const current = leave({
      id: "lr-big",
      type: "rtt",
      status: "en_attente_manager",
      daysCount: 12,
    });
    const ctx = buildLeaveBalanceContext({
      balance,
      leaveType: "rtt",
      employeeRequests: [current],
      currentRequest: current,
      year: 2026,
    });
    expect(ctx.availableNow).toBe(8);
    expect(ctx.projectedAvailableAfterApproval).toBe(-4);
    expect(ctx.insufficientForRequest).toBe(true);
  });

  it("affiche Solde non suivi pour les catégories hors solde", () => {
    const current = leave({
      id: "lr-mal",
      type: "maladie",
      status: "en_attente_manager",
      daysCount: 2,
    });
    const ctx = buildLeaveBalanceContext({
      balance,
      leaveType: "maladie",
      employeeRequests: [current],
      currentRequest: current,
      year: 2026,
    });
    expect(ctx.tracked).toBe(false);
    expect(ctx.untrackedLabel).toBe("Solde non suivi");
    expect(ctx.availableNow).toBeNull();
    expect(ctx.projectedAvailableAfterApproval).toBeNull();
  });

  it("couvre RTT et récupération via les champs de solde dédiés", () => {
    const rtt = leave({
      id: "lr-rtt",
      type: "rtt",
      status: "en_attente_manager",
      daysCount: 1,
    });
    const rec = leave({
      id: "lr-rec",
      type: "recuperation",
      status: "en_attente_manager",
      daysCount: 0.5,
    });
    expect(
      buildLeaveBalanceContext({
        balance,
        leaveType: "rtt",
        employeeRequests: [rtt],
        currentRequest: rtt,
        year: 2026,
      }).availableNow,
    ).toBe(8);
    expect(
      buildLeaveBalanceContext({
        balance,
        leaveType: "recuperation",
        employeeRequests: [rec],
        currentRequest: rec,
        year: 2026,
      }).availableNow,
    ).toBe(1);
  });
});

describe("leave-approval-context history", () => {
  it("sélectionne le dernier congé pris (approuvé) et ignore pending/refusé", () => {
    const requests = [
      leave({
        id: "a",
        type: "conges_payes",
        status: "approuvee",
        daysCount: 2,
        startDate: "2026-01-10",
        endDate: "2026-01-11",
      }),
      leave({
        id: "b",
        type: "rtt",
        status: "approuvee",
        daysCount: 1,
        startDate: "2026-05-01",
        endDate: "2026-05-01",
      }),
      leave({
        id: "c",
        type: "conges_payes",
        status: "en_attente_manager",
        daysCount: 3,
        startDate: "2026-09-01",
        endDate: "2026-09-03",
      }),
      leave({
        id: "d",
        type: "conges_payes",
        status: "refusee",
        daysCount: 5,
        startDate: "2026-08-01",
        endDate: "2026-08-05",
      }),
    ];
    const lastCp = selectLastTakenLeave(requests, "conges_payes", "2026-11-10");
    expect(lastCp?.id).toBe("a");
    const lastAny = selectLastTakenLeave(requests, "rtt", "2026-11-10");
    expect(lastAny?.id).toBe("b");
    expect(isLeaveTakenStatus("approuvee")).toBe(true);
    expect(isLeaveTakenStatus("en_attente_manager")).toBe(false);
  });

  it("filtre l'historique par type prioritaire sans inclure les refus", () => {
    const history = buildLeaveHistoryEntries(
      [
        leave({
          id: "1",
          type: "rtt",
          status: "approuvee",
          daysCount: 1,
          endDate: "2026-02-01",
          startDate: "2026-02-01",
        }),
        leave({
          id: "2",
          type: "conges_payes",
          status: "approuvee",
          daysCount: 2,
          endDate: "2026-03-01",
          startDate: "2026-03-01",
        }),
        leave({
          id: "3",
          type: "conges_payes",
          status: "refusee",
          daysCount: 2,
          endDate: "2026-04-01",
          startDate: "2026-04-01",
        }),
      ],
      { preferredType: "conges_payes", limit: 5 },
    );
    expect(history.map((h) => h.id)).toEqual(["2", "1"]);
  });
});

describe("special leave usage without inventing limits", () => {
  it("agrège les jours spéciaux hors refuse pour l'année", () => {
    const absences = [
      {
        id: "wa-1",
        category: "mariage_pacs",
        status: "enregistre",
        startDate: "2026-02-01",
        endDate: "2026-02-04",
        daysCount: 4,
      },
      {
        id: "wa-2",
        category: "mariage_pacs",
        status: "refuse",
        startDate: "2026-06-01",
        endDate: "2026-06-02",
        daysCount: 2,
      },
      {
        id: "wa-3",
        category: "demenagement",
        status: "termine",
        startDate: "2026-03-01",
        endDate: "2026-03-01",
        daysCount: 1,
      },
    ] as WorkAbsence[];

    expect(
      sumSpecialLeaveDaysUsedThisYear(absences, "mariage_pacs", 2026),
    ).toBe(4);
    expect(
      sumSpecialLeaveDaysUsedThisYear(absences, "mariage_pacs", 2026, "wa-1"),
    ).toBe(0);
  });
});
