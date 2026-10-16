// LeaveTab.jsx — HR leave view, one card per employee: who they are, their latest approved / rejected leave and
// their totals. Employees with pending requests are always on top, first come first served (earliest applied first —
// the server orders the list). Opening a card drops down that employee's full leave history (pending first, then
// newest) — pending requests are approved or rejected right there. Summary tiles on top.
import { useEffect, useRef, useState } from "react";
import {
  Hourglass, Plane, CheckCircle2, XCircle, Check, X, RefreshCw, CalendarX2, AlertCircle, ChevronDown, Search, Users,
} from "lucide-react";
import api from "../services/axios";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import StatTile from "../components/StatTile";
import PersonAvatar from "../components/PersonAvatar";
import Tooltip from "../components/Tooltip";

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
  const a = new Date(s), b = new Date(e || s);
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

function TypeChip({ type, small }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-md font-semibold ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"} ${TYPE_TONE[type] || "bg-gray-100 text-gray-600"}`}>
      {type}
    </span>
  );
}

function StatusChip({ status, small }) {
  const st = STATUS[status] || STATUS.Pending;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold ring-1 ${small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${st.chip}`}>
      {st.Icon && <st.Icon className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />}
      {status}
    </span>
  );
}

// The dropdown: every request of this employee — pending first, then newest first; pending ones can be decided here
function HistoryList({ history, busyId, onDecide }) {
  if (!history || history.loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-gray-100" />)}
      </div>
    );
  }
  if (history.error) return <p className="text-sm text-gray-500">Couldn't load this leave history.</p>;
  if (!history.leaves.length) return <p className="text-sm text-gray-400">No leave requests yet.</p>;

  return (
    <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-100 bg-white">
      {history.leaves.map((l) => {
        const pending = l.status === "Pending";
        return (
          <li key={l._id} className={`grid items-center gap-x-3 gap-y-1 px-3 py-1.5 md:grid-cols-[120px_130px_52px_minmax(0,1fr)_100px_auto] ${pending ? "bg-amber-50/40" : ""}`}>
            <span className="text-xs font-medium text-gray-800">{fmtRange(l.startDate, l.endDate)}</span>
            <span><TypeChip type={l.leaveType} small /></span>
            <span className="text-xs font-semibold tabular-nums text-gray-700">{dayLabel(l.totalDays)}</span>
            <Tooltip text={l.reason || undefined}><span className="truncate text-[11px] text-gray-500">{l.reason || "—"}</span></Tooltip>
            <Tooltip text={new Date(l.appliedAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })}><span className="text-[10px] text-gray-400">
              applied {ago(l.appliedAt)}
            </span></Tooltip>
            <span className="flex items-center gap-1.5 md:justify-end">
              {pending ? (
                <>
                  <button type="button" onClick={() => onDecide(l, "Approved")} disabled={busyId === l._id}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button type="button" onClick={() => onDecide(l, "Rejected")} disabled={busyId === l._id}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">
                    <X className="h-3 w-3" /> Reject
                  </button>
                </>
              ) : (
                <StatusChip status={l.status} small />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// One employee: header bar (click to open) + their history underneath when open
function EmployeeCard({ emp, open, onToggle, history, busyId, onDecide }) {
  const d = emp.latestDecided;
  const c = emp.counts;
  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${open ? "border-indigo-200 shadow-md" : c.pending > 0 ? "border-amber-200 hover:shadow-md" : "border-gray-100 hover:shadow-md"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="grid w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left lg:grid-cols-[minmax(220px,1fr)_minmax(280px,1.4fr)_minmax(150px,0.7fr)_auto]">
        {/* Who */}
        <span className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar person={emp} size={32} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold text-gray-900">{emp.name}</span>
              {c.pending > 0 && (
                <Tooltip text="Waiting for a decision — earliest applied is shown first"><span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-px text-[9.5px] font-bold text-amber-700">
                  <Hourglass className="h-2.5 w-2.5" /> {c.pending} pending
                  {emp.pendingSince && (
                    <span className="font-semibold text-amber-600/90">
                      · applied {new Date(emp.pendingSince).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}
                    </span>
                  )}
                </span></Tooltip>
              )}
            </span>
            <span className="block truncate text-[10.5px] text-gray-400">
              {emp.former ? "No longer in the employee list" : [emp.employeeId, emp.designation].filter(Boolean).join(" · ") || emp.email}
            </span>
          </span>
        </span>

        {/* Latest approved / rejected leave */}
        <span className="min-w-0">
          <span className="block text-[9px] font-bold uppercase tracking-widest text-gray-400">Latest decision</span>
          {d ? (
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <TypeChip type={d.leaveType} small />
              <span className="text-xs text-gray-700">{fmtRange(d.startDate, d.endDate)}</span>
              <span className="text-[11px] text-gray-400">· {dayLabel(d.totalDays)}</span>
              <StatusChip status={d.status} small />
            </span>
          ) : (
            <span className="mt-0.5 block text-xs text-gray-400">No approved or rejected leave yet</span>
          )}
        </span>

        {/* Totals */}
        <span className="text-[11px]">
          <span className="block text-[9px] font-bold uppercase tracking-widest text-gray-400">Requests</span>
          <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <span className="text-emerald-700"><span className="font-semibold">{c.approved}</span> approved</span>
            <span className="text-rose-600"><span className="font-semibold">{c.rejected}</span> rejected</span>
          </span>
          <span className="text-[10px] text-gray-400">{dayLabel(emp.approvedDaysThisYear)} off this year</span>
        </span>

        {/* Open / close */}
        <span className={`hidden h-7 w-7 items-center justify-center justify-self-end rounded-full transition lg:flex ${open ? "bg-indigo-50 text-indigo-600" : "text-gray-400"}`}>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
            Leave history · {c.total} {c.total === 1 ? "request" : "requests"}
          </p>
          <HistoryList history={history} busyId={busyId} onDecide={onDecide} />
        </div>
      )}
    </div>
  );
}

export default function LeaveTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [openId, setOpenId] = useState(null);       // employee whose history is open
  const [history, setHistory] = useState({});       // { userId: { loading, error, leaves } }
  const [busyId, setBusyId] = useState(null);       // leave being approved / rejected
  const openIdRef = useRef(openId);
  openIdRef.current = openId;

  const fetchAll = async ({ silent = false } = {}) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      // The server orders employees: waiting for a decision first (earliest applied first), then the rest
      const [emps, st] = await Promise.all([api.get("/leaves/hr/employees"), api.get("/leaves/hr/stats")]);
      setEmployees(emps.data.employees || []);
      setStats(st.data || null);
    } catch (err) {
      setError(!err?.response ? "Can't reach the server — make sure the backend is running." : "Couldn't load leave data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Every request of one employee, newest first
  const loadHistory = async (userId) => {
    setHistory((h) => ({ ...h, [userId]: { loading: true, leaves: h[userId]?.leaves || [] } }));
    try {
      const { data } = await api.get("/leaves/hr/all-requests", { params: { userId, limit: 100 } });
      const leaves = (data.leaves || []).sort((a, b) =>
        (b.status === "Pending") - (a.status === "Pending") || new Date(b.startDate) - new Date(a.startDate));
      setHistory((h) => ({ ...h, [userId]: { loading: false, leaves } }));
    } catch {
      setHistory((h) => ({ ...h, [userId]: { loading: false, error: true, leaves: [] } }));
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // A new request or a decision anywhere → refresh quietly (and the open history)
  useAutoRefresh(() => {
    fetchAll({ silent: true });
    if (openIdRef.current) loadHistory(openIdRef.current);
  }, ["crm:leave:updated"]);

  const toggle = (emp) => {
    const id = String(emp._id);
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    loadHistory(id);
  };

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
          <PersonAvatar person={{ name: leave.userName, photo: leave.userPhoto }} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800">{leave.userName}</p>
            <p className="text-xs text-gray-400">{leave.leaveType} · {fmtRange(leave.startDate, leave.endDate)} · {dayLabel(leave.totalDays)}</p>
          </div>
        </div>
      ),
    });
    if (!ok) return;
    try {
      setBusyId(leave._id);
      await api.put(`/leaves/hr/status/${leave._id}`, { status: action });
      toast.success(`Leave ${action.toLowerCase()} for ${leave.userName}.`);
      const uid = String(leave.userId?._id || leave.userId);
      await Promise.all([fetchAll({ silent: true }), loadHistory(uid)]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update leave status.");
    } finally {
      setBusyId(null);
    }
  };

  const s = stats;
  const onLeave = s?.onLeaveToday || [];
  const pendingPeople = employees.filter((e) => e.counts.pending > 0).length;
  const q = search.trim().toLowerCase();
  const visible = employees
    .filter((e) => !onlyPending || e.counts.pending > 0)
    .filter((e) => !q || [e.name, e.employeeId, e.email].some((v) => (v || "").toLowerCase().includes(q)));

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Leave</h2>
          <p className="mt-0.5 text-sm text-gray-500">Employees waiting for a decision come first — earliest applied first. Open anyone to see their full history.</p>
        </div>
        <button type="button" onClick={() => { fetchAll({ silent: true }); if (openId) loadHistory(openId); }} disabled={refreshing}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile tone="amber" Icon={Hourglass} label="Pending" value={s ? s.pendingRequests : "—"}
          sub={s?.pendingRequests ? "waiting for your decision" : "nothing waiting"}
          active={onlyPending} onClick={() => setOnlyPending((v) => !v)} />
        <StatTile tone="violet" Icon={Plane} label="On leave today" value={s ? onLeave.length : "—"}
          sub={onLeave.length ? onLeave.map((p) => p.name?.split(" ")[0]).join(", ") : "everyone is in"} />
        <StatTile tone="emerald" Icon={CheckCircle2} label="Approved" value={s ? s.approvedRequests : "—"}
          sub={s ? `${dayLabel(s.approvedDaysThisMonth)} approved this month` : " "} />
        <StatTile tone="rose" Icon={XCircle} label="Rejected" value={s ? s.rejectedRequests : "—"}
          sub={s ? `of ${s.totalRequests} requests in total` : " "} />
      </div>

      {/* Search + pending switch */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
          <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find an employee by name, ID or email…"
            className="w-full min-w-0 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
          {search && (
            <Tooltip text="Clear search"><button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button></Tooltip>
          )}
        </div>
        <div className="inline-flex rounded-full bg-gray-100 p-0.5">
          {[[false, "All employees", employees.length], [true, "Waiting for decision", pendingPeople]].map(([val, label, n]) => (
            <button key={label} type="button" onClick={() => setOnlyPending(val)} aria-pressed={onlyPending === val}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition
                ${onlyPending === val ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label} <span className="tabular-nums text-gray-400">{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Employee cards */}
      {error && !employees.length ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
          <button type="button" onClick={() => fetchAll()} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[58px] animate-pulse rounded-xl border border-gray-100 bg-white" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
            {employees.length ? <Users className="h-6 w-6 text-gray-300" /> : <CalendarX2 className="h-6 w-6 text-gray-300" />}
          </div>
          <p className="mt-3 text-sm font-medium text-gray-700">{employees.length ? "No one matches" : "No employees yet"}</p>
          {(q || onlyPending) && (
            <button type="button" onClick={() => { setSearch(""); setOnlyPending(false); }} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Show everyone</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((emp) => (
            <EmployeeCard
              key={emp._id}
              emp={emp}
              open={openId === String(emp._id)}
              onToggle={() => toggle(emp)}
              history={history[String(emp._id)]}
              busyId={busyId}
              onDecide={decide}
            />
          ))}
        </div>
      )}
    </div>
  );
}
