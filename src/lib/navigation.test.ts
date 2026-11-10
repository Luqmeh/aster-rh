import { describe, expect, it } from "vitest";
import { findNavItem } from "@/lib/navigation";

describe("findNavItem", () => {
  it("préfère le href le plus spécifique", () => {
    const item = findNavItem("/administration/rapports", "admin_rh");
    expect(item?.href).toBe("/administration/rapports");
    expect(item?.label).toBe("Reporting RH");
  });

  it("résout la page administration racine", () => {
    const item = findNavItem("/administration", "chef_de_projet");
    expect(item?.href).toBe("/administration");
  });
});
