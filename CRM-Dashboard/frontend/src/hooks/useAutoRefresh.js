// useAutoRefresh.js — Silently re-runs fetchFn when the tab becomes visible,
// browser comes back online, or a domain event fires (e.g. "crm:attendance:updated").
// A 10-second cooldown + 300ms debounce prevents duplicate requests.
// fetchFn errors are swallowed so background failures never disturb the user.

import { useEffect, useRef, useCallback } from "react";

/**
 * @param {() => Promise<any>} fetchFn  — async function that re-fetches data
 * @param {string[]}           events   — window CustomEvent names to listen for
 */
export function useAutoRefresh(fetchFn, events = []) {
  const lastFetch  = useRef(0);          // timestamp of last successful trigger
  const timerRef   = useRef(null);       // debounce timer handle
  const fetchRef   = useRef(fetchFn);    // always holds the latest fetchFn
  const eventsRef  = useRef(events);     // captured once at mount (static list)

  // Keep fetchRef in sync without re-registering listeners
  useEffect(() => { fetchRef.current = fetchFn; });

  // Stable refresh callback: cooldown → debounce → call fetchFn
  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - lastFetch.current < 10_000) return;   // 10-second cooldown
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastFetch.current = Date.now();
      Promise.resolve(fetchRef.current()).catch(() => {}); // silent fail
    }, 300);                                               // 300ms debounce
  }, []);

  useEffect(() => {
    // 1. Tab becomes visible (covers browser tab switches, Alt+Tab back, mobile app switch)
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    // 2. Browser reconnects after losing network
    window.addEventListener("online", refresh);

    // 3. Domain-specific CustomEvents (e.g. "crm:attendance:updated")
    const evts = eventsRef.current;
    evts.forEach(evt => window.addEventListener(evt, refresh));

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      evts.forEach(evt => window.removeEventListener(evt, refresh));
      clearTimeout(timerRef.current);
    };
  }, [refresh]);
}