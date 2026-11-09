import {
  assertAbsenceStorageKeyOwnership,
  buildAbsenceDocumentStorageKey,
  calendarTitleForViewer,
  declareWorkAbsenceSchema,
  familyForCategory,
  hasDateGap,
  initialStatusForDeclaration,
  isContinuousExtension,
  isWithinRecurrenceWindow,
  MAX_ABSENCE_DOC_BYTES,
  paternityNoticeReminder,
  payrollProcessingMonth,
  reminderBannerTexts,
  requiresReturnToWorkVisit,
  returnVisitDeadline,
  workAbsenceCategoryLabel,
  type DeclareWorkAbsenceInput,
} from "@/domain/rules/work-absence";
import {
  countWeekdaysInclusive,
  evaluateSpecialLeaveEntitlement,
} from "@/domain/rules/special-leave-entitlements";
import {
  canManageWorkAbsences,
  canSubmitWorkAbsence,
  canViewAllWorkAbsences,
  canViewWorkAbsenceMedicalDocs,
} from "@/domain/rules/permissions";
import { moroccoToday } from "@/domain/rules/reporting";
import type {
  AbsenceDocumentKind,
  WorkAbsence,
  WorkAbsenceStatus,
} from "@/domain/types/hr";
import { AuthError } from "@/infrastructure/auth/authorization";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { EmailPort } from "@/infrastructure/email/types";
import type { HrRepository } from "@/infrastructure/persistence/hr-repository";
import type { DocumentStoragePort } from "@/infrastructure/storage/types";

async function notifyHrAndChef(
  deps: { hr: HrRepository; email: EmailPort },
  title: string,
  body: string,
  href: string,
) {
  const { findAccountByEmployeeId } = await import(
    "@/infrastructure/auth/account-store"
  );
  const emps = await deps.hr.listEmployees({ employmentStatus: "actif" });
  for (const recipient of emps) {
    const account = await findAccountByEmployeeId(recipient.id);
    if (account?.role !== "admin_rh" && account?.role !== "chef_de_projet") {
      continue;
    }
    await deps.hr.addNotification({
      recipientId: recipient.id,
      title,
      body,
      href,
      read: false,
      createdAt: new Date().toISOString(),
    });
    await deps.email.send({
      to: recipient.email,
      subject: `[ASTER] ${title}`,
      body,
    });
  }
}

async function notifyEmployee(
  deps: { hr: HrRepository; email: EmailPort },
  employeeId: string,
  title: string,
  body: string,
  href: string,
) {
  const existing = await deps.hr.listNotifications(employeeId);
  const duplicate = existing.some(
    (n) =>
      n.href === href &&
      n.title === title &&
      Date.now() - new Date(n.createdAt).getTime() < 60_000,
  );
  if (duplicate) return;
  await deps.hr.addNotification({
    recipientId: employeeId,
    title,
    body,
    href,
    read: false,
    createdAt: new Date().toISOString(),
  });
  const emp = await deps.hr.getEmployee(employeeId);
  if (emp) {
    await deps.email.send({
      to: emp.email,
      subject: `[ASTER] ${title}`,
      body,
    });
  }
}

function assertCanViewAbsence(session: AuthSession, absence: WorkAbsence) {
  if (absence.employeeId === session.employee.id) {
    if (!canSubmitWorkAbsence(session.role) && !canViewAllWorkAbsences(session.role)) {
      throw new AuthError("Accès refusé à cette absence.", 403);
    }
    return;
  }
  if (!canViewAllWorkAbsences(session.role)) {
    throw new AuthError("Accès refusé à cette absence.", 403);
  }
}

function redactForChef(absence: WorkAbsence): WorkAbsence {
  return {
    ...absence,
    employeeComment: absence.employeeComment
      ? "[Commentaire collaborateur masqué — documents médicaux réservés RH]"
      : null,
    hrInternalNote: null,
    hrMessage: absence.hrMessage,
  };
}

