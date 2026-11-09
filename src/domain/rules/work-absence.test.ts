import { describe, expect, it } from "vitest";
import {
  calendarTitleForViewer,
  hasDateGap,
  isContinuousExtension,
  isEmployerNotifyOverdue,
  isSupportingDocOverdue,
  isWithinRecurrenceWindow,
  payrollProcessingMonth,
  requiresReturnToWorkVisit,
  returnVisitDeadline,
} from "@/domain/rules/work-absence";
import {
  countWeekdaysInclusive,
  evaluateSpecialLeaveEntitlement,
} from "@/domain/rules/special-leave-entitlements";

describe("work-absence rules", () => {
  it("calcule les rappels 24h / 48h", () => {
    expect(
      isEmployerNotifyOverdue(
        "2026-11-01",
        "2026-11-01T10:00:00.000Z",
      ),
    ).toBe(false);
    expect(
      isEmployerNotifyOverdue(
        "2026-11-01",
        "2026-11-03T12:00:00.000Z",
      ),
    ).toBe(true);
    expect(
      isSupportingDocOverdue(
        "2026-11-01",
        false,
        new Date("2026-11-04T00:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isSupportingDocOverdue(
        "2026-11-01",
        true,
        new Date("2026-11-10T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("détecte continuité / écart de prolongation", () => {
    expect(isContinuousExtension("2026-11-05", "2026-11-06")).toBe(true);
    expect(hasDateGap("2026-11-05", "2026-11-08")).toBe(true);
    expect(hasDateGap("2026-11-05", "2026-11-06")).toBe(false);
  });

  it("signale une rechute dans la fenêtre de 3 mois", () => {
    expect(isWithinRecurrenceWindow("2026-01-10", "2026-03-15")).toBe(true);
    expect(isWithinRecurrenceWindow("2026-01-10", "2026-05-01")).toBe(false);
  });

  it("calcule le mois de traitement paie (cutoff 20)", () => {
    expect(payrollProcessingMonth("2026-11-15")).toBe("2026-11");
    expect(payrollProcessingMonth("2026-11-20")).toBe("2026-11");
    expect(payrollProcessingMonth("2026-11-21")).toBe("2026-12");
    expect(payrollProcessingMonth("2026-12-25")).toBe("2027-01");
  });

  it("applique les critères de visite de reprise (guide p.62)", () => {
    expect(
      requiresReturnToWorkVisit({
        category: "conge_maternite",
        startDate: "2026-01-01",
        endDate: "2026-01-10",
      }),
    ).toBe(true);
    expect(
      requiresReturnToWorkVisit({
        category: "arret_maladie",
        startDate: "2026-01-01",
        endDate: "2026-02-05",
      }),
    ).toBe(true);
    expect(
      requiresReturnToWorkVisit({
        category: "arret_maladie",
        startDate: "2026-01-01",
        endDate: "2026-01-05",
      }),
    ).toBe(false);
    expect(returnVisitDeadline("2026-03-01")).toBe("2026-03-09");
  });

  it("respecte la confidentialité des titres calendrier", () => {
    expect(calendarTitleForViewer("arret_maladie", "peer")).toBe("Absence");
    expect(calendarTitleForViewer("arret_maladie", "chef")).toBe(
      "Absence (arrêt)",
    );
    expect(calendarTitleForViewer("mariage_pacs", "chef")).toBe(
      "Mariage / PACS",
    );
    expect(calendarTitleForViewer("arret_maladie", "self")).toBe(
      "Arrêt maladie",
    );
  });

  it("évalue les plafonds de congés spéciaux sans inventer un refus dur", () => {
    const ok = evaluateSpecialLeaveEntitlement({
      category: "demenagement",
      requestedDays: 1,
      usedDaysThisYear: 0,
      contractType: "cdi",
    });
    expect(ok.allowed).toBe(true);

    const over = evaluateSpecialLeaveEntitlement({
      category: "demenagement",
      requestedDays: 3,
      usedDaysThisYear: 0,
      contractType: "cdi",
    });
    expect(over.allowed).toBe(true);
    expect(over.requiresHrReview).toBe(true);

    expect(countWeekdaysInclusive("2026-11-09", "2026-11-13")).toBe(5);
  });
});
