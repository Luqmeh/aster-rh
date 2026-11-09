import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadCv = vi.fn();
const submit = vi.fn();
const getSession = vi.fn();

vi.mock("@/infrastructure/container", () => ({
  getContainer: () => ({
    auth: { getSession },
    hr: {},
    email: {},
    storage: {},
    payroll: {},
    persistence: "demo" as const,
  }),
}));

vi.mock("@/application/services/recruitment-service", () => ({
  createRecruitmentService: () => ({
    uploadCv,
    submit,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("uploadRecruitmentCvAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      employee: { id: "emp-hr", isActive: true },
      role: "admin_rh",
    });
    uploadCv.mockResolvedValue({});
    submit.mockResolvedValue({});
  });

  it("retourne une erreur métier si le fichier est absent (pas de throw)", async () => {
    const { uploadRecruitmentCvAction } = await import(
      "@/app/actions/recruitment"
    );
    const formData = new FormData();
    formData.set("candidateId", "cand-1");
    const result = await uploadRecruitmentCvAction(formData);
    expect(result).toEqual({
      ok: false,
      message: "Sélectionnez un fichier CV.",
    });
    expect(uploadCv).not.toHaveBeenCalled();
  });

  it("retourne une erreur si le dossier est manquant", async () => {
    const { uploadRecruitmentCvAction } = await import(
      "@/app/actions/recruitment"
    );
    const formData = new FormData();
    formData.set("cv", new File([new Uint8Array([1, 2, 3])], "cv.pdf", {
      type: "application/pdf",
    }));
    const result = await uploadRecruitmentCvAction(formData);
    expect(result).toEqual({
      ok: false,
      message: "Dossier candidat manquant.",
    });
  });

  it("téléverse via FormData et ne propage pas d'exception", async () => {
    const { uploadRecruitmentCvAction } = await import(
      "@/app/actions/recruitment"
    );
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const formData = new FormData();
    formData.set("candidateId", "cand-1");
    formData.set(
      "cv",
      new File([bytes], "dossier.pdf", { type: "application/pdf" }),
    );
    const result = await uploadRecruitmentCvAction(formData);
    expect(result).toEqual({ ok: true });
    expect(uploadCv).toHaveBeenCalledOnce();
    const [, id, file] = uploadCv.mock.calls[0]!;
    expect(id).toBe("cand-1");
    expect(file.fileName).toBe("dossier.pdf");
    expect(file.contentType).toBe("application/pdf");
    expect(file.bytes).toBeInstanceOf(Uint8Array);
  });

  it("convertit une erreur stockage en { ok:false } (évite React #441)", async () => {
    uploadCv.mockRejectedValue(
      new Error(
        "Stockage Supabase requis en production : définissez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY",
      ),
    );
    const { uploadRecruitmentCvAction } = await import(
      "@/app/actions/recruitment"
    );
    const formData = new FormData();
    formData.set("candidateId", "cand-1");
    formData.set(
      "cv",
      new File([new Uint8Array([1])], "cv.pdf", { type: "application/pdf" }),
    );
    const result = await uploadRecruitmentCvAction(formData);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Stockage Supabase requis/i);
    }
  });
});

describe("submitRecruitmentAction (prod digest 1412190641)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({
      employee: { id: "emp-hr", isActive: true },
      role: "admin_rh",
    });
  });

  it("retourne le message métier sans throw (cause React #441 en prod)", async () => {
    submit.mockRejectedValue(
      new Error("Un CV est obligatoire avant soumission."),
    );
    const { submitRecruitmentAction } = await import(
      "@/app/actions/recruitment"
    );
    const result = await submitRecruitmentAction("cand-1");
    expect(result).toEqual({
      ok: false,
      message: "Un CV est obligatoire avant soumission.",
    });
  });
});