export function createWorkAbsenceService(deps: {
  hr: HrRepository;
  email: EmailPort;
  storage: DocumentStoragePort;
}) {
  return {
    reminders() {
      return reminderBannerTexts();
    },

    async listVisible(
      session: AuthSession,
      filter?: {
        status?: WorkAbsenceStatus | WorkAbsenceStatus[];
        family?: WorkAbsence["family"];
        tab?: string;
      },
    ): Promise<WorkAbsence[]> {
      let rows: WorkAbsence[];
      if (canViewAllWorkAbsences(session.role)) {
        rows = await deps.hr.listWorkAbsences({
          status: filter?.status,
          family: filter?.family,
        });
      } else if (canSubmitWorkAbsence(session.role)) {
        rows = await deps.hr.listWorkAbsences({
          employeeId: session.employee.id,
          status: filter?.status,
          family: filter?.family,
        });
      } else {
        throw new AuthError("Accès refusé aux absences.", 403);
      }

      if (filter?.tab === "documents_manquants") {
        rows = rows.filter(
          (r) =>
            !r.documentsReceived ||
            r.status === "en_attente_justificatif" ||
            r.status === "informations_demandees",
        );
      } else if (filter?.tab === "en_cours") {
        rows = rows.filter((r) =>
          ["declare", "en_attente_justificatif", "en_cours_verification", "informations_demandees", "enregistre"].includes(
            r.status,
          ),
        );
      } else if (filter?.tab === "prolongations") {
        rows = rows.filter((r) => r.category === "prolongation_arret");
      } else if (filter?.tab === "speciaux") {
        rows = rows.filter((r) => r.family === "conge_special");
      } else if (filter?.tab === "nouvelles") {
        rows = rows.filter((r) =>
          ["declare", "en_attente_justificatif"].includes(r.status),
        );
      }

      if (
        session.role === "chef_de_projet" &&
        !canViewWorkAbsenceMedicalDocs(session.role)
      ) {
        return rows.map(redactForChef);
      }
      return rows;
    },

    async getVisible(session: AuthSession, id: string) {
      const absence = await deps.hr.getWorkAbsence(id);
      if (!absence) throw new AuthError("Absence introuvable.", 404);
      assertCanViewAbsence(session, absence);
      const docs = canViewWorkAbsenceMedicalDocs(session.role) ||
        absence.employeeId === session.employee.id
        ? await deps.hr.listWorkAbsenceDocuments(id)
        : [];
      const events = await deps.hr.listWorkAbsenceEvents(id);
      const view =
        session.role === "chef_de_projet" &&
        !canViewWorkAbsenceMedicalDocs(session.role) &&
        absence.employeeId !== session.employee.id
          ? redactForChef(absence)
          : absence;
      return { absence: view, documents: docs, events };
    },

    async declare(session: AuthSession, raw: DeclareWorkAbsenceInput) {
      if (!canSubmitWorkAbsence(session.role)) {
        throw new AuthError("Soumission d'absence refusée.", 403);
      }
      const parsed = declareWorkAbsenceSchema.parse(raw);
      const family = familyForCategory(parsed.category);
      const daysCount = countWeekdaysInclusive(
        parsed.startDate,
        parsed.endDate,
      );

      let dateGapFlag = false;
      let recurrenceWithin3MonthsFlag = false;
      let requiresHrReview = false;
      const parentAbsenceId = parsed.parentAbsenceId ?? null;
      const recurrenceOfId = parsed.recurrenceOfId ?? null;

      if (parsed.category === "prolongation_arret") {
        if (!parentAbsenceId) {
          throw new Error("Prolongation : arrêt d'origine requis.");
        }
        const parent = await deps.hr.getWorkAbsence(parentAbsenceId);
        if (!parent || parent.employeeId !== session.employee.id) {
          throw new AuthError("Arrêt d'origine introuvable.", 404);
        }
        if (!isContinuousExtension(parent.endDate, parsed.startDate)) {
          dateGapFlag = hasDateGap(parent.endDate, parsed.startDate);
          requiresHrReview = true;
        }
      }

      if (parsed.category === "rechute" && recurrenceOfId) {
        const origin = await deps.hr.getWorkAbsence(recurrenceOfId);
        if (!origin || origin.employeeId !== session.employee.id) {
          throw new AuthError("Absence d'origine introuvable.", 404);
        }
        if (isWithinRecurrenceWindow(origin.startDate, parsed.startDate)) {
          recurrenceWithin3MonthsFlag = true;
          requiresHrReview = true;
        }
      }

      if (family === "conge_special") {
        const year = Number(parsed.startDate.slice(0, 4));
        const prior = await deps.hr.listWorkAbsences({
          employeeId: session.employee.id,
          category: parsed.category,
        });
        const usedDaysThisYear = prior
          .filter(
            (r) =>
              r.startDate.startsWith(String(year)) &&
              r.status !== "refuse",
          )
          .reduce((s, r) => s + r.daysCount, 0);
        const evalResult = evaluateSpecialLeaveEntitlement({
          category: parsed.category,
          requestedDays: daysCount,
          usedDaysThisYear,
          contractType: session.employee.contractType,
        });
        if (!evalResult.allowed) {
          throw new Error(evalResult.message ?? "Durée non autorisée.");
        }
        if (evalResult.requiresHrReview) requiresHrReview = true;
      }

      if (parsed.category === "conge_paternite") {
        const notice = paternityNoticeReminder(
          parsed.startDate,
          new Date().toISOString(),
        );
        if (!notice.ok) requiresHrReview = true;
      }

      const visitRequired = requiresReturnToWorkVisit({
        category: parsed.category,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      });

      const created = await deps.hr.createWorkAbsence({
        employeeId: session.employee.id,
        family,
        category: parsed.category,
        status: initialStatusForDeclaration(false),
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        daysCount,
        employeeComment: parsed.comment?.trim() || null,
        hrInternalNote: null,
        hrMessage: null,
        rejectionReason: null,
        parentAbsenceId,
        recurrenceOfId,
        dateGapFlag,
        recurrenceWithin3MonthsFlag,
        requiresHrReview,
        hospitalAdmissionDate: parsed.hospitalAdmissionDate ?? null,
        hospitalDischargeDate: parsed.hospitalDischargeDate ?? null,
        documentsReceived: false,
        firstDocumentReceivedAt: null,
        payrollProcessingMonth: null,
        expectedReturnDate: parsed.endDate,
        actualReturnDate: null,
        returnVisitRequired: visitRequired,
        returnVisitStatus: visitRequired ? "a_planifier" : "non_requise",
        returnVisitPlannedDate: null,
        returnVisitDeadline: null,
        processedByEmployeeId: null,
        processedAt: null,
      });

      await deps.hr.addWorkAbsenceEvent({
        absenceId: created.id,
        kind: "declared",
        message: `Déclaration ${workAbsenceCategoryLabel(parsed.category)}`,
        actorId: session.employee.id,
      });

      await notifyHrAndChef(
        deps,
        "Nouvelle déclaration d'absence",
        `${session.employee.firstName} ${session.employee.lastName} — ${workAbsenceCategoryLabel(parsed.category)} (${parsed.startDate} → ${parsed.endDate}). Circuit guide : informer management, assistante et paie (hors connecteur paie ASTER).`,
        `/administration/absences/${created.id}`,
      );

      return created;
    },

    async uploadDocument(
      session: AuthSession,
      absenceId: string,
      input: {
        kind: AbsenceDocumentKind;
        fileName: string;
        contentType: string;
        bytes: Uint8Array;
      },
    ) {
      const absence = await deps.hr.getWorkAbsence(absenceId);
      if (!absence) throw new AuthError("Absence introuvable.", 404);
      const isOwner = absence.employeeId === session.employee.id;
      const isHr = canManageWorkAbsences(session.role);
      if (!isOwner && !isHr) {
        throw new AuthError("Upload refusé.", 403);
      }
      if (isOwner && !canViewWorkAbsenceMedicalDocs(session.role)) {
        // employee can upload own docs
        if (
          ![
            "declare",
            "en_attente_justificatif",
            "informations_demandees",
            "en_cours_verification",
          ].includes(absence.status)
        ) {
          throw new Error("Impossible d'ajouter un justificatif dans cet état.");
        }
      }
      if (input.bytes.byteLength > MAX_ABSENCE_DOC_BYTES) {
        throw new Error("Fichier trop volumineux (max 8 Mo).");
      }
      if (input.bytes.byteLength === 0) {
        throw new Error("Fichier vide.");
      }

      const storageKey = buildAbsenceDocumentStorageKey(
        absence.employeeId,
        absence.id,
        input.fileName,
      );
      await deps.storage.putObject(
        storageKey,
        input.bytes,
        input.contentType || "application/octet-stream",
      );

      const doc = await deps.hr.createWorkAbsenceDocument({
        absenceId: absence.id,
        kind: input.kind,
        fileName: input.fileName,
        contentType: input.contentType || "application/octet-stream",
        storageKey,
        uploadedByEmployeeId: session.employee.id,
        receivedByHrAt: isHr ? new Date().toISOString() : null,
      });

      const receivedDay = moroccoToday();
      const patch: Partial<WorkAbsence> = {
        documentsReceived: true,
        firstDocumentReceivedAt:
          absence.firstDocumentReceivedAt ?? new Date().toISOString(),
        payrollProcessingMonth:
          absence.payrollProcessingMonth ??
          payrollProcessingMonth(receivedDay),
      };
      if (
        absence.status === "en_attente_justificatif" ||
        absence.status === "informations_demandees"
      ) {
        patch.status = "en_cours_verification";
      }
      await deps.hr.updateWorkAbsence(absence.id, patch);
      await deps.hr.addWorkAbsenceEvent({
        absenceId: absence.id,
        kind: "document_uploaded",
        message: `Justificatif déposé (${input.kind})`,
        actorId: session.employee.id,
      });

      if (isOwner) {
        await notifyHrAndChef(
          deps,
          "Justificatif d'absence reçu",
          `Document ajouté sur le dossier ${absence.id}`,
          `/administration/absences/${absence.id}`,
        );
      }
      return doc;
    },

    async getDocumentDownloadUrl(
      session: AuthSession,
      documentId: string,
      absenceId: string,
    ) {
      const absence = await deps.hr.getWorkAbsence(absenceId);
      if (!absence) throw new AuthError("Absence introuvable.", 404);
      assertCanViewAbsence(session, absence);
      const isOwner = absence.employeeId === session.employee.id;
      if (!isOwner && !canViewWorkAbsenceMedicalDocs(session.role)) {
        throw new AuthError(
          "Accès aux justificatifs médicaux réservé aux Ressources humaines.",
          403,
        );
      }
      const docs = await deps.hr.listWorkAbsenceDocuments(absenceId);
      const doc = docs.find((d) => d.id === documentId);
      if (!doc) throw new AuthError("Document introuvable.", 404);
      assertAbsenceStorageKeyOwnership(
        doc.storageKey,
        absence.employeeId,
        absence.id,
      );
      return deps.storage.getDownloadUrl(doc.storageKey, 120);
    },

    async hrUpdateStatus(
      session: AuthSession,
      absenceId: string,
      input: {
        status: WorkAbsenceStatus;
        hrMessage?: string | null;
        hrInternalNote?: string | null;
        rejectionReason?: string | null;
        startDate?: string;
        endDate?: string;
        recurrenceOfId?: string | null;
        parentAbsenceId?: string | null;
        actualReturnDate?: string | null;
        returnVisitPlannedDate?: string | null;
        returnVisitStatus?: WorkAbsence["returnVisitStatus"];
        markDocumentReceived?: boolean;
      },
    ) {
      if (!canManageWorkAbsences(session.role)) {
        throw new AuthError("Traitement RH refusé.", 403);
      }
      const absence = await deps.hr.getWorkAbsence(absenceId);
      if (!absence) throw new AuthError("Absence introuvable.", 404);

      const patch: Partial<WorkAbsence> = {};
      if (input.status) patch.status = input.status;
      if (input.hrMessage !== undefined) patch.hrMessage = input.hrMessage;
      if (input.hrInternalNote !== undefined) {
        patch.hrInternalNote = input.hrInternalNote;
      }
      if (input.rejectionReason !== undefined) {
        patch.rejectionReason = input.rejectionReason;
      }
      if (input.startDate || input.endDate) {
        const start = input.startDate ?? absence.startDate;
        const end = input.endDate ?? absence.endDate;
        if (end < start) throw new Error("Dates invalides.");
        patch.startDate = start;
        patch.endDate = end;
        patch.daysCount = countWeekdaysInclusive(start, end);
        patch.expectedReturnDate = end;
        await deps.hr.addWorkAbsenceEvent({
          absenceId,
          kind: "dates_corrected",
          message: `Dates corrigées : ${start} → ${end}`,
          actorId: session.employee.id,
        });
      }
      if (input.recurrenceOfId !== undefined) {
        patch.recurrenceOfId = input.recurrenceOfId;
        if (input.recurrenceOfId) {
          const origin = await deps.hr.getWorkAbsence(input.recurrenceOfId);
          if (origin) {
            patch.recurrenceWithin3MonthsFlag = isWithinRecurrenceWindow(
              origin.startDate,
              absence.startDate,
            );
            if (patch.recurrenceWithin3MonthsFlag) patch.requiresHrReview = true;
          }
        }
      }
      if (input.parentAbsenceId !== undefined) {
        patch.parentAbsenceId = input.parentAbsenceId;
        if (input.parentAbsenceId) {
          const parent = await deps.hr.getWorkAbsence(input.parentAbsenceId);
          if (parent) {
            patch.dateGapFlag = hasDateGap(parent.endDate, absence.startDate);
            if (patch.dateGapFlag) patch.requiresHrReview = true;
          }
        }
      }
      if (input.markDocumentReceived) {
        patch.documentsReceived = true;
        const day = moroccoToday();
        patch.firstDocumentReceivedAt =
          absence.firstDocumentReceivedAt ?? new Date().toISOString();
        patch.payrollProcessingMonth =
          absence.payrollProcessingMonth ?? payrollProcessingMonth(day);
      }
      if (input.actualReturnDate !== undefined) {
        patch.actualReturnDate = input.actualReturnDate;
        if (input.actualReturnDate && absence.returnVisitRequired) {
          patch.returnVisitDeadline = returnVisitDeadline(
            input.actualReturnDate,
          );
          if (
            absence.returnVisitStatus === "a_planifier" ||
            absence.returnVisitStatus === "non_applicable"
          ) {
            patch.returnVisitStatus = "a_planifier";
          }
        }
      }
      if (input.returnVisitPlannedDate !== undefined) {
        patch.returnVisitPlannedDate = input.returnVisitPlannedDate;
        if (input.returnVisitPlannedDate) patch.returnVisitStatus = "planifiee";
      }
      if (input.returnVisitStatus) {
        patch.returnVisitStatus = input.returnVisitStatus;
      }
      if (input.status === "enregistre" || input.status === "termine") {
        patch.processedByEmployeeId = session.employee.id;
        patch.processedAt = new Date().toISOString();
      }

      const updated = await deps.hr.updateWorkAbsence(absenceId, patch);
      await deps.hr.addWorkAbsenceEvent({
        absenceId,
        kind: "hr_update",
        message: `Mise à jour RH → ${input.status}`,
        actorId: session.employee.id,
      });

      await notifyEmployee(
        deps,
        absence.employeeId,
        "Mise à jour de votre déclaration d'absence",
        input.hrMessage?.trim() ||
          `Statut : ${input.status}`,
        "/absences",
      );
      return updated;
    },

    calendarLabel(
      absence: WorkAbsence,
      viewerRole: AuthSession["role"],
      viewerEmployeeId: string,
    ): string {
      const viewer =
        absence.employeeId === viewerEmployeeId
          ? "self"
          : viewerRole === "admin_rh"
            ? "hr"
            : viewerRole === "chef_de_projet"
              ? "chef"
              : "peer";
      return calendarTitleForViewer(absence.category, viewer);
    },
  };
}

export type WorkAbsenceService = ReturnType<typeof createWorkAbsenceService>;
