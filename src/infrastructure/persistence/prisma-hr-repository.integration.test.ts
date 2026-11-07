import { afterAll, describe, expect, it } from "vitest";

/**
 * Tests d'intégration Prisma — exécutés uniquement si
 * ASTER_TEST_DATABASE_URL (et DIRECT_URL) pointent vers une base
 * PostgreSQL isolée dédiée aux tests ASTER.
 *
 * Ne jamais pointer vers une base partagée ou de production.
 */
const testUrl = process.env.ASTER_TEST_DATABASE_URL;
const runIntegration = Boolean(testUrl);

describe.runIf(runIntegration)("prismaHrRepository integration", () => {
  let prisma: import("@prisma/client").PrismaClient;
  let repo: typeof import("./prisma-hr-repository").prismaHrRepository;
  let seedAsterDemoData: typeof import("./demo-data-lifecycle").seedAsterDemoData;

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("seeds demo data and persists leave + telework decisions", async () => {
    process.env.DATABASE_URL = testUrl!;
    process.env.DIRECT_URL = process.env.ASTER_TEST_DIRECT_URL ?? testUrl!;
    process.env.ASTER_PERSISTENCE = "prisma";
    process.env.ASTER_MODE = "demo";

    const { resetPrismaClientForTests } = await import("./prisma-client");
    resetPrismaClientForTests();

    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
    ({ seedAsterDemoData } = await import("./demo-data-lifecycle"));
    await seedAsterDemoData(prisma, { resetMutable: true });

    ({ prismaHrRepository: repo } = await import("./prisma-hr-repository"));

    const before = await repo.listLeaveRequests({ employeeId: "emp-lea" });
    expect(before.length).toBeGreaterThan(0);

    const created = await repo.createLeaveRequest({
      employeeId: "emp-lea",
      type: "rtt",
      startDate: "2027-03-01",
      endDate: "2027-03-01",
      halfDayStart: false,
      halfDayEnd: false,
      daysCount: 1,
      status: "en_attente_manager",
      comment: "integration-test",
      managerComment: null,
    });

    const updated = await repo.updateLeaveRequest(created.id, {
      status: "approuvee",
      managerComment: "OK test",
    });
    expect(updated.status).toBe("approuvee");
    expect(updated.managerComment).toBe("OK test");

    const reloaded = await repo.getLeaveRequest(created.id);
    expect(reloaded?.status).toBe("approuvee");

    const tw = await repo.createTeleworkRequest({
      employeeId: "emp-lea",
      type: "regulier",
      month: "2027-04",
      startDate: "2027-04-01",
      endDate: "2027-04-30",
      days: ["2027-04-05", "2027-04-12"],
      status: "en_attente_manager",
      reason: "integration",
      managerComment: null,
    });

    const refused = await repo.updateTeleworkRequest(tw.id, {
      status: "refusee",
      managerComment: "Motif de refus persisté",
    });
    expect(refused.managerComment).toBe("Motif de refus persisté");

    const notif = await repo.addNotification({
      recipientId: "emp-lea",
      title: "Test",
      body: "Notification d'intégration",
      href: "/notifications",
      read: false,
      createdAt: new Date().toISOString(),
    });
    const listed = await repo.listNotifications("emp-lea");
    expect(listed.some((n) => n.id === notif.id)).toBe(true);
  });
});

describe.runIf(!runIntegration)("prismaHrRepository integration (skipped)", () => {
  it("skips when ASTER_TEST_DATABASE_URL is absent", () => {
    expect(runIntegration).toBe(false);
  });
});
