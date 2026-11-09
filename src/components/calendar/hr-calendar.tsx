"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  addMonths,
  currentMonthKey,
  FRENCH_WEEKDAY_SHORT,
  formatMonthYearFr,
  listDaysInMonth,
  parseDateOnly,
  toDateOnly,
} from "@/domain/rules/dates";
import { eventsByDate } from "@/domain/rules/calendar-events";
import {
  WorkOnHolidayChefActions,
  WorkOnHolidayDeclareActual,
  WorkOnHolidayRequestForm,
} from "@/components/modules/work-on-holiday-forms";
import {
  CALENDAR_TONE_CLASSES,
  type CalendarEvent,
} from "@/domain/types/calendar";
import type { DemoRole } from "@/domain/types/hr";
import { cn, formatDateFr } from "@/lib/utils";

function padCalendarDays(month: string): (string | null)[] {
  const days = listDaysInMonth(month);
  const first = parseDateOnly(days[0]);
  const mondayIndex = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: mondayIndex }, () => null);
  cells.push(...days);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function HrCalendar({
  initialMonth,
  events,
  title,
  subtitle,
  compact = false,
  role = "collaborateur",
}: {
  initialMonth: string;
  events: CalendarEvent[];
  title?: string;
  subtitle?: string;
  compact?: boolean;
  role?: DemoRole;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthEvents = useMemo(
    () => events.filter((e) => e.date.startsWith(month)),
    [events, month],
  );
  const byDate = useMemo(() => eventsByDate(monthEvents), [monthEvents]);
  const cells = useMemo(() => padCalendarDays(month), [month]);
  const today = toDateOnly(new Date());
  const selectedEvents = selectedDate ? (byDate[selectedDate] ?? []) : [];

  return (
    <div className="aster-soft-in rounded-[10px] border border-[var(--aster-border)] bg-white shadow-[var(--aster-shadow)]">
      <div
        className={cn(
          "flex flex-col gap-3 border-b border-[var(--aster-border)] sm:flex-row sm:items-end sm:justify-between",
          compact ? "px-4 py-3" : "px-4 py-4 sm:px-5",
        )}
      >
        <div>
          {title ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--aster-muted)]">
              {title}
            </p>
          ) : null}
          <h2 className="text-lg font-semibold capitalize tracking-tight text-[var(--aster-ink)] sm:text-xl">
            {formatMonthYearFr(month)}
          </h2>
          {subtitle && !compact ? (
            <p className="mt-1 max-w-xl text-sm text-[var(--aster-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMonth(currentMonthKey())}
          >
            Aujourd&apos;hui
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4",
          compact ? "p-3 lg:grid-cols-1" : "p-4 lg:grid-cols-[1fr_260px] lg:p-5",
        )}
      >
        <div>
          <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--aster-muted)]">
            {FRENCH_WEEKDAY_SHORT.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${index}`}
                    className={compact ? "min-h-[48px]" : "min-h-[64px] sm:min-h-[72px]"}
                  />
                );
              }
              const dayEvents = byDate[day] ?? [];
              const isToday = day === today;
              const isSelected = day === selectedDate;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "flex flex-col rounded-lg border px-1.5 py-1.5 text-left transition-colors",
                    compact ? "min-h-[48px]" : "min-h-[64px] sm:min-h-[72px]",
                    isSelected
                      ? "border-[var(--aster-navy)] bg-[var(--aster-navy)] text-white"
                      : "border-[var(--aster-border)] bg-[var(--aster-workspace)]/60 hover:bg-[var(--aster-surface-2)]",
                    isToday && !isSelected && "ring-2 ring-[var(--aster-accent)]/35",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      isSelected ? "text-white" : "text-[var(--aster-ink)]",
                    )}
                  >
                    {Number(day.slice(-2))}
                  </span>
                  <div className="mt-auto flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, compact ? 3 : 4).map((event) => (
                      <span
                        key={event.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isSelected
                            ? "bg-white/90"
                            : CALENDAR_TONE_CLASSES[event.tone].dot,
                        )}
                        title={CALENDAR_TONE_CLASSES[event.tone].label}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-[var(--aster-muted)]">
            {(
              Object.keys(CALENDAR_TONE_CLASSES) as Array<
                keyof typeof CALENDAR_TONE_CLASSES
              >
            ).map((tone) => (
              <span key={tone} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    CALENDAR_TONE_CLASSES[tone].dot,
                  )}
                />
                {CALENDAR_TONE_CLASSES[tone].label}
              </span>
            ))}
          </div>
        </div>

        {!compact ? (
          <aside className="rounded-[10px] border border-[var(--aster-border)] bg-[var(--aster-workspace)] p-3">
            <p className="text-sm font-medium text-[var(--aster-ink)]">
              {selectedDate
                ? formatDateFr(selectedDate)
                : "Sélectionnez une date"}
            </p>
            <div className="mt-3 space-y-2">
              {!selectedDate ? (
                <p className="text-sm text-[var(--aster-muted)]">
                  Cliquez sur un jour pour voir le détail.
                </p>
              ) : selectedEvents.length === 0 ? (
                <p className="text-sm text-[var(--aster-muted)]">
                  Aucun événement ce jour-là.
                </p>
              ) : (
                selectedEvents.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      CALENDAR_TONE_CLASSES[event.tone].chip,
                    )}
                  >
                    <p className="font-medium">{event.title}</p>
                    {event.subtitle ? (
                      <p className="text-xs opacity-90">{event.subtitle}</p>
                    ) : null}
                    {event.employeeName ? (
                      <p className="text-xs opacity-90">{event.employeeName}</p>
                    ) : null}
                    <p className="text-[11px] opacity-80">
                      {CALENDAR_TONE_CLASSES[event.tone].label}
                    </p>
                    {event.kind === "holiday" && event.actionableHoliday ? (
                      <div className="mt-2 text-[var(--aster-ink)]">
                        <WorkOnHolidayRequestForm
                          holidayDate={event.date}
                          holidayName={event.title}
                        />
                      </div>
                    ) : null}
                    {event.kind === "work_on_holiday" ? (
                      <div className="mt-2 space-y-2 text-[var(--aster-ink)]">
                        {event.status === "approuvee" ? (
                          <WorkOnHolidayDeclareActual
                            requestId={event.sourceRequestId}
                            plannedHours={7}
                          />
                        ) : null}
                        <WorkOnHolidayChefActions
                          requestId={event.sourceRequestId}
                          status={String(event.status)}
                          actualHours={null}
                          plannedHours={7}
                          role={role}
                        />
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 border-t border-[var(--aster-border)] pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--aster-muted)]">
                Synthèse du mois
              </p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--aster-ink)]">
                <li>
                  Congés approuvés :{" "}
                  {
                    monthEvents.filter((e) => e.tone === "leave_approved")
                      .length
                  }
                </li>
                <li>
                  Congés en attente :{" "}
                  {monthEvents.filter((e) => e.tone === "leave_pending").length}
                </li>
                <li>
                  Télétravail approuvé :{" "}
                  {
                    monthEvents.filter((e) => e.tone === "telework_approved")
                      .length
                  }
                </li>
                <li>
                  Télétravail en attente :{" "}
                  {
                    monthEvents.filter((e) => e.tone === "telework_pending")
                      .length
                  }
                </li>
                <li>
                  Refus :{" "}
                  {monthEvents.filter((e) => e.tone === "rejected").length}
                </li>
              </ul>
            </div>
          </aside>
        ) : selectedDate && selectedEvents.length > 0 ? (
          <div className="space-y-2 border-t border-[var(--aster-border)] pt-3">
            <p className="text-xs font-medium text-[var(--aster-ink)]">
              {formatDateFr(selectedDate)}
            </p>
            {selectedEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs",
                  CALENDAR_TONE_CLASSES[event.tone].chip,
                )}
              >
                {event.title}
                {event.employeeName ? ` · ${event.employeeName}` : ""}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
