import { createHash } from "crypto";
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { expect, test } from "@playwright/test";
import { buildFilledOfficialWorkbook } from "../src/domain/rules/hr-import/official-workbook-fixture";

const RH_EMAIL = "sara.benali@demo.aster-rh.local";
const RH_PASSWORD = "AsterE2E-Seed1";
const OFFICIAL_SHA256 =
  "dbc617d2bc3899f6e6a2509efbbd4a9b8559962ffa8a4ddee4518f8a80ccacc9";

test.describe("Import RH — modèle officiel (navigateur)", () => {
  test("lot invalide : statut validated, pas de #441, confirmation bloquée", async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.locator("#email").fill(RH_EMAIL);
    await page.locator("#password").fill(RH_PASSWORD);
    await Promise.all([
      page.waitForURL(/\/tableau-de-bord/),
      page.getByRole("button", { name: "Se connecter" }).click(),
    ]);

    await page.goto("/administration/import-collaborateurs");
    const bad = await buildFilledOfficialWorkbook({
      employees: [
        [
          "",
          "X",
          "Y",
          "bad-email",
          "UNKNOWN_DEPT",
          "Poste",
          "Site",
          "not-a-date",
          "XXX",
          "Nope",
          "",
          "",
          "",
        ],
      ],
      balances: [["missing-emp", "CP", "-1", "Jours", "bad", "", "", "", ""]],
    });
    const uploadPath = join(tmpdir(), `aster-e2e-bad-${Date.now()}.xlsx`);
    writeFileSync(uploadPath, bad);

    await page.locator('input[type="file"]').setInputFiles(uploadPath);
    await page.getByRole("button", { name: "Analyser et prévisualiser" }).click();
    await expect(page.getByText(/prévisualisation prête/i)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("validated").first()).toBeVisible();
    await expect(
      page.getByText(/Des lignes invalides restent présentes/i).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Exécuter l'import contrôlé" }),
    ).toHaveCount(0);
    await expect(page.getByText(/Minified React error #441/i)).toHaveCount(0);
  });

  test("login RH → téléchargement → upload → IMPORTER → magasin", async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.locator("#email").fill(RH_EMAIL);
    await page.locator("#password").fill(RH_PASSWORD);
    await Promise.all([
      page.waitForURL(/\/tableau-de-bord/),
      page.getByRole("button", { name: "Se connecter" }).click(),
    ]);

    await page.goto("/administration/import-collaborateurs");
    await expect(
      page.getByRole("heading", { name: "Import des collaborateurs" }),
    ).toBeVisible({ timeout: 30_000 });

    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Télécharger le modèle officiel Excel" })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      "ASTER_Modele_Import_RH_Maroc.xlsx",
    );
    const downloadPath = join(tmpdir(), `aster-e2e-template-${Date.now()}.xlsx`);
    await download.saveAs(downloadPath);
    const { readFileSync } = await import("fs");
    const downloadedHash = createHash("sha256")
      .update(readFileSync(downloadPath))
      .digest("hex");
    expect(downloadedHash).toBe(OFFICIAL_SHA256);

    const filled = await buildFilledOfficialWorkbook({
      employees: [
        [
          "emp-e2e-10",
          "Amrani",
          "Nadia",
          "nadia.amrani.e2e@demo.aster-rh.local",
          "AUD",
          "Consultante",
          "Casablanca (démo)",
          "2024-02-01",
          "CDI",
          "Actif",
          "emp-julien",
          "",
          "",
        ],
        [
          "emp-e2e-11",
          "Saadi",
          "Karim",
          "",
          "AUD",
          "Assistant",
          "Casablanca (démo)",
          "2023-06-01",
          "CDI",
          "Actif",
          "",
          "",
          "",
        ],
      ],
      balances: [
        [
          "emp-e2e-11",
          "CP",
          "4",
          "Jours",
          "2026-01-01",
          "Inventaire",
          "Soldes",
          "Vérifié par RH",
          "",
        ],
        [
          "emp-e2e-10",
          "RECUPERATION_HEURES",
          "7",
          "Heures",
          "2026-01-01",
          "Inventaire",
          "Soldes",
          "Vérifié par RH",
          "",
        ],
        [
          "emp-e2e-10",
          "CP",
          "8",
          "Jours",
          "2026-01-01",
          "Inventaire",
          "Soldes",
          "Vérifié par RH",
          "",
        ],
      ],
    });
    const uploadPath = join(tmpdir(), `aster-e2e-filled-${Date.now()}.xlsx`);
    writeFileSync(uploadPath, filled);

    await page.locator('input[type="file"]').setInputFiles(uploadPath);
    await page.getByRole("button", { name: "Analyser et prévisualiser" }).click();
    await expect(page.getByText(/prévisualisation prête/i)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("emp-e2e-10").first()).toBeVisible();
    await expect(page.getByText("emp-e2e-11").first()).toBeVisible();
    await expect(page.getByText("awaiting_confirmation").first()).toBeVisible();

    await page.locator('input[name="confirmationPhrase"]').fill("IMPORTER");
    await page
      .getByRole("button", { name: "Exécuter l'import contrôlé" })
      .click();
    await expect(page.getByText(/Import exécuté/i)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("5. Rapport d'import")).toBeVisible();
    await expect(page.getByText(/Créés : 2/)).toBeVisible();
    await expect(page.getByText(/Soldes importés : 3/)).toBeVisible();
    await expect(page.getByText(/Comptes : créés 1/)).toBeVisible();
    await expect(page.getByText(/en attente 1/)).toBeVisible();

    const batchIdMatch = await page
      .locator("text=Lot :")
      .locator("..")
      .innerText();
    const batchId =
      batchIdMatch.match(/Lot\s*:\s*([a-zA-Z0-9_-]+)/)?.[1] ??
      (await page.locator(".font-mono").first().innerText());

    const inspect = await page.request.get(
      `/api/e2e/hr-import-inspect?matricules=emp-e2e-10,emp-e2e-11&batchId=${encodeURIComponent(batchId.trim())}&year=2026`,
    );
    expect(inspect.ok()).toBeTruthy();
    const body = await inspect.json();

    expect(body.persistence).toBe("memory");
    expect(body.batch?.status).toMatch(/^completed/);
    expect(body.batch?.executionReport?.employeesCreated).toBe(2);
    expect(body.batch?.executionReport?.balancesImported).toBe(3);
    expect(body.batch?.executionReport?.accountsCreated).toBe(1);
    expect(body.batch?.executionReport?.accountsPending).toBe(1);

    const nadia = body.employees.find(
      (e: { matricule: string }) => e.matricule === "emp-e2e-10",
    );
    const karim = body.employees.find(
      (e: { matricule: string }) => e.matricule === "emp-e2e-11",
    );
    expect(nadia?.found).toBe(true);
    expect(nadia?.account?.role).toBe("collaborateur");
    expect(nadia?.account?.mustChangePassword).toBe(true);
    expect(
      nadia?.openingLedger?.some(
        (e: { account: string; unit: string; quantity: number }) =>
          e.account === "recuperation" &&
          e.unit === "hours" &&
          Number(e.quantity) === 7,
      ),
    ).toBe(true);
    expect(
      nadia?.openingLedger?.some(
        (e: { account: string; quantity: number }) =>
          e.account === "conges_payes" && Number(e.quantity) === 8,
      ),
    ).toBe(true);

    expect(karim?.found).toBe(true);
    expect(karim?.account).toBeNull();
    expect(
      karim?.openingLedger?.some(
        (e: { account: string; quantity: number }) =>
          e.account === "conges_payes" && Number(e.quantity) === 4,
      ),
    ).toBe(true);
  });
});
