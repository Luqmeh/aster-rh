import { describe, expect, it } from "vitest";
import {
  addScaled,
  formatScaled,
  fromScaled,
  toScaled,
} from "@/domain/rules/leave-decimal";

describe("leave-decimal", () => {
  it("préserve les fractions (0.5, 1.25)", () => {
    expect(fromScaled(toScaled(0.5))).toBe(0.5);
    expect(fromScaled(toScaled("1.25"))).toBe(1.25);
    expect(formatScaled(toScaled(-3.5))).toBe("-3.5");
  });

  it("additionne sans dérive flottante", () => {
    const sum = addScaled(toScaled(0.1), toScaled(0.2));
    expect(fromScaled(sum)).toBe(0.3);
  });
});
