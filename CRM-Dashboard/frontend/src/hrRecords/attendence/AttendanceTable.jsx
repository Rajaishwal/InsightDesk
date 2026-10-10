// AttendanceTable.jsx — HR attendance table: employee, day, check-in/out, working hours (live while working),
// task time and breaks for that session, and a status chip. Task & break figures come from the server per record.
import { useState, useEffect } from "react";
import { AlertCircle, CalendarX2, ChevronLeft, ChevronRight, Moon } from "lucide-react";
import PersonAvatar from "../../components/PersonAvatar";

const TZ = "Asia/Kolkata";
const FULL_DAY_SECS = 8 * 3600; // the working-hours bar fills at 8h; longer days are flagged as overtime

/* Seconds → "5h 14m" / "41m" / "<1m" / "0m" */
const fmtDur = (secs) => {
  if (secs > 0 && secs < 60) return "<1m";
  const total = Math.max(0, Math.floor((secs || 0) / 60));
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d));

/* "2026-10-11" → { main: "Sat, 11 Oct", tag: "Today" | "Yesterday" | "" } */
const fmtDay = (key) => {
  const d = new Date(`${key}T00:00:00+05:30`);
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  return {
    main: d.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) }),
    tag: key === today ? "Today" : key === yesterday ? "Yesterday" : "",
  };
};

