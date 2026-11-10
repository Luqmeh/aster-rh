import type { LeaveRequestApprovalContext } from "@/application/services/leave-approval-context-service";
import { ApprovalButtons } from "@/components/modules/approval-buttons";
import { EmployeeLeaveContextPanel } from "@/components/modules/employee-leave-context-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { leaveTypeLabel } from "@/domain/rules/leave";
import type { LeaveRequest } from "@/domain/types/hr";
import { formatDateFr } from "@/lib/utils";

export function PendingLeaveRequestCard({
  request,
  context,
  canDecide,
}: {
  request: LeaveRequest;
  context: LeaveRequestApprovalContext | undefined;
  canDecide: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--aster-border)] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--aster-ink)]">
            {context?.employee.fullName ?? request.employeeId}
          </p>
          <p className="text-xs text-[var(--aster-muted)]">
            {leaveTypeLabel(request.type)} · {formatDateFr(request.startDate)} →{" "}
            {formatDateFr(request.endDate)} · {request.daysCount} j
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {context ? (
        <EmployeeLeaveContextPanel context={context} compact />
      ) : (
        <p className="mt-2 text-xs text-[var(--aster-muted)]">
          Contexte collaborateur indisponible.
        </p>
      )}

      {canDecide ? (
        <div className="mt-3">
          <ApprovalButtons kind="leave" requestId={request.id} />
        </div>
      ) : null}
    </div>
  );
}
