// LeaveManagement.jsx — Employee: my leave balance (one ring per leave type), my next leave, and my requests
// (filter by status, cancel while pending). "Request leave" opens the form: type cards show what's left,
// dates skip weekends, half-day for every type except Polling Leave.
import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw, Plus, X, CalendarDays, CalendarClock, FileText, Loader2, AlertCircle, CalendarX2, Info,
} from "lucide-react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { getCache, setCache } from "../utils/pageCache";
import LeaveDonutChart from "../components/LeaveDonutChart";
import { LEAVE_TYPES, LEAVE_TYPE_KEYS, normalizeType } from "../utils/leaveTypes";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Tooltip from "../components/Tooltip";

const TYPE = Object.fromEntries(LEAVE_TYPES.map((t) => [t.key, t]));
const HALF_DAY_TYPES = ["Planned Leave", "Wellness Leave", "Unplanned Leave (LOP)"]; // not Polling Leave
const shortName = (k) => (k || "").replace(" (LOP)", "");

const STATUS = {
  Pending:  "bg-amber-50 text-amber-700 ring-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 ring-rose-200",
};

// Leave days are stored as calendar days at UTC midnight — format them in UTC so they never shift
const fmtDay = (d, opts = { day: "numeric", month: "short", year: "numeric" }) => new Date(d).toLocaleDateString("en-GB", { timeZone: "UTC", ...opts });
const fmtRange = (l) => {
  const s = new Date(l.startDate), e = new Date(l.endDate);
  if (s.toISOString().slice(0, 10) === e.toISOString().slice(0, 10)) return fmtDay(s, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  return `${fmtDay(s, sameYear ? { day: "numeric", month: "short" } : undefined)} – ${fmtDay(e)}`;
};
const fmtStamp = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const daysLabel = (l) => (l.halfDay ? "½ day" : `${l.totalDays} ${l.totalDays === 1 ? "day" : "days"}`);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Date helpers for the form (weekends are skipped; earliest start is the next working day after today)
const isWeekend = (d) => { const day = new Date(d).getDay(); return day === 0 || day === 6; };
const nextWorkingDay = (d) => {
  const date = new Date(d);
  while (isWeekend(date.toISOString().split("T")[0])) date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
};
const calcWorkingDays = (start, end) => {
  if (!start || !end) return 0;
  let count = 0;
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};
const minDate = () => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return nextWorkingDay(t.toISOString().split("T")[0]);
};

// Balance per type for this year — same accrual rules as the HR view & Employee Report
function useBalances(leaves) {
  return useMemo(() => {
    const year = new Date().getFullYear();
    const months = new Date().getMonth() + 1;
    return LEAVE_TYPES.map((t) => {
      let used = 0, pending = 0;
      leaves.forEach((l) => {
        if (normalizeType(l.leaveType) !== t.key || new Date(l.startDate).getUTCFullYear() !== year) return;
        if (l.status === "Approved") used += l.totalDays || 0;
        else if (l.status === "Pending") pending += l.totalDays || 0;
      });
      const available = t.monthly > 0 ? Math.min(t.monthly * months, t.yearly) : t.yearly;
      return { ...t, used, pending, available, left: Math.max(0, available - used - pending) };
    });
  }, [leaves]);
}

function Label({ icon: Icon, children }) {
  return <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">{Icon && <Icon className="h-3.5 w-3.5" />}{children}</p>;
}

const EMPTY = { startDate: "", endDate: "", leaveType: LEAVE_TYPE_KEYS[0], reason: "", halfDay: false };

