// EmployeeReport.jsx — Admin-only one-page report on a single employee: attendance, focus, projects, tasks, leave, activity
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft, CalendarDays, Clock, Timer, Target, CheckSquare, Plane, Layers, ListChecks,
  Activity, AlertTriangle, Mail, Phone, Briefcase, ChevronDown, Check,
} from "lucide-react";
import api from "../services/axios";
import { useAuth } from "../context/AuthContext";
import { LEAVE_TYPES, normalizeType } from "../components/LeaveDonutChart";
import MeterRing from "../components/MeterRing";

/* ── Formatting ─────────────────────────────────────────────────────────── */
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHM = (sec) => {
  if (!sec) return "0m";
  if (sec < 60) return "<1m";
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
};
const fmtDay = (ds, opts = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(`${ds}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
const fmtTime = (ts) => ts
  ? new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
  : "—";
const fmtClockMin = (min) => {
  if (min == null) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};
const fmtDuration = (hours) => {
  if (hours == null) return "—";
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  const d = Math.floor(hours / 24), h = Math.round(hours % 24);
  return h ? `${d}d ${h}h` : `${d}d`;
};
const fmtAgo = (ts) => {
  if (!ts) return "—";
  const mins = Math.round((Date.now() - new Date(ts)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/* ── Period presets ─────────────────────────────────────────────────────── */
const PERIODS = [
  { id: "this-month",  label: "This month" },
  { id: "last-month",  label: "Last month" },
  { id: "last-3",      label: "Last 3 months" },
];
const periodRange = (id) => {
  const now = new Date();
  if (id === "last-month") {
    return { from: toKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toKey(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  if (id === "last-3") return { from: toKey(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: toKey(now) };
  return { from: toKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: toKey(now) };
};

/* ── Status vocab (validated palette: CVD-safe across all pairs) ───────── */
const DAY_STATUS = {
  present:      { label: "Present",  color: "#10b981" },
  late:         { label: "Late",     color: "#f59e0b" },
  leave:        { label: "On leave", color: "#3b82f6" },
  "half-leave": { label: "Half-day leave", color: "linear-gradient(135deg, #10b981 50%, #3b82f6 50%)" },
  absent:       { label: "Absent",   color: "#ef4444" },
  weekend:      { label: "Weekend",  color: "#f1f5f9" },
  today:        { label: "Today · not checked in yet", color: "#ffffff" },
  future:       { label: "Upcoming", color: "#ffffff" },
};
const CHIP = {
  Ongoing: "border-blue-400 text-blue-600", Completed: "border-emerald-400 text-emerald-600",
  Pending: "border-amber-400 text-amber-600", "In Progress": "border-blue-400 text-blue-600",
  Assigned: "border-indigo-300 text-indigo-600", Failed: "border-red-400 text-red-500",
  Approved: "border-emerald-400 text-emerald-600", Rejected: "border-red-400 text-red-500",
  Paid: "border-emerald-400 text-emerald-600",
};
const Chip = ({ children, tone }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CHIP[tone] || "border-gray-300 text-gray-500"}`}>
    {children}
  </span>
);

const ACTIVITY_LABEL = {
  task_created: "Created task", timer_started: "Started timer", timer_stopped: "Stopped timer",
  revision_added: "Added revision", status_changed: "Changed status",
};

/* ── Building blocks ────────────────────────────────────────────────────── */
const Card = ({ title, Icon, right, children, className = "" }) => (
  <section className={`rounded-xl border border-gray-100 bg-white p-5 shadow-sm ${className}`}>
    <div className="mb-4 flex items-center gap-2">
      {Icon && <Icon className="h-4 w-4 text-indigo-500" />}
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      {right && <div className="ml-auto">{right}</div>}
    </div>
    {children}
  </section>
);

const Stat = ({ label, value, sub, Icon, accent }) => (
  <div className={`rounded-xl border border-gray-100 bg-white p-4 shadow-sm border-l-4 ${accent}`}>
    <div className="flex items-start justify-between gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-gray-300" />}
    </div>
    <p className="mt-1.5 text-2xl font-black leading-none text-gray-800">{value}</p>
    <p className="mt-1.5 text-[11px] leading-snug text-gray-400">{sub}</p>
  </div>
);

