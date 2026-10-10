// AttendanceTab.jsx — HR attendance: summary tiles, filter toolbar and the records table.
// Task time and breaks come per record from /attendance/logs (each counted inside that day's session).
import { useState, useEffect, useRef } from "react";
import { Activity, CalendarDays, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import api from "../../services/axios";
import AttendanceFilters from "./AttendanceFilters";
import AttendanceTable from "./AttendanceTable";
import StatTile from "../../components/StatTile";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";

const EMPTY_FILTERS = { page: 1, limit: 20, startDate: "", endDate: "", userId: "" };

const fmtHours = (h) => {
  const mins = Math.round((h || 0) * 60);
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
};
const fmtKey = (k) => new Date(`${k}T00:00:00+05:30`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const AttendanceTab = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalRecords: 0 });
  const [summary, setSummary] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);       // first load / filter change → skeleton
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const filtersRef = useRef(filters); // latest filters for the quiet refreshes below

  const fetchAttendance = async ({ silent = false } = {}) => {
    const f = filtersRef.current;
    silent ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ""));
      const { data } = await api.get("/attendance/logs", { params });
      setRecords(data.attendance || []);
      setPagination({ currentPage: Number(data.currentPage) || 1, totalPages: data.totalPages || 1, totalRecords: data.totalRecords || 0, limit: Number(f.limit) });
      setSummary(data.summary || null);
    } catch (err) {
      setError(!err?.response ? "Can't reach the server — make sure the backend is running." : "Couldn't load attendance records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    filtersRef.current = filters;
    fetchAttendance();
  }, [filters]);

  // Employees for the picker
  useEffect(() => {
    api.get("/users")
      .then((r) => setPeople((Array.isArray(r.data) ? r.data : []).sort((a, b) => (a.name || "").localeCompare(b.name || ""))))
      .catch(() => setPeople([]));
  }, []);

  // Check-ins / check-outs / breaks anywhere → refresh quietly
  useAutoRefresh(() => fetchAttendance({ silent: true }), ["crm:attendance:updated"]);

  // While someone on this page is working, refresh every minute so task time & breaks stay current
  const anyLive = records.some((r) => r.state === "working" || r.state === "on-break");
  useEffect(() => {
    if (!anyLive) return;
    const id = setInterval(() => fetchAttendance({ silent: true }), 60000);
    return () => clearInterval(id);
  }, [anyLive]);

  const filtersActive = !!(filters.userId || filters.startDate || filters.endDate);
  const clearFilters = () => setFilters((f) => ({ ...EMPTY_FILTERS, limit: f.limit }));
  const rangeLabel =
    filters.startDate && filters.endDate ? (filters.startDate === filters.endDate ? fmtKey(filters.startDate) : `${fmtKey(filters.startDate)} – ${fmtKey(filters.endDate)}`)
    : filters.startDate ? `since ${fmtKey(filters.startDate)}`
    : filters.endDate ? `until ${fmtKey(filters.endDate)}`
    : "all time";
  const s = summary;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Attendance</h2>
          <p className="mt-0.5 text-sm text-gray-500">Check-ins, working hours, task time and breaks for every employee.</p>
        </div>
        <button type="button" onClick={() => fetchAttendance({ silent: true })} disabled={refreshing}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-60">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Summary — for the current filters */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile tone="emerald" Icon={Activity} label="Working now" value={s ? s.workingNow : "—"} sub="checked in right now" />
        <StatTile tone="violet" Icon={CalendarDays} label="Records" value={s ? s.records : "—"} sub={rangeLabel} />
        <StatTile tone="blue" Icon={Clock} label="Avg working day" value={s ? fmtHours(s.avgHours) : "—"}
          sub={s ? `over ${s.closedDays} completed ${s.closedDays === 1 ? "day" : "days"}` : " "} />
        <StatTile tone={s?.missedCheckouts ? "rose" : "amber"} Icon={AlertTriangle} label="Missed check-outs" value={s ? s.missedCheckouts : "—"}
          sub={s?.missedCheckouts ? "sessions never checked out" : "every session was closed"} />
      </div>

      <AttendanceFilters filters={filters} setFilters={setFilters} people={people} />

      <AttendanceTable
        data={records}
        loading={loading}
        error={error}
        onRetry={() => fetchAttendance()}
        pagination={pagination}
        onPage={(page) => setFilters((f) => ({ ...f, page }))}
        filtersActive={filtersActive}
        onClearFilters={clearFilters}
      />
    </div>
  );
};

export default AttendanceTab;
