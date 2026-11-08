import { redirect } from "next/navigation";
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
    redirect("/connexion");
  }
  const notifications = await container.hr.listNotifications(
    session.employee.id,
  );
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <AppShell session={session} unread={unread}>
      {children}
    </AppShell>
  );
}