const Empty = ({ children }) => <p className="py-6 text-center text-sm text-gray-400">{children}</p>;

/* ── Live status chip ───────────────────────────────────────────────────── */
function LiveStatus({ live }) {
  const map = {
    working:       { cls: "border-indigo-300 text-indigo-600", dot: "bg-indigo-500 animate-pulse", text: `Working on "${live.taskTitle}" since ${fmtTime(live.since)}` },
    "checked-in":  { cls: "border-emerald-400 text-emerald-600", dot: "bg-emerald-500", text: `Checked in at ${fmtTime(live.since)} · no timer running` },
    "on-break":    { cls: "border-amber-400 text-amber-600", dot: "bg-amber-500 animate-pulse", text: `On break since ${fmtTime(live.since)}` },
    "checked-out": { cls: "border-gray-300 text-gray-500", dot: "bg-gray-400", text: `Checked out at ${fmtTime(live.since)}` },
    offline:       { cls: "border-gray-300 text-gray-500", dot: "bg-gray-300", text: "Not checked in today" },
  };
  const s = map[live?.state] || map.offline;
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${s.dot}`} />
      <span className="truncate">{s.text}</span>
    </span>
  );
}

/* ── Attendance grid (weeks as columns, Mon–Sun as rows) ───────────────── */
function AttendanceGrid({ days }) {
  const [focused, setFocused] = useState(null);
  const weeks = useMemo(() => {
    if (!days.length) return [];
    const lead = (days[0].dow + 6) % 7; // Monday-first offset
    const cells = [...Array(lead).fill(null), ...days];
    const cols = [];
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
    return cols;
  }, [days]);

  const counts = days.reduce((m, d) => { m[d.status] = (m[d.status] || 0) + 1; return m; }, {});
  const legend = ["present", "late", "leave", "half-leave", "absent"].filter(k => counts[k]);
  // One month fits big cells with the date inside; longer periods shrink to a compact heat-strip
  const roomy = weeks.length <= 6;
  const cell = roomy ? 34 : 18;
  const gap = roomy ? 4 : 3;
  const darkFill = (s) => s === "present" || s === "absent" || s === "leave" || s === "half-leave";

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex" style={{ gap }}>
          <div className="mr-1 grid grid-rows-7 text-[9px] font-semibold text-gray-400" style={{ gap }}>
            {(roomy ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Mon", "", "Wed", "", "Fri", "", ""])
              .map((d, i) => <span key={i} className="flex items-center" style={{ height: cell }}>{d}</span>)}
          </div>
          {weeks.map((col, wi) => (
            <div key={wi} className="grid grid-rows-7" style={{ gap }}>
              {Array.from({ length: 7 }).map((_, di) => {
                const d = col[di];
                if (!d) return <span key={di} style={{ height: cell, width: cell }} />;
                const st = DAY_STATUS[d.status];
                return (
                  <button
                    key={di}
                    type="button"
                    onMouseEnter={() => setFocused(d)}
                    onMouseLeave={() => setFocused(null)}
                    onFocus={() => setFocused(d)}
                    onBlur={() => setFocused(null)}
                    aria-label={`${fmtDay(d.date)}: ${st.label}`}
                    className={`flex items-center justify-center rounded-[5px] text-[11px] font-bold outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-indigo-400
                      ${darkFill(d.status) ? "text-white" : "text-gray-500"}
                      ${d.status === "future" ? "border border-gray-100 text-gray-300" : ""} ${d.status === "today" ? "border border-indigo-300" : ""}
                      ${focused?.date === d.date ? "ring-2 ring-indigo-300" : ""}`}
                    style={{ background: st.color, height: cell, width: cell }}
                  >
                    {roomy && Number(d.date.slice(8))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Hover / focus readout */}
      <div className="mt-3 min-h-[40px] rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[11px]">
        {focused ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
            <span className="font-bold text-gray-700">{fmtDay(focused.date, { weekday: "long", day: "numeric", month: "long" })}</span>
            <span className="text-gray-500">{DAY_STATUS[focused.status].label}{focused.leaveType ? ` · ${focused.leaveType}` : ""}</span>
            {focused.checkIn && <span className="text-gray-500">In {fmtTime(focused.checkIn)} · Out {fmtTime(focused.checkOut)}</span>}
            {focused.hours > 0 && <span className="text-gray-500">{focused.hours}h at work</span>}
            {focused.focusSec > 0 && <span className="text-gray-500">{fmtHM(focused.focusSec)} focus</span>}
            {focused.breakSec > 0 && <span className="text-gray-500">{fmtHM(focused.breakSec)} break</span>}
          </div>
        ) : (
          <span className="text-gray-400">Hover or tab through a day to see its details.</span>
        )}
      </div>

      {/* Legend — text in ink, swatch carries the colour */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {legend.map(k => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: DAY_STATUS[k].color }} />
            {DAY_STATUS[k].label} <span className="font-bold text-gray-700">{counts[k]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Focus hours chart (single series → no legend; target line labelled) ─ */
function FocusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-black text-gray-800">{fmtHM(d.focusSec)} <span className="text-[11px] font-semibold text-gray-400">focus</span></p>
      <p className="text-[11px] text-gray-500">{fmtDay(d.date, { weekday: "long", day: "numeric", month: "short" })}</p>
    </div>
  );
}

function FocusChart({ days }) {
  const data = days.filter(d => d.status !== "future").map(d => ({ ...d, focusH: d.focusSec / 3600 }));
  const maxH = Math.max(8, Math.ceil(Math.max(0, ...data.map(d => d.focusH)) / 2) * 2); // even, so 2h ticks land on the top
  // Long periods: label only the 1st and 15th ("1 Sep") so day numbers never repeat ambiguously across months
  const long = data.length > 35;
  const xTicks = long ? data.filter(d => ["01", "15"].includes(d.date.slice(8))).map(d => d.date) : undefined;
  const xLabel = (ds) => long ? fmtDay(ds, { day: "numeric", month: "short" }) : Number(ds.slice(8));
  if (!data.some(d => d.focusSec > 0)) return <Empty>No task-timer time logged in this period.</Empty>;
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="date" ticks={xTicks} tickFormatter={xLabel} tick={{ fontSize: 10, fill: "#9ca3af" }}
                 axisLine={{ stroke: "#e5e7eb" }} tickLine={false} interval={long ? 0 : "preserveStartEnd"} minTickGap={8} />
          <YAxis domain={[0, maxH]} ticks={Array.from({ length: maxH / 2 + 1 }, (_, i) => i * 2)}
                 tickFormatter={(v) => `${v}h`} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip content={<FocusTooltip />} cursor={{ fill: "#f8fafc" }} />
          <ReferenceLine y={6.5} stroke="#9ca3af" strokeWidth={1}
                         label={{ value: "6.5h target", position: "insideTopRight", fontSize: 10, fill: "#6b7280" }} />
          <Bar dataKey="focusH" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={24} activeBar={{ fill: "#818cf8" }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Projects: task-completion ring + time, grouped Ongoing / Completed ──── */
const fmtShortDate = (ts) => ts ? new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
const fmtSpan = (from, to) => {
  const ms = new Date(to) - new Date(from);
  if (!(ms > 0)) return null;
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const h = Math.max(1, Math.round(ms / 3600000));
  return `${h} hour${h === 1 ? "" : "s"}`;
};

function TaskRing({ done, total, completed }) {
  const pct = total ? done / total : 0;
  return (
    <MeterRing pct={pct} fill={completed ? "#10b981" : "#6366f1"} track={completed ? "#d1fae5" : "#e0e7ff"}
               label={`${done} of ${total} tasks done`}>
      {completed
        ? <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
        : <span className="text-[11px] font-black text-gray-700">{total ? `${Math.round(pct * 100)}%` : "—"}</span>}
      <span className="mt-0.5 text-[8px] font-semibold text-gray-400">{done}/{total}</span>
    </MeterRing>
  );
}

/* ── Leave: one tile per leave type (ring = share of earned days used) + requests in the period ── */
const fmtDays = (n) => `${n} day${n === 1 ? "" : "s"}`;
const fmtLeaveDate = (ts, opts = { day: "numeric", month: "short" }) =>
  new Date(ts).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" }); // leave dates are UTC-midnight calendar dates

function LeaveTile({ t }) {
  const pct = t.available ? t.used / t.available : 0;
  const rule = t.monthly > 0 ? `Earns ${t.monthly}/month · max ${t.yearly} a year` : `${t.yearly} a year, available up front`;
  return (
    <li className="flex items-center gap-4 rounded-xl border p-3.5 transition hover:shadow-sm"
        style={{ borderColor: `${t.color}26`, background: `${t.color}08` }}>
      <MeterRing pct={pct} fill={t.color} track={t.light} label={`${t.used} of ${t.available} days used`}>
        <span className="text-[11px] font-black text-gray-700">{t.available ? `${Math.round(Math.min(1, pct) * 100)}%` : "—"}</span>
        <span className="mt-0.5 text-[8px] font-semibold text-gray-400">used</span>
      </MeterRing>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-800">{t.key}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-gray-400">{rule}</p>
        <p className="text-[11px] leading-snug text-gray-400">
          <span className="font-bold text-gray-600">{t.used}</span> used of <span className="font-bold text-gray-600">{t.available}</span> earned so far
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-lg font-black leading-none text-gray-800">{t.remaining}d</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">left</p>
        <p className="mt-0.5 text-[10px] text-gray-400">{t.used}d used</p>
      </div>
    </li>
  );
}

function LeaveRequestTile({ l }) {
  const type = LEAVE_TYPES.find(x => x.key === normalizeType(l.leaveType));
  const color = type?.color || "#6366f1";
  const multiDay = l.endDate.slice(0, 10) !== l.startDate.slice(0, 10);
  return (
    <li className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-3 transition hover:shadow-sm">
      {/* Calendar-leaf date */}
      <div className="flex h-[52px] w-[52px] flex-shrink-0 flex-col items-center justify-center rounded-xl" style={{ background: `${color}1a` }}>
        <span className="text-lg font-black leading-none text-gray-800">{fmtLeaveDate(l.startDate, { day: "numeric" })}</span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">{fmtLeaveDate(l.startDate, { month: "short" })}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-800">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />
          {l.leaveType}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-gray-400" title={l.reason || undefined}>
          {multiDay && `${fmtLeaveDate(l.startDate)} – ${fmtLeaveDate(l.endDate)} · `}
          {l.halfDay ? "Half day" : fmtDays(l.totalDays)}
          {l.reason && ` · "${l.reason}"`}
        </p>
      </div>

      <Chip tone={l.status}>{l.status}</Chip>
    </li>
  );
}

function ProjectTile({ p }) {
  const completed = p.status === "Completed";
  const took = completed && p.startedAt && p.completedAt ? fmtSpan(p.startedAt, p.completedAt) : null;
  const bigSec = completed ? p.totalSec : p.periodSec;
  return (
    <li className={`flex items-center gap-4 rounded-xl border p-3.5 transition hover:shadow-sm
      ${completed ? "border-emerald-100 bg-emerald-50/30" : "border-indigo-100 bg-indigo-50/30"}`}>
      <TaskRing done={p.tasksDone} total={p.tasksTotal} completed={completed} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold tracking-widest text-gray-400">{p.projectId}</span>
          <Chip tone={p.status}>{p.status}</Chip>
        </div>
        <p className="mt-0.5 truncate text-sm font-semibold text-gray-800" title={p.title}>{p.title}</p>
        <p className="mt-1 text-[11px] leading-snug text-gray-400">
          {completed
            ? <>Finished {fmtShortDate(p.completedAt)}{took && <> · took {took}</>}{p.startedAt && <> (from {fmtShortDate(p.startedAt)})</>}</>
            : <>
                {p.tasksOngoing > 0 ? `${p.tasksOngoing} in progress`
                  : p.tasksTotal > 0 && p.tasksDone === p.tasksTotal ? "Your tasks done"
                  : "Not started"}
                {p.lastWorkedAt && <> · worked {fmtAgo(p.lastWorkedAt)}</>}
              </>}
          {p.manager && <> · Manager {p.manager}</>}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className={`text-lg font-black leading-none ${bigSec ? "text-gray-800" : "text-gray-300"}`}>{bigSec ? fmtHM(bigSec) : "—"}</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{completed ? "total work" : "this period"}</p>
        <p className="mt-0.5 text-[10px] text-gray-400">
          {completed
            ? `${p.sessionCount} session${p.sessionCount === 1 ? "" : "s"}`
            : `${fmtHM(p.totalSec)} all-time`}
        </p>
      </div>
    </li>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function EmployeeReport() {
  const { employeeId } = useParams();
  const { user } = useAuth();
  const [period, setPeriod] = useState("this-month");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    const { from, to } = periodRange(period);
    setLoading(true);
    setError(null);
    api.get(`/reports/employee/${encodeURIComponent(employeeId)}`, { params: { from, to } })
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.message || "Couldn't load this report. Check that the server is running and try again."))
      .finally(() => setLoading(false));
  }, [employeeId, period, isAdmin]);

  // Leave balance per type for the report's year (same rules as the Leave page donuts)
  const leaveRows = useMemo(() => {
    if (!data) return [];
    const year = Number(data.period.to.slice(0, 4));
    const now = new Date();
    const monthsElapsed = year < now.getFullYear() ? 12 : now.getMonth() + 1;
    return LEAVE_TYPES.map(t => {
      const used = data.leaves
        .filter(l => l.status !== "Rejected" && normalizeType(l.leaveType) === t.key && new Date(l.startDate).getFullYear() === year)
        .reduce((s, l) => s + (l.totalDays || 0), 0);
      const available = t.monthly > 0 ? Math.min(t.monthly * monthsElapsed, t.yearly) : t.yearly;
      return { ...t, used, available, remaining: Math.max(0, available - used) };
    });
  }, [data]);

  if (!isAdmin) return <Navigate to="/" replace />;

  if (error && !data) return (
    <div className="p-5">
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <div className="rounded-xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-red-400" />
        <p className="text-sm font-semibold text-gray-700">{error}</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
    </div>
  );

  const { employee: emp, live, kpis: k, period: p, days, projects, tasks, leaves, activity, excludedSessions = [] } = data;
  const periodLeaves = leaves.filter(l => l.startDate.slice(0, 10) <= p.to && l.endDate.slice(0, 10) >= p.from);

  return (
    <div className="space-y-5 bg-gray-50 p-5">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      {/* Holds the previous render dimmed while a new period loads — no layout jump */}
      <div className={`space-y-5 transition-opacity ${loading ? "pointer-events-none opacity-60" : ""}`}>

        {/* ── Header ── */}
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />
          <div className="flex flex-wrap items-center gap-5 px-6 py-5">
            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-indigo-100 bg-indigo-100">
              {emp.photo
                ? <img src={emp.photo} alt={emp.name} className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center text-2xl font-black text-indigo-600">{emp.name?.charAt(0)?.toUpperCase()}</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h1 className="text-xl font-bold text-gray-900">{emp.name}</h1>
                <span className="font-mono text-xs font-bold tracking-widest text-gray-400">{emp.employeeId}</span>
              </div>
              <p className="text-sm font-medium text-indigo-600">{emp.designation || "—"}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
                {emp.domain && <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-600">{emp.domain}</span>}
                {emp.shiftTiming && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{emp.shiftTiming}</span>}
                <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />Joined {new Date(emp.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{emp.email}</span>
                {emp.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{emp.phone}</span>}
              </div>
              <div className="mt-2.5"><LiveStatus live={live} /></div>
            </div>

            {/* Period filter — one row, scopes everything below */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex rounded-full border border-gray-200 p-0.5" role="group" aria-label="Report period">
                {PERIODS.map(opt => (
                  <button key={opt.id} onClick={() => setPeriod(opt.id)} aria-pressed={period === opt.id}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition
                      ${period === opt.id ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">
                {fmtDay(p.from, { day: "numeric", month: "short" })} – {fmtDay(p.to, { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error} Showing the previous period.</p>
        )}

        {/* ── Key numbers ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <Stat label="Attendance" Icon={CalendarDays} accent="border-l-emerald-400"
                value={k.attendanceRate == null ? "—" : `${k.attendanceRate}%`}
                sub={`${k.presentDays} of ${p.expectedDays} working days${k.weekendDays ? ` · +${k.weekendDays} weekend day${k.weekendDays === 1 ? "" : "s"}` : ""}`} />
          <Stat label="Punctuality" Icon={Target} accent="border-l-amber-400"
                value={k.punctualityRate == null ? "—" : `${k.punctualityRate}%`}
                sub={`${k.lateDays} late (in after ${fmtClockMin(k.lateAfterMin)}) · avg in ${fmtClockMin(k.avgCheckInMin)}`} />
          <Stat label="Avg hours" Icon={Clock} accent="border-l-indigo-400"
                value={k.avgHoursPerDay == null ? "—" : `${k.avgHoursPerDay}h`}
                sub={k.avgHoursPerDay == null
                  ? (k.missedCheckouts
                      ? `no hours recorded — ${k.missedCheckouts} day${k.missedCheckouts === 1 ? "" : "s"} never checked out`
                      : "no checked-out days yet")
                  : `per day at work${k.missedCheckouts ? ` · ${k.missedCheckouts} missed check-out${k.missedCheckouts === 1 ? "" : "s"}` : ""}`} />
          <Stat label="Focus time" Icon={Timer} accent="border-l-violet-400"
                value={k.avgFocusSecPerDay == null ? "—" : fmtHM(k.avgFocusSecPerDay)}
                sub={`avg per day worked · ${k.daysMeetingTarget} day${k.daysMeetingTarget === 1 ? "" : "s"} reached 6.5h`} />
          <Stat label="Tasks done" Icon={CheckSquare} accent="border-l-blue-400"
                value={k.tasksCompleted}
                sub={`${k.tasksOpen} still open`} />
          <Stat label="Leave" Icon={Plane} accent="border-l-sky-400"
                value={`${p.leaveDays}d`}
                sub="approved leave in period" />
        </div>

        {/* ── Attendance + Focus ── */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card title="Attendance" Icon={CalendarDays}
                right={<span className="text-[11px] text-gray-400">{k.breakCount} breaks · avg {fmtHM(k.avgBreakSec)}{k.daysOverBreakLimit ? ` · ${k.daysOverBreakLimit} day(s) over 60m` : ""}</span>}>
            <AttendanceGrid days={days} />
          </Card>

          <Card title="Focus hours per day" Icon={Timer}
                right={<span className="text-[11px] text-gray-400">{fmtHM(k.focusSec)} total</span>}>
            <FocusChart days={days} />
            {excludedSessions.length > 0 && (
              <div className="mt-3 flex gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <p>
                  Left out {excludedSessions.length} timer session{excludedSessions.length > 1 ? "s" : ""} longer than 12h
                  ({excludedSessions.map(s => `${s.hours}h on "${s.taskTitle}"`).join(", ")}). These look like timers that were left running, not real work.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* ── Daily log (table view of the grid and chart) ── */}
        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <button onClick={() => setShowLog(v => !v)} aria-expanded={showLog}
            className="flex w-full items-center gap-2 px-5 py-3.5 text-left">
            <ListChecks className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-bold text-gray-800">Daily log</span>
            <span className="text-[11px] text-gray-400">{days.filter(d => d.status !== "future").length} days</span>
            <ChevronDown className={`ml-auto h-4 w-4 text-gray-400 transition-transform ${showLog ? "rotate-180" : ""}`} />
          </button>
          {showLog && (
            <div className="overflow-x-auto border-t border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>{["Date", "Status", "Check-in", "Check-out", "At work", "Focus", "Breaks"].map(h => <th key={h} className="px-4 py-2 text-left font-bold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-50 tabular-nums">
                  {days.filter(d => d.status !== "future").slice().reverse().map(d => (
                    <tr key={d.date} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-semibold text-gray-700">{fmtDay(d.date)}</td>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <span className="h-2 w-2 rounded-[3px]" style={{ background: DAY_STATUS[d.status].color }} />
                          {DAY_STATUS[d.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{fmtTime(d.checkIn)}</td>
                      <td className="px-4 py-2 text-gray-500">{fmtTime(d.checkOut)}</td>
                      <td className="px-4 py-2 text-gray-500">{d.hours ? `${d.hours}h` : "—"}</td>
                      <td className="px-4 py-2 text-gray-500">{d.focusSec ? fmtHM(d.focusSec) : "—"}</td>
                      <td className="px-4 py-2 text-gray-500">{d.breakSec ? fmtHM(d.breakSec) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Projects + Tasks ── */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card title="Projects" Icon={Layers}
                right={projects.length > 0 && (
                  <span className="text-[11px] text-gray-400">
                    {fmtHM(projects.reduce((s, x) => s + x.totalSec, 0))} total work
                  </span>
                )}>
            {projects.length === 0 ? <Empty>Not assigned to any project.</Empty> : (
              <div className="space-y-4">
                {[["Ongoing", projects.filter(x => x.status !== "Completed")], ["Completed", projects.filter(x => x.status === "Completed")]]
                  .filter(([, list]) => list.length > 0)
                  .map(([group, list]) => (
                    <div key={group}>
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">{group} · {list.length}</p>
                      <ul className="space-y-2">
                        {list.map(pr => <ProjectTile key={pr.projectId} p={pr} />)}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </Card>

          <Card title="Tasks" Icon={CheckSquare}>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Completed", k.tasksCompleted, `${k.tasksCompletedProject} project · ${k.tasksCompletedHr} HR`],
                ["Open now", k.tasksOpen, "not yet completed"],
                ["Avg to finish", fmtDuration(k.avgCompletionHours), "created → completed"],
                ["Revisions", k.revisionCount, k.failedHr ? `${k.failedHr} HR task failed` : "rework tasks created"],
              ].map(([label, value, sub]) => (
                <div key={label} className="rounded-lg bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
                  <p className="mt-1 text-lg font-black leading-none text-gray-800">{value}</p>
                  <p className="mt-1 truncate text-[10px] text-gray-400" title={sub}>{sub}</p>
                </div>
              ))}
            </div>
            {tasks.length === 0 ? <Empty>No task activity in this period.</Empty> : (
              <ul className="divide-y divide-gray-50">
                {tasks.map(t => (
                  <li key={t.id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800" title={t.title}>
                        {t.title}
                        {t.isRevision && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-600">Revision</span>}
                      </p>
                      <p className="truncate text-[11px] text-gray-400">{t.kind === "HR" ? "HR task" : t.project}{t.periodSec ? ` · ${fmtHM(t.periodSec)} logged` : ""}</p>
                    </div>
                    <Chip tone={t.status}>{t.status}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* ── Leave + Recent activity ── */}
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card title={`Leave balance · ${p.to.slice(0, 4)}`} Icon={Plane}
                right={<span className="text-[11px] text-gray-400">{leaveRows.reduce((s, t) => s + t.used, 0)} days used this year</span>}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">By leave type · {leaveRows.length}</p>
            <ul className="space-y-2">
              {leaveRows.map(t => <LeaveTile key={t.key} t={t} />)}
            </ul>

            <p className="mb-2 mt-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Leave in this period · {periodLeaves.length}</p>
            {periodLeaves.length === 0 ? <p className="text-sm text-gray-400">No leave requests in this period.</p> : (
              <ul className="space-y-2">
                {periodLeaves.map(l => <LeaveRequestTile key={l._id} l={l} />)}
              </ul>
            )}
          </Card>

          {/* ── Recent activity (sits beside Leave) ── */}
          <Card title="Recent activity" Icon={Activity}
                right={activity.length > 0 && (
                  <span className="text-[11px] text-gray-400">
                    {activity.length >= 15 ? "latest 15 events" : `${activity.length} event${activity.length === 1 ? "" : "s"} in period`}
                  </span>
                )}>
            {activity.length === 0 ? <Empty>No project activity in this period.</Empty> : (
              <ol className="relative ml-1.5 space-y-3 border-l border-gray-100 pl-5">
                {(showAllActivity ? activity : activity.slice(0, 8)).map(a => (
                  <li key={a._id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-white" />
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">{ACTIVITY_LABEL[a.action] || a.action}</span>
                      {a.action === "status_changed" && a.fromStatus && ` ${a.fromStatus} → ${a.toStatus}`}
                      {a.taskTitle && <span className="text-gray-500"> · {a.taskTitle}</span>}
                    </p>
                    <p className="text-[11px] text-gray-400">{a.projectName || a.projectId} · {fmtAgo(a.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
            {activity.length > 8 && (
              <button onClick={() => setShowAllActivity(v => !v)}
                className="mt-4 rounded-full border border-gray-200 px-4 py-1.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-50">
                {showAllActivity ? "Show less" : `Show all ${activity.length}`}
              </button>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
