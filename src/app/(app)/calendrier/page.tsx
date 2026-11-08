import { createCalendarService } from "@/application/services/calendar-service";
import { HrCalendar } from "@/components/calendar/hr-calendar";
import { PageHeader } from "@/components/ui/page-header";
import { currentMonthKey } from "@/domain/rules/dates";
import { hasGlobalPeopleScope } from "@/domain/rules/permissions";
import { getContainer } from "@/infrastructure/container";

export default async function CalendrierPage() {
  const container = getContainer();
  const session = await container.auth.getSession();
  if (!session) throw new Error("Session absente");

  const calendar = createCalendarService(container);
  const month = currentMonthKey();
  const orgScope = hasGlobalPeopleScope(session.role);
  const data = orgScope
    ? await calendar.getTeamMonth(session, month)
    : await calendar.getEmployeeMonth(session, month);

  const scope = orgScope ? "Vue organisation" : "Vue personnelle";

  return (
    <div className="aster-fade-up space-y-6">
      <PageHeader
        title="Calendrier RH"
        description="Absences et télétravail dérivés des demandes existantes. Les demandes refusées restent distinctes des événements confirmés."
        eyebrow={scope}
      />
      <HrCalendar
        initialMonth={data.month}
        events={data.events}
        title="Calendrier"
        subtitle="Navigation mensuelle · indicateurs par statut · détail au clic."
      />
    </div>
  );
}
