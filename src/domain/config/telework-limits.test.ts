import { describe, expect, it } from "vitest";
import { resolveTeleworkLimits } from "@/domain/config/telework-limits";

describe("telework limits config", () => {
  it("defaults to presentation product rules 2 / 12", () => {
    const limits = resolveTeleworkLimits({});
    expect(limits.maxDaysPerWeek).toBe(2);
    expect(limits.maxDaysPerMonth).toBe(12);
    expect(limits.source).toBe("default");
  });

  it("accepts env overrides", () => {
    const limits = resolveTeleworkLimits({
      ASTER_TELEWORK_MAX_DAYS_PER_WEEK: "3",
      ASTER_TELEWORK_MAX_DAYS_PER_MONTH: "10",
    });
    expect(limits.maxDaysPerWeek).toBe(3);
    expect(limits.maxDaysPerMonth).toBe(10);
    expect(limits.source).toBe("env");
  });
});
