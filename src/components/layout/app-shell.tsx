import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { AuthSession } from "@/infrastructure/auth/types";

export function AppShell({
  session,
  unread,
  children,
}: {
  session: AuthSession;
  unread: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--aster-workspace)]">
      <div className="flex min-h-0 flex-1">
        <div className="hidden lg:block">
          <Sidebar role={session.role} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar session={session} unread={unread} />
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