const STATE = {
  "working":         { label: "Working",      chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500 animate-pulse" },
  "on-break":        { label: "On break",     chip: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500 animate-pulse" },
  "checked-out":     { label: "Checked out",  chip: "bg-gray-50 text-gray-600 ring-gray-200",          dot: "bg-gray-400" },
  "missed-checkout": { label: "No check-out", chip: "bg-rose-50 text-rose-700 ring-rose-200",          dot: "bg-rose-500" },
};

function SkeletonRows({ n = 6 }) {
  return Array.from({ length: n }, (_, i) => (
    <tr key={i} className="animate-pulse">
      <td className="px-5 py-3.5"><div className="flex items-center gap-2.5"><div className="h-8 w-8 rounded-full bg-gray-100" /><div className="h-3.5 w-28 rounded bg-gray-100" /></div></td>
      {Array.from({ length: 6 }, (_, j) => <td key={j} className="px-4 py-3.5"><div className="h-3.5 w-16 rounded bg-gray-100" /></td>)}
      <td className="px-5 py-3.5"><div className="h-6 w-24 rounded-full bg-gray-100" /></td>
    </tr>
  ));
}

// Page numbers with gaps: 1 … 4 5 6 … 14
const pageList = (cur, last) => {
  const set = new Set([1, last, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= last));
  const out = [];
  [...set].sort((a, b) => a - b).forEach((p, i, arr) => { if (i && p - arr[i - 1] > 1) out.push("…"); out.push(p); });
  return out;
};

const AttendanceTable = ({ data, loading, error, onRetry, pagination, onPage, filtersActive, onClearFilters }) => {
  const [now, setNow] = useState(Date.now());

  // Tick every second while someone on this page is still working, so their hours count up live
  useEffect(() => {
    if (!data.some((r) => r.state === "working" || r.state === "on-break")) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [data]);

  const { currentPage = 1, totalPages = 1, totalRecords = 0, limit = data.length } = pagination;
  const from = totalRecords ? (currentPage - 1) * limit + 1 : 0;
  const to = Math.min(totalRecords, from + data.length - 1);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px]">
          <thead className="bg-gray-50/80">
            <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <th className="px-5 py-3">Employee</th>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Check in</th>
              <th className="px-4 py-3">Check out</th>
              <th className="px-4 py-3">Working hours</th>
              <th className="px-4 py-3">Task time</th>
              <th className="px-4 py-3">Break</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <SkeletonRows />
            ) : error ? (
              <tr>
                <td colSpan="8" className="px-5 py-12 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
                  <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
                  <button type="button" onClick={onRetry} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
                    <CalendarX2 className="h-6 w-6 text-gray-300" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-700">No attendance records{filtersActive ? " for these filters" : " yet"}</p>
                  {filtersActive && (
                    <button type="button" onClick={onClearFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>
                  )}
                </td>
              </tr>
            ) : (
              data.map((r) => {
                const live = r.state === "working" || r.state === "on-break";
                const missed = r.state === "missed-checkout";
                const workSecs = live
                  ? Math.max(0, (now - new Date(r.checkInTime).getTime()) / 1000)
                  : (r.workingHours || 0) * 3600;
                const overtime = !live && workSecs > FULL_DAY_SECS;
                const day = fmtDay(r.date);
                const nextDayOut = r.checkOutTime && dayKey(r.checkOutTime) !== r.date;
                const taskShare = workSecs > 0 && r.taskSeconds > 0 ? Math.round((r.taskSeconds / workSecs) * 100) : null;
                const st = STATE[r.state] || STATE["checked-out"];
                const person = r.userId && typeof r.userId === "object" ? r.userId : null;

                return (
                  <tr key={r._id} className="transition hover:bg-gray-50/70">
                    {/* Employee */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <PersonAvatar person={person} name={r.userName} size={32} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800">{person?.name || r.userName}</p>
                          <p className="truncate text-[11px] text-gray-400">{[person?.employeeId, person?.designation].filter(Boolean).join(" · ") || person?.role}</p>
                        </div>
                      </div>
                    </td>

                    {/* Day */}
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <p className="text-sm text-gray-700">{day.main}</p>
                      {day.tag && <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">{day.tag}</p>}
                    </td>

                    {/* Check in / out */}
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-gray-700">{fmtTime(r.checkInTime)}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums">
                      {r.checkOutTime ? (
                        <span className="inline-flex items-center gap-1 text-gray-700">
                          {fmtTime(r.checkOutTime)}
                          {nextDayOut && (
                            <span title="Checked out the next day" className="inline-flex items-center gap-0.5 rounded bg-indigo-50 px-1 text-[10px] font-semibold text-indigo-600">
                              <Moon className="h-2.5 w-2.5" />+1
                            </span>
                          )}
                        </span>
                      ) : live ? (
                        <span className="text-xs text-gray-400">still in</span>
                      ) : (
                        <span className="text-xs text-rose-500">not recorded</span>
                      )}
                    </td>

                    {/* Working hours */}
                    <td className="px-4 py-3.5">
                      {missed ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <div className="w-32">
                          <p className={`text-sm font-semibold tabular-nums ${live ? "text-blue-600" : overtime ? "text-amber-600" : "text-gray-800"}`}
                            title={overtime ? "More than 8 hours" : undefined}>
                            {fmtDur(workSecs)}
                          </p>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                            <div className={`h-full rounded-full ${live ? "bg-blue-500" : overtime ? "bg-amber-400" : "bg-emerald-500"}`}
                              style={{ width: `${Math.min(100, (workSecs / FULL_DAY_SECS) * 100)}%` }} />
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Task time */}
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {r.taskSeconds > 0 ? (
                        <>
                          <p className="text-sm font-semibold tabular-nums text-indigo-600">{fmtDur(r.taskSeconds)}</p>
                          {taskShare !== null && <p className="text-[11px] text-gray-400">{Math.min(100, taskShare)}% of the day</p>}
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Break */}
                    <td className="whitespace-nowrap px-4 py-3.5">
                      {r.breakSeconds > 0 ? (
                        <span className={`text-sm font-semibold tabular-nums ${r.breakSeconds > 3600 ? "text-rose-600" : "text-gray-700"}`}
                          title={r.breakSeconds > 3600 ? "Longer than an hour" : undefined}>
                          {fmtDur(r.breakSeconds)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${st.chip}`}
                        title={missed ? "This session was never checked out" : undefined}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && !error && totalRecords > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{from}–{to}</span> of <span className="font-semibold text-gray-700">{totalRecords}</span>
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => onPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="Previous page"
                className="cursor-pointer rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageList(currentPage, totalPages).map((p, i) =>
                p === "…" ? (
                  <span key={`gap${i}`} className="px-1 text-xs text-gray-400">…</span>
                ) : (
                  <button key={p} type="button" onClick={() => onPage(p)} aria-current={p === currentPage ? "page" : undefined}
                    className={`h-7 min-w-7 cursor-pointer rounded-full px-2 text-xs font-semibold tabular-nums transition
                      ${p === currentPage ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                    {p}
                  </button>
                )
              )}
              <button type="button" onClick={() => onPage(currentPage + 1)} disabled={currentPage >= totalPages} aria-label="Next page"
                className="cursor-pointer rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendanceTable;
