import { Bell } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getContainer } from "@/infrastructure/container";
import { cn, formatDateTimeFr } from "@/lib/utils";

export default async function NotificationsPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");
  const items = await container.hr.listNotifications(session.employee.id);
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Notifications"
        description="Centre d’alertes RH de démonstration (e-mail mocké)."
        actions={
          unread > 0 ? (
            <Badge variant="accent">{unread} non lue{unread > 1 ? "s" : ""}</Badge>
          ) : null
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>
            {items.length} notification{items.length > 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Boîte vide"
              description="Les événements RH généreront des notifications ici."
            />
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "rounded-[10px] border px-4 py-3 transition-colors",
                  n.read
                    ? "border-[var(--aster-border)] bg-white"
                    : "border-[var(--aster-accent)]/25 bg-[var(--aster-accent-bg)]/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-[var(--aster-ink)]">
                        {n.title}
                      </p>
                      {!n.read ? (
                        <Badge variant="accent">Non lue</Badge>
                      ) : (
                        <Badge variant="outline">Lue</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--aster-muted)]">
                      {n.body}
                    </p>
                    <p className="mt-2 text-xs text-[var(--aster-muted)]">
                      {formatDateTimeFr(n.createdAt)}
                    </p>
                  </div>
                  {!n.read ? (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--aster-accent)]"
                      aria-hidden
                    />
                  ) : null}
                </div>
                {n.href ? (
                  <Link
                    href={n.href}
                    className="mt-2 inline-block text-sm font-medium text-[var(--aster-accent)] hover:underline"
                  >
                    Ouvrir
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
