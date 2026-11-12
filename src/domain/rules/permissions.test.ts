import { describe, expect, it } from "vitest";
import {
  canAccessHrReporting,
  canApproveRequests,
  canBrowseDirectory,
  canExecuteHrImport,
  canManageEmployees,
  canManageWorkAbsences,
  canSubmitDocumentRequest,
  canSubmitLeaveRequest,
  canSubmitTeleworkRequest,
  canSubmitWorkAbsence,
  canSubmitWorkOnHolidayRequest,
  canUseEmployeeSelfService,
  canViewAllRequests,
  canViewAllWorkAbsences,
  canViewHrImport,
  canViewWorkAbsenceMedicalDocs,
  hasPermission,
  roleLabel,
} from "@/domain/rules/permissions";

describe("permissions hierarchy", () => {
  it("donne au Senior Manager les droits de validation sans libre-service", () => {
    expect(canApproveRequests("chef_de_projet")).toBe(true);
    expect(canBrowseDirectory("chef_de_projet")).toBe(true);
    expect(canManageEmployees("chef_de_projet")).toBe(true);
    expect(canViewAllRequests("chef_de_projet")).toBe(true);
    expect(hasPermission("chef_de_projet", "hr.administration")).toBe(true);
    expect(canAccessHrReporting("chef_de_projet")).toBe(true);
    expect(canViewAllWorkAbsences("chef_de_projet")).toBe(true);
    expect(canManageWorkAbsences("chef_de_projet")).toBe(false);
    expect(canViewWorkAbsenceMedicalDocs("chef_de_projet")).toBe(false);
    expect(canViewHrImport("chef_de_projet")).toBe(true);
    expect(canExecuteHrImport("chef_de_projet")).toBe(false);

    expect(canSubmitLeaveRequest("chef_de_projet")).toBe(false);
    expect(canSubmitTeleworkRequest("chef_de_projet")).toBe(false);
    expect(canSubmitDocumentRequest("chef_de_projet")).toBe(false);
    expect(canSubmitWorkAbsence("chef_de_projet")).toBe(false);
    expect(canSubmitWorkOnHolidayRequest("chef_de_projet")).toBe(false);
    expect(canUseEmployeeSelfService("chef_de_projet")).toBe(false);
    expect(hasPermission("chef_de_projet", "request.leave.approve")).toBe(true);
    expect(hasPermission("chef_de_projet", "request.telework.approve")).toBe(
      true,
    );
  });

  it("donne à la RH la gestion sans validation ni libre-service", () => {
    expect(canApproveRequests("admin_rh")).toBe(false);
    expect(canBrowseDirectory("admin_rh")).toBe(true);
    expect(canManageEmployees("admin_rh")).toBe(true);
    expect(canViewAllRequests("admin_rh")).toBe(true);
    expect(hasPermission("admin_rh", "request.leave.approve")).toBe(false);
    expect(canAccessHrReporting("admin_rh")).toBe(true);
    expect(canManageWorkAbsences("admin_rh")).toBe(true);
    expect(canViewWorkAbsenceMedicalDocs("admin_rh")).toBe(true);
    expect(canViewHrImport("admin_rh")).toBe(true);
    expect(canExecuteHrImport("admin_rh")).toBe(true);

    expect(canSubmitLeaveRequest("admin_rh")).toBe(false);
    expect(canSubmitTeleworkRequest("admin_rh")).toBe(false);
    expect(canSubmitDocumentRequest("admin_rh")).toBe(false);
    expect(canSubmitWorkAbsence("admin_rh")).toBe(false);
    expect(canSubmitWorkOnHolidayRequest("admin_rh")).toBe(false);
    expect(canUseEmployeeSelfService("admin_rh")).toBe(false);
  });

  it("limite le collaborateur au libre-service complet", () => {
    expect(canApproveRequests("collaborateur")).toBe(false);
    expect(canBrowseDirectory("collaborateur")).toBe(false);
    expect(canManageEmployees("collaborateur")).toBe(false);
    expect(canViewAllRequests("collaborateur")).toBe(false);
    expect(hasPermission("collaborateur", "request.leave.submit")).toBe(true);
    expect(canAccessHrReporting("collaborateur")).toBe(false);
    expect(canViewAllWorkAbsences("collaborateur")).toBe(false);
    expect(hasPermission("collaborateur", "work_absence.submit")).toBe(true);
    expect(canViewHrImport("collaborateur")).toBe(false);
    expect(canExecuteHrImport("collaborateur")).toBe(false);

    expect(canSubmitLeaveRequest("collaborateur")).toBe(true);
    expect(canSubmitTeleworkRequest("collaborateur")).toBe(true);
    expect(canSubmitDocumentRequest("collaborateur")).toBe(true);
    expect(canSubmitWorkAbsence("collaborateur")).toBe(true);
    expect(canSubmitWorkOnHolidayRequest("collaborateur")).toBe(true);
    expect(canUseEmployeeSelfService("collaborateur")).toBe(true);
  });

  it("expose les libellés français officiels", () => {
    expect(roleLabel("chef_de_projet")).toBe("Senior Manager");
    expect(roleLabel("admin_rh")).toBe("Responsable RH");
    expect(roleLabel("collaborateur")).toBe("Collaborateur");
  });
});
