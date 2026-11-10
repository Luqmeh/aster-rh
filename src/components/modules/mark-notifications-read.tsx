"use client";

import { useEffect, useRef } from "react";
import { markNotificationsReadAction } from "@/app/actions/notifications";

/** Marque automatiquement les notifications non lues à l'ouverture de la page. */
export function MarkNotificationsRead({ unread }: { unread: number }) {
  const ran = useRef(false);
  useEffect(() => {
    if (unread <= 0 || ran.current) return;
    ran.current = true;
    void markNotificationsReadAction();
  }, [unread]);
  return null;
}
