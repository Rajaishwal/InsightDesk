// LeaveTab.jsx — HR leave requests: summary tiles (pending, on leave today, approved, rejected), a filter bar
// (employee, status, start-date range) and the requests table with approve / reject for pending ones.
import { useEffect, useRef, useState } from "react";
import { Hourglass, Plane, CheckCircle2, XCircle, Check, X, RefreshCw, CalendarX2, AlertCircle } from "lucide-react";
import api from "../services/axios";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import StatTile from "../components/StatTile";
import PersonAvatar from "../components/PersonAvatar";
import PersonPicker from "../components/PersonPicker";
import Pagination from "../components/Pagination";

const EMPTY_FILTERS = { status: "all", userId: "", startDate: "", endDate: "", page: 1, limit: 20 };

const STATUS = {
  Pending:  { chip: "bg-amber-50 text-amber-700 ring-amber-200",       Icon: Hourglass },
  Approved: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: Check },
  Rejected: { chip: "bg-rose-50 text-rose-700 ring-rose-200",          Icon: X },
};

const TYPE_TONE = {
  "Planned Leave":         "bg-indigo-50 text-indigo-700",
  "Wellness Leave":        "bg-teal-50 text-teal-700",
  "Sick Leave":            "bg-rose-50 text-rose-700",
  "Polling Leave":         "bg-sky-50 text-sky-700",
  "Unplanned Leave (LOP)": "bg-gray-100 text-gray-700",
  "Casual Leave":          "bg-violet-50 text-violet-700",
  "Annual Leave":          "bg-blue-50 text-blue-700",
  "Maternity Leave":       "bg-pink-50 text-pink-700",
  "Paternity Leave":       "bg-cyan-50 text-cyan-700",
  "Emergency Leave":       "bg-orange-50 text-orange-700",
};

// Leave dates are stored as UTC-midnight calendar days → format them in UTC so the day never shifts
const thisYear = new Date().getFullYear();
const fmtDay = (d, withYear) =>
  new Date(d).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
const fmtRange = (s, e) => {
  const a = new Date(s), b = new Date(e);
  const withYear = a.getUTCFullYear() !== thisYear || b.getUTCFullYear() !== thisYear;
  if (a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)) return fmtDay(s, withYear);
  const short = (d) => new Date(d).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
  return `${short(s)} – ${short(e)}${withYear ? ` ${b.getUTCFullYear()}` : ""}`;
};
const ago = (d) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
};
const dayLabel = (n) => (n === 0.5 ? "½ day" : `${n} ${n === 1 ? "day" : "days"}`);
const personOf = (l) => ({ name: l.userName, photo: l.userPhoto });

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <tr key={i} className="animate-pulse">
      <td className="px-5 py-3.5"><div className="flex items-center gap-2.5"><div className="h-8 w-8 rounded-full bg-gray-100" /><div className="h-3.5 w-28 rounded bg-gray-100" /></div></td>
      {Array.from({ length: 5 }, (_, j) => <td key={j} className="px-4 py-3.5"><div className="h-3.5 w-20 rounded bg-gray-100" /></td>)}
      <td className="px-5 py-3.5"><div className="ml-auto h-7 w-36 rounded-full bg-gray-100" /></td>
    </tr>
  ));
}

