import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.ASTER_E2E_PORT ?? 3111);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npx next dev --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      ASTER_PERSISTENCE: "memory",
      ASTER_MODE: "demo",
      ASTER_CREDENTIALS_AUTH: "1",
      ASTER_ENTRA_AUTH: "0",
      ASTER_SEED_PASSWORD: "AsterE2E-Seed1",
      ASTER_E2E_INSPECT: "1",
      AUTH_SECRET: "aster-e2e-auth-secret-not-for-production",
      AUTH_URL: baseURL,
      ASTER_ALLOW_MOCK_STORAGE: "1",
    },
  },
});
