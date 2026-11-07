import { describe, expect, it } from "vitest";
import {
  emptyFeedback,
  resolveSubmissionUi,
  shouldBlockSubmit,
} from "@/components/modules/form-submission";

describe("form-submission shared helpers", () => {
  it("garantit des messages mutuellement exclusifs", () => {
    const success = resolveSubmissionUi({
      kind: "success",
      requestId: "id",
    }).feedback;
    const failure = resolveSubmissionUi({
      kind: "failure",
      error: new Error("échec"),
    }).feedback;
    expect(success.error).toBeNull();
    expect(failure.success).toBeNull();
    expect(emptyFeedback()).toEqual({ success: null, error: null });
  });

  it("bloque les soumissions pendant pending", () => {
    expect(shouldBlockSubmit(true)).toBe(true);
    expect(shouldBlockSubmit(false)).toBe(false);
  });
});
