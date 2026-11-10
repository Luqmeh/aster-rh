"use server";

import { createEntitlementService } from "@/application/services/entitlement-service";
import { createLeaveLedgerService } from "@/application/services/leave-ledger-service";
import { requireSession } from "@/infrastructure/auth/authorization";
import { getContainer } from "@/infrastructure/container";
import { revalidatePath } from "next/cache";

function services() {
  const container = getContainer();
  const leaveLedger = createLeaveLedgerService(container);
  const entitlement = createEntitlementService({
    hr: container.hr,
    leaveLedger,
  });
  return { container, entitlement };
}

async function sessionOrThrow() {
  const { container, entitlement } = services();
  const session = requireSession(await container.auth.getSession());
  return { session, entitlement };
}

export async function previewAccrualBatchAction(formData: FormData) {
  const { session, entitlement } = await sessionOrThrow();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error("Période invalide.");
  }
  await entitlement.createPreviewBatch(session, { year, month });
  revalidatePath("/administration/droits-conges");
}

export async function postAccrualBatchAction(formData: FormData) {
  const { session, entitlement } = await sessionOrThrow();
  const batchId = String(formData.get("batchId") ?? "");
  if (!batchId) throw new Error("Lot manquant.");
  await entitlement.postBatch(session, batchId);
  revalidatePath("/administration/droits-conges");
}

export async function requestCarryoverAction(formData: FormData) {
  const { session, entitlement } = await sessionOrThrow();
  const employeeId = String(formData.get("employeeId") ?? "");
  const requestedDays = Number(formData.get("requestedDays"));
  const sourcePeriodKey = String(formData.get("sourcePeriodKey") ?? "");
  const targetPeriodKey = String(formData.get("targetPeriodKey") ?? "");
  const exceptionReason =
    String(formData.get("exceptionReason") ?? "") || undefined;
  const leavePlanThrough =
    String(formData.get("leavePlanThrough") ?? "") || undefined;
  const partnerApprovedById =
    String(formData.get("partnerApprovedById") ?? "") || undefined;

  await entitlement.requestCpCarryover(session, {
    employeeId,
    sourcePeriodKey,
    targetPeriodKey,
    requestedDays,
    exceptionReason,
    leavePlanThrough,
    partnerApprovedById,
  });
  revalidatePath("/administration/droits-conges");
}

export async function decideCarryoverAction(formData: FormData) {
  const { session, entitlement } = await sessionOrThrow();
  const requestId = String(formData.get("requestId") ?? "");
  const approve = String(formData.get("approve")) === "true";
  const decisionNote = String(formData.get("decisionNote") ?? "");
  await entitlement.decideCarryover(session, {
    requestId,
    approve,
    decisionNote,
  });
  revalidatePath("/administration/droits-conges");
}

export async function previewRttExpiryAction(formData: FormData) {
  const { session, entitlement } = await sessionOrThrow();
  const asOfDate = String(formData.get("asOfDate") ?? "2026-07-01");
  const dryRun = String(formData.get("dryRun") ?? "true") !== "false";
  await entitlement.previewOrPostRttExpiry(session, { asOfDate, dryRun });
  revalidatePath("/administration/droits-conges");
}
