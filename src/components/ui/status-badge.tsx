import { statusLabel } from "@/domain/rules/approvals";
import type { RequestStatus } from "@/domain/types/hr";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: RequestStatus }) {
  const variant =
    status === "approuvee"
      ? "success"
      : status === "refusee" || status === "annulee"
        ? "danger"
        : status === "en_attente_manager" || status === "en_attente_rh"
          ? "warning"
          : "secondary";

  return <Badge variant={variant}>{statusLabel(status)}</Badge>;
}
