import { describe, expect, it } from "vitest";
import {
  assertCvStorageKeyOwnsCandidate,
  buildRecruitmentCvStorageKey,
  recruitmentCvStoragePrefix,
} from "@/domain/rules/recruitment";

describe("recruitment CV storage keys", () => {
  it("construit un préfixe lié au candidat", () => {
    expect(recruitmentCvStoragePrefix("rec-1")).toBe("recruitment/rec-1/");
    const key = buildRecruitmentCvStorageKey("rec-1", "Mon CV.pdf");
    expect(key.startsWith("recruitment/rec-1/")).toBe(true);
    expect(key.includes("Mon_CV.pdf") || key.endsWith("Mon_CV.pdf")).toBe(true);
  });

  it("refuse une clé appartenant à un autre dossier", () => {
    expect(
      assertCvStorageKeyOwnsCandidate(
        "recruitment/rec-other/file.pdf",
        "rec-1",
      ).ok,
    ).toBe(false);
    expect(
      assertCvStorageKeyOwnsCandidate(
        "recruitment/rec-1/file.pdf",
        "rec-1",
      ).ok,
    ).toBe(true);
  });
});
