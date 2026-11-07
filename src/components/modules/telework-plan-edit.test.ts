import { describe, expect, it } from "vitest";
import {
  assertPlanEditable,
  buildPlannerPrefill,
  createPlanSuccessMessage,
  planStatusCaption,
  updatePlanSuccessMessage,
} from "@/components/modules/telework-plan-edit";
import type { TeleworkRequest } from "@/domain/types/hr";

const pendingPlan: TeleworkRequest = {
  id: "tw-edit",
  employeeId: "emp-lea",
  type: "regulier",
  month: "2026-12",
  startDate: "2026-12-01",
  endDate: "2026-12-31",
  days: ["2026-12-01", "2026-12-03"],
  status: "en_attente_manager",
  reason: "Demo",
  managerComment: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

describe("telework plan editing helpers", () => {
  it("préremplit le planificateur depuis un plan existant", () => {
    const prefill = buildPlannerPrefill(pendingPlan);
    expect(prefill.editingPlanId).toBe("tw-edit");
    expect(prefill.initialMonth).toBe("2026-12");
    expect(prefill.initialDays).toEqual(["2026-12-01", "2026-12-03"]);
    expect(prefill.initialReason).toBe("Demo");
  });

  it("autorise la modification d'un plan en attente", () => {
    const result = assertPlanEditable(pendingPlan, "emp-lea");
    expect(result.ok).toBe(true);
  });

  it("refuse la modification d'un plan approuvé", () => {
    const result = assertPlanEditable(
      { ...pendingPlan, status: "approuvee" },
      "emp-lea",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/approuvés ou refusés/i);
    }
  });

  it("refuse la modification d'un plan refusé", () => {
    const result = assertPlanEditable(
      { ...pendingPlan, status: "refusee" },
      "emp-lea",
    );
    expect(result.ok).toBe(false);
  });

  it("refuse la modification par un autre collaborateur", () => {
    const result = assertPlanEditable(pendingPlan, "emp-other");
    expect(result.ok).toBe(false);
  });

  it("produit des libellés de statut distincts", () => {
    expect(planStatusCaption("en_attente_manager")).toMatch(/modifiable/i);
    expect(planStatusCaption("approuvee")).toMatch(/Approuvé/i);
    expect(planStatusCaption("refusee")).toMatch(/Refusé/i);
  });

  it("différencie les messages de succès création / mise à jour", () => {
    expect(createPlanSuccessMessage("a")).toMatch(/enregistrée/i);
    expect(updatePlanSuccessMessage("a")).toMatch(/mis à jour/i);
  });
});
