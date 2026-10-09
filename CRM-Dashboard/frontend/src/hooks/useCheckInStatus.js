// useCheckInStatus.js — Live "is this user checked in?" for the dashboard header location badge.
// Re-checks on attendance events, when the tab becomes visible again, when the network returns,
// and every minute — so a long work session (even one running past midnight) never drifts to "Inactive".
// No cooldown: a check-in must always show up straight away. A failed request keeps the last known status.

import { useCallback, useEffect, useState } from "react";
import api from "../services/axios";

const RECHECK_MS = 60_000;
const EVENTS = ["crm:attendance:updated", "attendanceUpdate"];

/** @returns {[("checked-in"|"checked-out"|null), () => Promise<void>]} status (null until first answer) and a manual re-check */
export function useCheckInStatus(userId) {
  const [status, setStatus] = useState(null);

  const check = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await api.get(`/attendance/status/${userId}`);
      setStatus(r.data?.attendance?.status || "checked-out");
    } catch {
      // network blip — keep the last known status rather than flipping the badge
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    check();
    const timer = setInterval(check, RECHECK_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    const onStorage = (e) => { if (e.key === "attendanceEvent") check(); }; // check-in/out in another tab

    EVENTS.forEach(evt => window.addEventListener(evt, check));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(timer);
      EVENTS.forEach(evt => window.removeEventListener(evt, check));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId, check]);

  return [status, check];
}
