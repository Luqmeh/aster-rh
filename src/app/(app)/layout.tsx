import { AppShell } from "@/components/layout/app-shell";
import { getContainer } from "@/infrastructure/container";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) {
    throw new Error("Impossible d'initialiser la session de démonstration.");
  }
  const identities = await container.auth.listDemoIdentities();
  const notifications = await container.hr.listNotifications(
    session.employee.id,
  );
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <AppShell session={session} identities={identities} unread={unread}>
      {children}
    </AppShell>
  );
}
