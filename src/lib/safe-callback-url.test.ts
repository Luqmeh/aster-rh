import { describe, expect, it } from "vitest";
import { sanitizeCallbackUrl } from "@/lib/safe-callback-url";

describe("sanitizeCallbackUrl", () => {
  it("accepte les chemins relatifs internes", () => {
    expect(sanitizeCallbackUrl("/tableau-de-bord")).toBe("/tableau-de-bord");
    expect(sanitizeCallbackUrl("/administration/rapports")).toBe(
      "/administration/rapports",
    );
  });

  it("rejette les open redirects", () => {
    expect(sanitizeCallbackUrl("//evil.com")).toBe("/tableau-de-bord");
    expect(sanitizeCallbackUrl("/\\evil")).toBe("/tableau-de-bord");
    expect(sanitizeCallbackUrl("https://evil.com")).toBe("/tableau-de-bord");
    expect(sanitizeCallbackUrl("/foo/../../etc/passwd")).toBe(
      "/tableau-de-bord",
    );
  });
});