function RequestForm({ balances, monthLeft, onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(""); };

  const days = form.halfDay ? 0.5 : calcWorkingDays(form.startDate, form.endDate);

  // Date-picker hints — or the reason a picked date isn't allowed
  const earliest = minDate();
  const fmtPick = (d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const startTip = form.startDate && form.startDate < earliest
    ? `Leave can start from ${fmtPick(earliest)} at the earliest`
    : `First day of your leave — the earliest is ${fmtPick(earliest)}. Weekends are skipped.`;
  const endTip = form.halfDay ? "Half day — it ends the same day it starts"
    : form.startDate && form.endDate && form.endDate < form.startDate ? "The last day can't be before the first day"
    : "Last day of your leave — weekends in between aren't counted";
  const bal = balances.find((b) => b.key === form.leaveType);
  const overType = days > 0 && bal && days > bal.left;

  const onDate = (field, val) => {
    if (!val) return set({ [field]: "" });
    const v = isWeekend(val) ? nextWorkingDay(val) : val;
    if (field === "startDate") set({ startDate: v, ...(form.halfDay || (form.endDate && form.endDate < v) ? { endDate: v } : {}) });
    else set({ endDate: v });
  };

  const pickType = (k) => set({ leaveType: k, halfDay: HALF_DAY_TYPES.includes(k) ? form.halfDay : false });

  // ← → ↑ ↓ move between the leave-type cards
  const onTypeKey = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = LEAVE_TYPE_KEYS.indexOf(form.leaveType);
    const next = LEAVE_TYPE_KEYS[(i + step + LEAVE_TYPE_KEYS.length) % LEAVE_TYPE_KEYS.length];
    pickType(next);
    e.currentTarget.querySelector(`[data-type="${next}"]`)?.focus();
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.startDate || (!form.halfDay && !form.endDate)) return setError("Choose the start and end dates.");
    if (!form.halfDay && form.endDate < form.startDate) return setError("The end date can't be before the start date.");
    setSaving(true);
    try {
      await api.post("/leaves/apply", {
        startDate: form.startDate,
        endDate: form.halfDay ? form.startDate : form.endDate,
        leaveType: form.leaveType,
        reason: form.reason.trim(),
        halfDay: form.halfDay,
      });
      toast.success("Leave request sent to HR.");
      onDone();
    } catch (err) {
      setError(!err?.response ? "Can't reach the server — make sure the backend is running." : err.response.data?.message || "Couldn't send the request.");
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = "h-10 w-full rounded-xl border border-gray-200 bg-gray-50/70 px-3 text-sm text-gray-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="animate-dialog-in flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="h-1 flex-shrink-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400" />
        <div className="flex items-start gap-3 px-6 pt-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50"><CalendarDays className="h-5 w-5 text-indigo-600" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900">Request leave</h2>
            <p className="text-sm text-gray-500">HR will approve or reject it — you'll be notified either way.</p>
          </div>
          <Tooltip text="Close"><button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-4 w-4" /></button></Tooltip>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Type */}
          <div>
            <Label>Leave type</Label>
            <div role="radiogroup" aria-label="Leave type" onKeyDown={onTypeKey} className="grid grid-cols-2 gap-2">
              {balances.map((b) => {
                const on = form.leaveType === b.key;
                return (
                  <button key={b.key} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-type={b.key} onClick={() => pickType(b.key)}
                    className={`rounded-xl px-3 py-2.5 text-left ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${on ? "bg-white shadow-sm" : "bg-gray-50 ring-gray-100 hover:bg-gray-100"}`}
                    style={on ? { boxShadow: `inset 0 0 0 2px ${b.color}` } : undefined}>
                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.color }} />
                      {shortName(b.key)}
                      {b.key.includes("LOP") && <span className="text-[10px] font-medium text-gray-400">LOP</span>}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-gray-500">{b.left} of {plural(b.available, "day")} left</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label icon={CalendarDays}>From</Label>
              <Tooltip text={startTip} align="start" full>
                <input type="date" value={form.startDate} min={earliest} onChange={(e) => onDate("startDate", e.target.value)} className={fieldCls} />
              </Tooltip>
            </div>
            <div>
              <Label icon={CalendarDays}>To</Label>
              <Tooltip text={endTip} align="start" full>
                <input type="date" value={form.halfDay ? form.startDate : form.endDate} min={form.startDate || earliest} disabled={form.halfDay}
                  onChange={(e) => onDate("endDate", e.target.value)} className={fieldCls} />
              </Tooltip>
            </div>
          </div>

          {/* Half day */}
          {HALF_DAY_TYPES.includes(form.leaveType) && (
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-gray-100">
              <span>
                <span className="block text-sm font-semibold text-gray-800">Half day</span>
                <span className="block text-xs text-gray-500">Counts as 0.5 days — the end date is the same as the start.</span>
              </span>
              <input type="checkbox" className="peer sr-only" checked={form.halfDay}
                onChange={(e) => set({ halfDay: e.target.checked, ...(e.target.checked && form.startDate ? { endDate: form.startDate } : {}) })} />
              <span className="relative h-6 w-11 flex-shrink-0 rounded-full bg-gray-200 transition peer-checked:bg-indigo-500 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
            </label>
          )}

          {/* Summary */}
          {form.startDate && (form.halfDay || form.endDate) && (
            <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ${overType ? "bg-amber-50 ring-amber-100" : "bg-indigo-50/60 ring-indigo-100"}`}>
              <span className={`text-2xl font-black tabular-nums ${overType ? "text-amber-600" : "text-indigo-600"}`}>{form.halfDay ? "½" : days}</span>
              <span className="text-sm text-gray-600">
                {form.halfDay ? "half day" : `working ${days === 1 ? "day" : "days"}`} of {shortName(form.leaveType).toLowerCase()}
                {!form.halfDay && <span className="text-gray-400"> · weekends not counted</span>}
                {overType && <span className="block text-xs text-amber-700">More than the {bal.left} days you have left for this type.</span>}
              </span>
            </div>
          )}

          {/* Reason */}
          <div>
            <Label icon={FileText}>Reason <span className="font-medium normal-case tracking-normal text-gray-300">— optional</span></Label>
            <textarea rows={3} maxLength={500} value={form.reason} onChange={(e) => set({ reason: e.target.value })}
              placeholder="A short note for HR…"
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50" />
          </div>

          {monthLeft != null && (
            <p className="flex items-start gap-1.5 text-[11px] text-gray-500">
              <Info className="mt-px h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
              You can request up to {monthLeft} more {monthLeft === 1 ? "day" : "days"} this month (monthly allowance incl. carried-forward days).
            </p>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Send request
          </button>
        </div>
      </form>
    </div>
  );
}

const PAGE = 8;

export default function LeaveManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [leaves, setLeaves]         = useState(getCache("leaves") || []);
  const [loading, setLoading]       = useState(!getCache("leaves"));
  const [error, setError]           = useState("");
  const [stats, setStats]           = useState(getCache("leave-stats") || null);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [filter, setFilter]         = useState("all");
  const [shown, setShown]           = useState(PAGE);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchLeaves = async () => {
    try {
      const { data } = await api.get("/leaves/my-leaves", { params: { limit: 500 } });
      const list = data.leaves || [];
      setLeaves(list);
      setCache("leaves", list);
      setError("");
    } catch (err) {
      if (!getCache("leaves")) setError(!err?.response ? "Can't reach the server — make sure the backend is running." : "Couldn't load your leave requests.");
    } finally {
      setLoading(false);
    }
  };
  const fetchStats = async () => {
    try {
      const { data } = await api.get("/leaves/stats");
      setStats(data);
      setCache("leave-stats", data);
    } catch { /* the balance rings don't depend on it */ }
  };
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLeaves(), fetchStats()]);
    setRefreshing(false);
  };

  useEffect(() => { if (user) { fetchLeaves(); fetchStats(); } }, [user]);
  useAutoRefresh(() => Promise.all([fetchLeaves(), fetchStats()]), ["crm:leave:updated"]);

  const balances = useBalances(leaves);
  const sorted = useMemo(() => [...leaves].sort((a, b) => new Date(b.appliedAt || b.createdAt) - new Date(a.appliedAt || a.createdAt)), [leaves]);
  const counts = useMemo(() => {
    const c = { all: leaves.length, Pending: 0, Approved: 0, Rejected: 0 };
    leaves.forEach((l) => { c[l.status] = (c[l.status] || 0) + 1; });
    return c;
  }, [leaves]);
  const visible = sorted.filter((l) => filter === "all" || l.status === filter);

  // The next leave that hasn't ended yet (approved or still waiting)
  const today = new Date().toLocaleDateString("en-CA");
  const next = [...leaves]
    .filter((l) => l.status !== "Rejected" && new Date(l.endDate).toISOString().slice(0, 10) >= today)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0];

  const year = new Date().getFullYear();
  const takenThisYear = balances.reduce((n, b) => n + b.used, 0);
  const pendingThisYear = balances.reduce((n, b) => n + b.pending, 0);
  const monthLeft = stats?.monthlyAllocation ? Math.max(0, stats.monthlyAllocation.remainingLeaves) : null;

  const cancel = async (l) => {
    const ok = await confirm({
      tone: "danger",
      title: "Cancel this leave request?",
      message: `${shortName(normalizeType(l.leaveType))} · ${fmtRange(l)} (${daysLabel(l)}) will be withdrawn. You can apply again later.`,
      confirmText: "Yes, cancel it",
      cancelText: "Keep it",
    });
    if (!ok) return;
    setCancellingId(l._id);
    try {
      await api.delete(`/leaves/cancel/${l._id}`);
      toast.success("Leave request cancelled.");
      window.dispatchEvent(new CustomEvent("crm:leave:updated"));
      await Promise.all([fetchLeaves(), fetchStats()]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't cancel the request.");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            {loading ? "Your leave balance and requests." : <>In {year}: <span className="font-semibold text-gray-700">{plural(takenThisYear, "day")}</span> taken{pendingThisYear ? <>, <span className="font-semibold text-amber-600">{pendingThisYear}</span> waiting for approval</> : null}.</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip text="Refresh"><button type="button" onClick={refresh} disabled={refreshing} aria-label="Refresh"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:text-indigo-600 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button></Tooltip>
          <button type="button" onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900">
            <Plus className="h-4 w-4" /> Request leave
          </button>
        </div>
      </div>

      {/* Yearly leave breakdown — one donut per type (hover for available / remaining / acquired) */}
      <LeaveDonutChart leaves={leaves} className="mb-5" />

      {/* Next leave */}
      {next && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm"><CalendarClock className="h-4.5 w-4.5" /></div>
          <p className="min-w-0 flex-1 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">Next leave:</span> {fmtRange(next)} · {shortName(normalizeType(next.leaveType))} · {daysLabel(next)}
          </p>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS[next.status]}`}>{next.status === "Pending" ? "Waiting for approval" : "Approved"}</span>
        </div>
      )}

      {/* Requests */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-gray-900">My requests</h2>
          <div className="flex flex-wrap gap-1.5">
            {[["all", "All"], ["Pending", "Pending"], ["Approved", "Approved"], ["Rejected", "Rejected"]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => { setFilter(k); setShown(PAGE); }} aria-pressed={filter === k}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${filter === k ? "bg-gray-800 text-white" : "bg-gray-50 text-gray-500 ring-1 ring-gray-200 hover:text-gray-700"}`}>
                {label} <span className={filter === k ? "text-gray-300" : "text-gray-400"}>{counts[k] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                <div className="h-11 w-11 rounded-xl bg-gray-100" />
                <div className="flex-1 space-y-2"><div className="h-3.5 w-40 rounded bg-gray-100" /><div className="h-3 w-64 rounded bg-gray-100" /></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
            <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
            <button type="button" onClick={() => { setLoading(true); fetchLeaves(); }} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><CalendarX2 className="h-6 w-6 text-gray-300" /></div>
            <p className="mt-3 text-sm font-medium text-gray-700">{leaves.length ? `No ${filter.toLowerCase()} requests` : "No leave requests yet"}</p>
            {!leaves.length && <button type="button" onClick={() => setShowForm(true)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Request your first leave</button>}
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {visible.slice(0, shown).map((l) => {
              const t = TYPE[normalizeType(l.leaveType)] || { color: "#9ca3af" };
              const start = new Date(l.startDate);
              const note = l.status === "Rejected" ? l.rejectionReason || l.hrComments : l.hrComments;
              return (
                <li key={l._id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-gray-50/60">
                  <div className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-xl ring-1 ring-inset"
                    style={{ backgroundColor: `${t.color}12`, color: t.color, "--tw-ring-color": `${t.color}33` }}>
                    <span className="text-base font-black leading-none">{start.getUTCDate()}</span>
                    <span className="text-[9px] font-bold uppercase leading-tight">{fmtDay(start, { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm">
                      <Tooltip text={normalizeType(l.leaveType) !== l.leaveType ? `Applied as “${l.leaveType}”` : undefined}><span className="font-semibold text-gray-800">{shortName(normalizeType(l.leaveType))}</span></Tooltip>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-600">{fmtRange(l)}</span>
                      <span className={`rounded-full px-2 py-px text-[11px] font-semibold ${l.halfDay ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-600"}`}>{daysLabel(l)}</span>
                    </p>
                    <Tooltip text={l.reason}><p className="mt-0.5 truncate text-xs text-gray-500">{l.reason?.trim() ? `“${l.reason.trim()}”` : <span className="text-gray-300">No reason given</span>}</p></Tooltip>
                    {note && <p className={`mt-0.5 text-xs ${l.status === "Rejected" ? "text-rose-600" : "text-gray-500"}`}>HR: {note}</p>}
                  </div>
                  {/* Cancel (pending only) sits left of the status, so every status chip lines up on the right edge */}
                  <div className="ml-auto flex items-center gap-3">
                    {l.status === "Pending" && (
                      <button type="button" onClick={() => cancel(l)} disabled={cancellingId === l._id}
                        className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">
                        {cancellingId === l._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />} Cancel
                      </button>
                    )}
                    <div className="w-28 text-right">
                      <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STATUS[l.status] || "bg-gray-50 text-gray-600 ring-gray-200"}`}>{l.status}</span>
                      <p className="mt-0.5 text-[10px] text-gray-400">applied {fmtStamp(l.appliedAt || l.createdAt)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && visible.length > shown && (
          <div className="border-t border-gray-100 px-5 py-3 text-center">
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="text-xs font-semibold text-indigo-600 hover:underline">
              Show {Math.min(PAGE, visible.length - shown)} more
            </button>
          </div>
        )}
        {!loading && !error && counts.Rejected > 0 && filter === "all" && (
          <div className="flex items-center gap-1.5 border-t border-gray-100 px-5 py-2.5 text-[11px] text-gray-400">
            <Info className="h-3 w-3" /> Rejected requests don't count against your balance.
          </div>
        )}
      </div>

      {showForm && (
        <RequestForm
          balances={balances}
          monthLeft={monthLeft}
          onClose={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false);
            window.dispatchEvent(new CustomEvent("crm:leave:updated"));
            fetchLeaves(); fetchStats();
          }}
        />
      )}
    </div>
  );
}
