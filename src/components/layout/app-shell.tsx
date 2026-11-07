import { DemoBanner } from "@/components/demo/demo-banner";
import { MobileRoleBar } from "@/components/demo/mobile-role-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { AuthSession } from "@/infrastructure/auth/types";
import type { DemoIdentity } from "@/domain/types/hr";

export function AppShell({
  session,
  identities,
  unread,
  children,
}: {
  session: AuthSession;
  identities: DemoIdentity[];
  unread: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--aster-workspace)]">
      <DemoBanner />
      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:block">
          <Sidebar role={session.role} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            session={session}
            unread={unread}
            identities={identities}
          />
          <MobileRoleBar identities={identities} currentId={session.identity.id} />
          <MobileNav role={session.role} />
          <main className="min-w-0 flex-1 overflow-auto">
            <div className="aster-page px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
