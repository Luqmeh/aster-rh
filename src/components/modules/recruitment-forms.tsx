"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyInterviewerAssignmentAction,
  createRecruitmentDraftAction,
  decideRecruitmentAction,
  getRecruitmentCvUrlAction,
  submitRecruitmentAction,
  updateRecruitmentDraftAction,
  uploadRecruitmentCvAction,
} from "@/app/actions/recruitment";
import type { Employee, OrganizationUnit, RecruitmentCandidate } from "@/domain/types/hr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClassName =
  "flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 py-2 text-sm text-[var(--aster-ink)]";

export function RecruitmentCreateForm({
  departments,
}: {
  departments: OrganizationUnit[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await createRecruitmentDraftAction({
            fullName: String(form.get("fullName") ?? ""),
            email: String(form.get("email") ?? ""),
            phone: String(form.get("phone") ?? "") || null,
            positionTitle: String(form.get("positionTitle") ?? ""),
            departmentId: String(form.get("departmentId") ?? "") || null,
            hrNotes: String(form.get("hrNotes") ?? "") || null,
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          router.push(`/entretiens/${result.id}`);
          router.refresh();
        });
      }}
    >
      <RecruitmentFields departments={departments} />
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer le dossier"}
      </Button>
      {error ? <p role="alert" className="text-xs text-[var(--aster-danger)]">{error}</p> : null}
    </form>
  );
}

export function RecruitmentEditForm({
  candidate,
  departments,
}: {
  candidate: RecruitmentCandidate;
  departments: OrganizationUnit[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setError(null);
          setSuccess(null);
          startTransition(async () => {
            const result = await updateRecruitmentDraftAction(candidate.id, {
              fullName: String(form.get("fullName") ?? ""),
              email: String(form.get("email") ?? ""),
              phone: String(form.get("phone") ?? "") || null,
              positionTitle: String(form.get("positionTitle") ?? ""),
              departmentId: String(form.get("departmentId") ?? "") || null,
              hrNotes: String(form.get("hrNotes") ?? "") || null,
            });
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setSuccess("Brouillon enregistré.");
            router.refresh();
          });
        }}
      >
        <RecruitmentFields departments={departments} candidate={candidate} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            Enregistrer le brouillon
          </Button>
          <Button
            type="button"
            size="sm"
            variant="accent"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                setSuccess(null);
                const result = await submitRecruitmentAction(candidate.id);
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                setSuccess("Dossier soumis au Chef de projet.");
                router.refresh();
              })
            }
          >
            Soumettre pour revue
          </Button>
        </div>
      </form>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const fileInput = form.elements.namedItem("cv") as HTMLInputElement;
          if (!fileInput.files?.[0]) {
            setError("Sélectionnez un fichier CV.");
            return;
          }
          setError(null);
          setSuccess(null);
          const payload = new FormData(form);
          payload.set("candidateId", candidate.id);
          startTransition(async () => {
            const result = await uploadRecruitmentCvAction(payload);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setSuccess("CV téléversé.");
            router.refresh();
          });
        }}
      >
        <Label htmlFor="cv">CV (PDF, DOC, DOCX — max 5 Mo)</Label>
        <Input id="cv" name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf" />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Téléverser le CV
        </Button>
        {candidate.cvFileName ? (
          <p className="text-xs text-[var(--aster-muted)]">
            Fichier actuel : {candidate.cvFileName}
          </p>
        ) : null}
      </form>

      {error ? <p role="alert" className="text-xs text-[var(--aster-danger)]">{error}</p> : null}
      {success ? <p role="status" className="text-xs text-[var(--aster-success)]">{success}</p> : null}
    </div>
  );
}

export function RecruitmentDecisionForm({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const decision = String(form.get("decision")) as "approuve" | "refuse";
        const comment = String(form.get("comment") ?? "");
        setError(null);
        startTransition(async () => {
          const result = await decideRecruitmentAction(candidateId, decision, comment);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          router.refresh();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="decision">Décision</Label>
        <select id="decision" name="decision" className={selectClassName} defaultValue="approuve">
          <option value="approuve">Approuver</option>
          <option value="refuse">Refuser</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="comment">Commentaire / motif</Label>
        <Textarea id="comment" name="comment" className="min-h-[80px]" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Enregistrer la décision
      </Button>
      {error ? <p role="alert" className="text-xs text-[var(--aster-danger)]">{error}</p> : null}
    </form>
  );
}

export function InterviewerAssignForm({
  candidateId,
  employees,
  currentInterviewerId,
}: {
  candidateId: string;
  employees: Employee[];
  currentInterviewerId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(currentInterviewerId ?? "");
  const [error, setError] = useState<string | null>(null);
  const selectedEmployee = employees.find((e) => e.id === selected) ?? null;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="interviewer">Intervieweur interne (actifs)</Label>
        <select
          id="interviewer"
          className={selectClassName}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Sélectionner…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName} — {e.jobTitle}
            </option>
          ))}
        </select>
      </div>
      {selectedEmployee ? (
        <p className="text-xs text-[var(--aster-muted)]">
          {selectedEmployee.firstName} {selectedEmployee.lastName} ·{" "}
          {selectedEmployee.jobTitle} · département {selectedEmployee.departmentId}
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={pending || !selected}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await applyInterviewerAssignmentAction(candidateId, selected);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.refresh();
          })
        }
      >
        Appliquer
      </Button>
      {error ? <p role="alert" className="text-xs text-[var(--aster-danger)]">{error}</p> : null}
    </div>
  );
}

export function CvAccessButton({ candidateId, fileName }: { candidateId: string; fileName: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!fileName) {
    return <p className="text-xs text-[var(--aster-muted)]">Aucun CV.</p>;
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await getRecruitmentCvUrlAction(candidateId);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            if (result.url.startsWith("#")) {
              setError("CV stocké en mode démo (URL privée mock).");
              return;
            }
            window.open(result.url, "_blank", "noopener,noreferrer");
          })
        }
      >
        Ouvrir le CV ({fileName})
      </Button>
      {error ? <p className="text-xs text-[var(--aster-muted)]">{error}</p> : null}
    </div>
  );
}

function RecruitmentFields({
  departments,
  candidate,
}: {
  departments: OrganizationUnit[];
  candidate?: RecruitmentCandidate;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="fullName">Nom complet</Label>
        <Input id="fullName" name="fullName" required defaultValue={candidate?.fullName} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail professionnel</Label>
        <Input id="email" name="email" type="email" required defaultValue={candidate?.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Téléphone</Label>
        <Input id="phone" name="phone" defaultValue={candidate?.phone ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="positionTitle">Poste visé</Label>
        <Input
          id="positionTitle"
          name="positionTitle"
          required
          defaultValue={candidate?.positionTitle}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="departmentId">Département</Label>
        <select
          id="departmentId"
          name="departmentId"
          className={selectClassName}
          defaultValue={candidate?.departmentId ?? ""}
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="hrNotes">Compte rendu / notes RH</Label>
        <Textarea
          id="hrNotes"
          name="hrNotes"
          className="min-h-[120px]"
          defaultValue={candidate?.hrNotes ?? ""}
        />
      </div>
    </div>
  );
}
