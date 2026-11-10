import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { logoutAction } from "@/app/actions/auth";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { isAllowedDuringPasswordChange } from "@/infrastructure/auth/password-change-gate";
import { getContainer } from "@/infrastructure/container";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) {
    // JWT présent mais identité applicative irrésolue → éviter une boucle middleware/layout.
    const raw = await auth();
    if (raw?.user) {
      await signOut({ redirectTo: "/connexion?error=session" });
    }
    redirect("/connexion");
  }

  const pathname =
    (await headers()).get("x-aster-pathname") ?? "/tableau-de-bord";

  if (session.mustChangePassword) {
    if (!isAllowedDuringPasswordChange(pathname)) {
      redirect("/changer-mot-de-passe");
    }
    return (
      <div className="flex min-h-screen flex-col bg-[var(--aster-workspace)]">
        <header className="border-b border-[var(--aster-border)] bg-white">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <p className="font-[family-name:var(--font-display)] text-lg text-[var(--aster-ink)]">
              ASTER
            </p>
            <form action={logoutAction}>
              <Button type="submit" size="sm" variant="outline">
                Se déconnecter
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          {children}
        </main>
      </div>
    );
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
