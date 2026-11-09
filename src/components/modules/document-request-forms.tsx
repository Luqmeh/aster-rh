"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createDocumentRequestAction,
  getDocumentRequestDownloadUrlAction,
  markDocumentRequestProcessingAction,
  publishDocumentRequestAction,
  rejectDocumentRequestAction,
  requestDocumentClarificationAction,
  uploadDocumentRequestFileAction,
} from "@/app/actions/document-requests";
import type { DocumentRequest, DocumentRequestType } from "@/domain/types/hr";
import {
  documentRequestTypeLabel,
} from "@/domain/rules/document-requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClassName =
  "flex h-9 w-full rounded-[8px] border border-[var(--aster-border-strong)] bg-white px-3 py-2 text-sm text-[var(--aster-ink)]";

export function EmployeeDocumentRequestForm({
  offeredTypes,
}: {
  offeredTypes: DocumentRequestType[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [type, setType] = useState<DocumentRequestType>(
    offeredTypes[0] ?? "attestation_travail",
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setError(null);
        setSuccess(null);
        startTransition(async () => {
          const result = await createDocumentRequestAction({
            documentType: String(form.get("documentType")) as DocumentRequestType,
            customLabel: String(form.get("customLabel") ?? "") || null,
            reason: String(form.get("reason") ?? ""),
          });
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setSuccess("Demande envoyée aux Ressources humaines.");
          router.refresh();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="documentType">Type de document</Label>
        <select
          id="documentType"
          name="documentType"
          className={selectClassName}
          value={type}
          onChange={(e) => setType(e.target.value as DocumentRequestType)}
        >
          {offeredTypes.map((t) => (
            <option key={t} value={t}>
              {documentRequestTypeLabel(t)}
            </option>
          ))}
        </select>
      </div>
      {type === "autre" ? (
        <div className="space-y-1.5">
          <Label htmlFor="customLabel">Document souhaité (revue RH)</Label>
          <Input
            id="customLabel"
            name="customLabel"
            required
            placeholder="Précisez le document non listé"
          />
          <p className="text-xs text-[var(--aster-muted)]">
            Les demandes hors catalogue nécessitent une revue RH — ce n&apos;est
            pas un inventaire issu du guide des pratiques.
          </p>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="reason">Motif / usage prévu</Label>
        <Textarea
          id="reason"
          name="reason"
          required
          className="min-h-[90px]"
          placeholder="Ex. dossier bancaire, mutuelle, déclaration…"
        />
      </div>
      <Button type="submit" disabled={pending || offeredTypes.length === 0}>
        {pending ? "Envoi…" : "Soumettre la demande"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-[var(--aster-danger)]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-xs text-[var(--aster-success)]">
          {success}
        </p>
      ) : null}
    </form>
  );
}

export function DocumentDownloadButton({
  requestId,
  fileName,
}: {
  requestId: string;
  fileName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
            const result = await getDocumentRequestDownloadUrlAction(requestId);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            if (result.url.startsWith("#")) {
              setError("Fichier en mode démo (URL mock).");
              return;
            }
            window.open(result.url, "_blank", "noopener,noreferrer");
          })
        }
      >
        Télécharger ({fileName})
      </Button>
      {error ? (
        <p className="text-xs text-[var(--aster-muted)]">{error}</p>
      ) : null}
    </div>
  );
}

export function HrDocumentRequestActions({
  request,
}: {
  request: DocumentRequest;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [internalNote, setInternalNote] = useState(
    request.hrInternalNote ?? "",
  );
  const [message, setMessage] = useState("");

  function run(action: () => Promise<{ ok: boolean; message?: string }>, okMsg: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "Action impossible.");
        return;
      }
      setSuccess(okMsg);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="hrInternalNote">Note interne RH (invisible collaborateur)</Label>
        <Textarea
          id="hrInternalNote"
          className="min-h-[70px]"
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            run(
              () => markDocumentRequestProcessingAction(request.id),
              "Demande en traitement.",
            )
          }
        >
          Marquer en traitement
        </Button>
        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={pending || !request.storageKey}
          onClick={() =>
            run(
              () => publishDocumentRequestAction(request.id),
              "Document mis à disposition.",
            )
          }
        >
          Mettre à disposition
        </Button>
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const payload = new FormData(form);
          payload.set("requestId", request.id);
          payload.set("hrInternalNote", internalNote);
          run(async () => {
            const result = await uploadDocumentRequestFileAction(payload);
            return result;
          }, "Fichier déposé (non publié).");
        }}
      >
        <Label htmlFor="file">Déposer le document (non visible tant que non publié)</Label>
        <Input id="file" name="file" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Téléverser
        </Button>
        {request.fileName ? (
          <p className="text-xs text-[var(--aster-muted)]">
            Fichier actuel : {request.fileName}
            {request.published ? " (publié)" : " (brouillon RH)"}
          </p>
        ) : null}
      </form>

      <div className="space-y-2">
        <Label htmlFor="hrMessage">Message collaborateur (clarification / refus)</Label>
        <Textarea
          id="hrMessage"
          className="min-h-[70px]"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  requestDocumentClarificationAction(
                    request.id,
                    message,
                    internalNote,
                  ),
                "Clarification demandée.",
              )
            }
          >
            Demander des informations
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  rejectDocumentRequestAction(request.id, message, internalNote),
                "Demande refusée.",
              )
            }
          >
            Refuser
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-[var(--aster-danger)]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-xs text-[var(--aster-success)]">
          {success}
        </p>
      ) : null}
    </div>
  );
}