export default function LeaveTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [leaves, setLeaves] = useState([]);
  const [counts, setCounts] = useState(null);
  const [pagination, setPagination] = useState({ totalPages: 1, currentPage: 1, totalRecords: 0, limit: 20 });
  const [stats, setStats] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // leaveId being approved / rejected
  const filtersRef = useRef(filters);

  const fetchLeaves = async ({ silent = false } = {}) => {
    const f = filtersRef.current;
    silent ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "" && v !== "all"));
      const [list, st] = await Promise.all([
        api.get("/leaves/hr/all-requests", { params }),
        api.get("/leaves/hr/stats"),
      ]);
      setLeaves(list.data.leaves || []);
      setCounts(list.data.counts || null);
      setPagination(list.data.pagination || { totalPages: 1, currentPage: 1, totalRecords: 0, limit: f.limit });
      setStats(st.data || null);
    } catch (err) {
      setError(!err?.response ? "Can't reach the server — make sure the backend is running." : "Couldn't load leave requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    filtersRef.current = filters;
    fetchLeaves();
  }, [filters]);

  useEffect(() => {
    api.get("/users")
      .then((r) => setPeople((Array.isArray(r.data) ? r.data : []).sort((a, b) => (a.name || "").localeCompare(b.name || ""))))
      .catch(() => setPeople([]));
  }, []);

  // A new request or a decision anywhere → refresh quietly
  useAutoRefresh(() => fetchLeaves({ silent: true }), ["crm:leave:updated"]);

  const set = (patch) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const toggleStatus = (s) => set({ status: filters.status === s ? "all" : s });
  const filtersActive = filters.status !== "all" || !!filters.userId || !!filters.startDate || !!filters.endDate;
  const clearFilters = () => setFilters((f) => ({ ...EMPTY_FILTERS, limit: f.limit }));

  const decide = async (leave, action) => {
    const approve = action === "Approved";
    const ok = await confirm({
      tone: approve ? "success" : "danger",
      title: approve ? "Approve leave?" : "Reject leave?",
      message: approve
        ? "The employee will be notified that their leave is approved."
        : "The employee will be notified that their leave is rejected.",
      confirmText: approve ? "Yes, approve" : "Yes, reject",
      details: (
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <PersonAvatar person={personOf(leave)} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800">{leave.userName}</p>
            <p className="text-xs text-gray-400">
              {leave.leaveType} · {fmtRange(leave.startDate, leave.endDate)} · {leave.halfDay ? "half day" : dayLabel(leave.totalDays)}
            </p>
          </div>
        </div>
      ),
    });
    if (!ok) return;
    try {
      setActionLoading(leave._id);
      await api.put(`/leaves/hr/status/${leave._id}`, { status: action });
      toast.success(`Leave ${action.toLowerCase()} for ${leave.userName}.`);
      await fetchLeaves({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update leave status.");
    } finally {
      setActionLoading(null);
    }
  };

  const s = stats;
  const onLeave = s?.onLeaveToday || [];
  const onLeaveNames = onLeave.map((p) => p.name?.split(" ")[0]).join(", ");
  const STATUS_TABS = [["all", "All"], ["Pending", "Pending"], ["Approved", "Approved"], ["Rejected", "Rejected"]];

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Leave requests</h2>
          <p className="mt-0.5 text-sm text-gray-500">Approve or reject requests and see who is away.</p>
        </div>
        <button type="button" onClick={() => fetchLeaves({ silent: true })} disabled={refreshing}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Summary tiles — the status ones also filter the table */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile tone="amber" Icon={Hourglass} label="Pending" value={s ? s.pendingRequests : "—"}
          sub={s?.pendingRequests ? "waiting for your decision" : "nothing waiting"}
          active={filters.status === "Pending"} onClick={() => toggleStatus("Pending")} />
        <StatTile tone="violet" Icon={Plane} label="On leave today" value={s ? onLeave.length : "—"}
          sub={onLeave.length ? onLeaveNames : "everyone is in"} />
        <StatTile tone="emerald" Icon={CheckCircle2} label="Approved" value={s ? s.approvedRequests : "—"}
          sub={s ? `${dayLabel(s.approvedDaysThisMonth)} approved this month` : " "}
          active={filters.status === "Approved"} onClick={() => toggleStatus("Approved")} />
        <StatTile tone="rose" Icon={XCircle} label="Rejected" value={s ? s.rejectedRequests : "—"}
          sub={s ? `of ${s.totalRequests} requests in total` : " "}
          active={filters.status === "Rejected"} onClick={() => toggleStatus("Rejected")} />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <PersonPicker people={people} value={filters.userId} onChange={(userId) => set({ userId })} />

        <span className="hidden h-6 w-px bg-gray-100 sm:block" />

        <div className="inline-flex rounded-full bg-gray-100 p-0.5">
          {STATUS_TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => set({ status: id })} aria-pressed={filters.status === id}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition
                ${filters.status === id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
              {counts && <span className={`tabular-nums ${filters.status === id ? "text-gray-400" : "text-gray-400/80"}`}>{counts[id]}</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Starts</span>
          <input type="date" aria-label="Starts from" value={filters.startDate} max={filters.endDate || undefined}
            onChange={(e) => set({ startDate: e.target.value })}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" aria-label="Starts until" value={filters.endDate} min={filters.startDate || undefined}
            onChange={(e) => set({ endDate: e.target.value })}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50" />
        </div>

        {filtersActive && (
          <button type="button" onClick={clearFilters} className="ml-auto text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>
        )}
      </div>

      {/* Requests */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-gray-50/80">
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <th className="px-5 py-3">Employee</th>
                <th className="px-4 py-3">Leave</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-5 py-3 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <SkeletonRows />
              ) : error ? (
                <tr>
                  <td colSpan="7" className="px-5 py-12 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
                    <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
                    <button type="button" onClick={() => fetchLeaves()} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
                      <CalendarX2 className="h-6 w-6 text-gray-300" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-gray-700">No leave requests{filtersActive ? " for these filters" : " yet"}</p>
                    {filtersActive && (
                      <button type="button" onClick={clearFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>
                    )}
                  </td>
                </tr>
              ) : (
                leaves.map((l) => {
                  const pending = l.status === "Pending";
                  const st = STATUS[l.status] || STATUS.Pending;
                  const busy = actionLoading === l._id;
                  return (
                    <tr key={l._id} className={`transition hover:bg-gray-50/70 ${pending ? "bg-amber-50/30" : ""}`}>
                      {/* Employee */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <PersonAvatar person={personOf(l)} size={32} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-800">{l.userName}</p>
                            <p className="truncate text-[11px] text-gray-400">{[l.userEmployeeId, l.userDesignation].filter(Boolean).join(" · ")}</p>
                          </div>
                        </div>
                      </td>

                      {/* Leave type */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${TYPE_TONE[l.leaveType] || "bg-gray-100 text-gray-600"}`}>
                          {l.leaveType}
                        </span>
                      </td>

                      {/* Dates */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-700">{fmtRange(l.startDate, l.endDate)}</td>

                      {/* Days */}
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm font-semibold tabular-nums text-gray-800">{dayLabel(l.totalDays)}</td>

                      {/* Reason */}
                      <td className="px-4 py-3.5">
                        <p className="max-w-[16rem] text-xs leading-relaxed text-gray-600 line-clamp-2" title={l.reason || undefined}>{l.reason || "—"}</p>
                      </td>

                      {/* Applied */}
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <p className="text-sm text-gray-700">{ago(l.appliedAt)}</p>
                        <p className="text-[11px] text-gray-400">{new Date(l.appliedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}</p>
                      </td>

                      {/* Decision */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {pending ? (
                            <>
                              <button type="button" onClick={() => decide(l, "Approved")} disabled={busy}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
                                <Check className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button type="button" onClick={() => decide(l, "Rejected")} disabled={busy}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">
                                <X className="h-3.5 w-3.5" /> Reject
                              </button>
                            </>
                          ) : (
                            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${st.chip}`}>
                              {st.Icon && <st.Icon className="h-3.5 w-3.5" />}
                              {l.status}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && (
          <Pagination currentPage={pagination.currentPage} totalPages={pagination.totalPages} totalRecords={pagination.totalRecords}
            pageSize={pagination.limit || filters.limit} shown={leaves.length} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        )}
      </div>
    </div>
  );
}
