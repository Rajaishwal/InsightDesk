// AdminDashboard.jsx — Admin/Manager dashboard: stat cards, attendance table, break tracking, ongoing projects, pie chart
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { useCheckInStatus } from "../hooks/useCheckInStatus";
import EditProfileModal from "../components/EditProfileModal";
import MeterRing from "../components/MeterRing";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import { getCache, setCache } from "../utils/pageCache";
import { Users, UserPlus, Briefcase, CheckCircle2, AlertCircle, XCircle, X, Clock, Coffee, Pencil, MapPin, RefreshCw, FileBarChart } from "lucide-react";

const PROJECT_STATUS_COLORS = ["#7c3aed", "#06b6d4", "#f59e0b"];

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats]     = useState(getCache("admin-stats") || null);
  const [loading, setLoading] = useState(!getCache("admin-stats"));
  const [activeFilter, setActiveFilter] = useState(null); // 'present'|'late'|'onLeave'|'absent'
  const [showEditModal, setShowEditModal] = useState(false);
  // Live check-in status for the header location badge — was fetched once on load, so a check-in never showed until reload
  const [locationStatus] = useCheckInStatus(user?._id);
  const [expandedBreakEmp, setExpandedBreakEmp] = useState(null);
  const [breakLogs, setBreakLogs] = useState({});
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.get("/users/admin-stats")
      .then(r => { setStats(r.data); setCache("admin-stats", r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refreshStats = async () => {
    setRefreshing(true);
    setBreakLogs({});
    setExpandedBreakEmp(null);
    try {
      const r = await api.get("/users/admin-stats");
      setStats(r.data);
    } catch {}
    finally { setRefreshing(false); }
  };

  // Silent background refresh — no spinner, data swaps in-place
  const silentRefresh = () =>
    api.get("/users/admin-stats")
      .then(r => { setStats(r.data); setCache("admin-stats", r.data); })
      .catch(() => {});
  useAutoRefresh(silentRefresh, ["crm:attendance:updated", "crm:task:updated"]);

  const loadBreakLogs = async (userId) => {
    try {
      const r = await api.get(`/breaks/logs/${userId}`);
      setBreakLogs(prev => ({ ...prev, [userId]: r.data }));
    } catch { setBreakLogs(prev => ({ ...prev, [userId]: prev[userId] || [] })); }
  };

  const toggleBreakExpand = (userId) => {
    if (expandedBreakEmp === userId) { setExpandedBreakEmp(null); return; }
    setExpandedBreakEmp(userId);
    loadBreakLogs(userId); // always fresh — a break may have started or ended since last time
  };

  // Keep the open break history live when the dashboard refreshes (break start/end emits attendance updates)
  useEffect(() => {
    if (expandedBreakEmp) loadBreakLogs(expandedBreakEmp);
  }, [stats]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmtDuration = (secs) => {
    if (!secs) return "0m 0s";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* ── Profile Card ── */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-100 rounded-2xl shadow-sm border border-indigo-100 overflow-hidden mb-0">
        <div className="flex items-center justify-between px-7 py-5">

          {/* Left: avatar + info */}
          <div className="flex items-center gap-5">
            {/* Square-rounded avatar with straddling edit button */}
            <div className="group relative w-[72px] h-[72px] flex-shrink-0">
              {/* Avatar — overflow-hidden kept here for rounded crop */}
              <div className="w-full h-full rounded-2xl overflow-hidden bg-white shadow border border-indigo-100">
                {user?.photo ? (
                  <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-indigo-400 bg-indigo-50">
                    {user?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
              {/* Edit button — 50% inside / 50% outside top-right corner */}
              <button
                onClick={() => setShowEditModal(true)}
                className="absolute -top-[4px] -right-[4px] w-[18px] h-[18px] rounded-full bg-white border border-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-sm"
              >
                <Pencil className="w-2.5 h-2.5 text-indigo-600" />
              </button>
            </div>

            {/* Name + designation + badges */}
            <div>
              <h2 className="text-gray-800 text-lg font-bold leading-tight">{user?.name}</h2>
              <p className="text-indigo-600 text-sm font-semibold mt-0.5">
                {user?.designation || user?.role}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {user?.domain && (
                  <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-xs font-semibold">
                    {user.domain}
                  </span>
                )}
                {user?.employeeId && (
                  <span className="px-2.5 py-0.5 bg-gray-200 text-gray-600 rounded-md text-xs font-semibold">
                    {user.employeeId}
                  </span>
                )}
                {user?.shiftTiming && (
                  <span className="text-gray-500 text-xs font-medium">{user.shiftTiming}</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: location badge */}
          <div className="hidden sm:flex flex-col items-center gap-1">
            {locationStatus === "checked-in" ? (
              <>
                <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Active</span>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
                  <MapPin className="w-5 h-5 text-gray-400" />
                </div>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Inactive</span>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── Stat Cards — Card.jsx style ── */}
      <div className="bg-white rounded-b-2xl shadow-sm border border-t-0 border-gray-100 mb-6 overflow-hidden">
        <div className="grid grid-cols-4 divide-x divide-gray-100">
          {[
            {
              label: "Total Employees",
              value: loading ? "—" : (stats?.totalEmployees ?? 0),
              Icon: Users,
              iconBg: "bg-green-100",
              iconColor: "text-green-600",
              border: "border-t-4 border-green-400",
            },
            {
              label: "New Joined",
              value: loading ? "—" : (stats?.newJoined ?? 0),
              Icon: UserPlus,
              iconBg: "bg-blue-100",
              iconColor: "text-blue-600",
              border: "border-t-4 border-blue-400",
            },
            {
              label: "Total Projects",
              value: loading ? "—" : (stats?.totalProjects ?? 0),
              Icon: Briefcase,
              iconBg: "bg-violet-100",
              iconColor: "text-violet-600",
              border: "border-t-4 border-violet-400",
            },
            {
              label: "On Break",
              value: loading ? "—" : (stats?.onBreakCount ?? 0),
              Icon: Coffee,
              iconBg: "bg-amber-100",
              iconColor: "text-amber-600",
              border: "border-t-4 border-amber-400",
              clickable: true,
            },
          ].map(({ label, value, Icon, iconBg, iconColor, border, clickable }) => (
            <div
              key={label}
              onClick={clickable ? () => setActiveFilter(activeFilter === "onBreak" ? null : "onBreak") : undefined}
              className={`flex flex-col items-center py-7 px-4 ${border} ${clickable ? "cursor-pointer transition hover:bg-amber-50" : ""} ${activeFilter === "onBreak" && clickable ? "bg-amber-50 ring-1 ring-amber-300" : ""}`}
            >
              <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div className="text-3xl font-bold text-gray-800">{value}</div>
              <div className="text-sm text-gray-400 font-medium mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — 2/3 */}
        <div className="lg:col-span-2 space-y-5">

          {/* Bar Chart */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Employee Joinings</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats?.monthlyData || []} barSize={28} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "#9ca3af" }}
                  width={24}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.1)", fontSize: 13 }}
                  cursor={{ fill: "#f5f3ff" }}
                />
                <Bar dataKey="count" name="Joined" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Employee Table — transforms based on attendance filter */}
          {(() => {
            const filterCfg = {
              present: { label: "Present Employees",  dot: "bg-green-500",  lastCol: "Check-In",  showCheckOut: true, showBreakSummary: true },
              late:    { label: "Late Employees",      dot: "bg-yellow-400", lastCol: "Check-In",  showCheckOut: true, showBreakSummary: true },
              onLeave: { label: "Employees on Leave",  dot: "bg-blue-500",   lastCol: "Leave Type",showCheckOut: false },
              absent:  { label: "Absent Employees",    dot: "bg-red-500",    lastCol: null,        showCheckOut: false },
              onBreak: { label: "Employees on Break",  dot: "bg-amber-400",  lastCol: "Check-In",  showCheckOut: false, showBreak: true },
            };
            const cfg = activeFilter ? filterCfg[activeFilter] : null;

            const rows = !activeFilter
              ? (stats?.recentEmployees || [])
              : activeFilter === "present"  ? (stats?.presentEmployees  || [])
              : activeFilter === "late"     ? (stats?.lateEmployees     || [])
              : activeFilter === "onLeave"  ? (stats?.onLeave           || [])
              : activeFilter === "onBreak"  ? (stats?.onBreakEmployees  || [])
              :                               (stats?.absentEmployees   || []);

            const fmtTime = ts => ts
              ? new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
              : "—";

            return (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {cfg && <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />}
                    <h3 className="text-sm font-semibold text-gray-700">
                      {cfg ? cfg.label : "All Employees"}
                    </h3>
                    {!loading && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">
                        {rows.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={refreshStats}
                      className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1 transition"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                    {activeFilter && (
                      <button
                        onClick={() => setActiveFilter(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
                      >
                        <X className="w-3.5 h-3.5" /> Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <div className="max-h-[360px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="text-left border-b border-gray-100">
                          <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4">Name</th>
                          <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4">Designation</th>
                          <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4">Domain</th>
                          <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide pr-4">Emp ID</th>
                          <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            {cfg?.lastCol || "Joined"}
                          </th>
                          {cfg?.showCheckOut && (
                            <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Check-Out</th>
                          )}
                          {cfg?.showBreak && (
                            <th className="pb-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Break Since</th>
                          )}
                          {cfg?.showBreakSummary && (
                            <th className="pb-3 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Breaks Today</th>
                          )}
                          <th className="pb-3 pl-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">Report</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {loading ? (
                          Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i}>
                              {Array.from({ length: 6 }).map((_, j) => (
                                <td key={j} className="py-3 pr-4">
                                  <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? 120 : 80 }} />
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : rows.length > 0 ? (
                          rows.map((emp, i) => {
                            // On Break list: always expandable. Present/Late: expandable once the employee has taken a break today
                            const canExpand = !!emp._id && (cfg?.showBreak || (cfg?.showBreakSummary && emp.breakCount > 0));
                            const isExpanded = canExpand && expandedBreakEmp === emp._id;
                            const logs = breakLogs[emp._id] || null;
                            const totalSecs = logs
                              ? logs.reduce((sum, b) => sum + (b.durationInSeconds || 0), 0)
                              : 0;
                            const isOverLimit = totalSecs > 60 * 60;
                            const colSpan = 6 + (cfg?.showCheckOut ? 1 : 0) + (cfg?.showBreak ? 1 : 0) + (cfg?.showBreakSummary ? 1 : 0);
                            return (
                              <React.Fragment key={emp._id || i}>
                                <tr
                                  onClick={canExpand ? () => toggleBreakExpand(emp._id) : undefined}
                                  className={`transition-colors ${canExpand ? "cursor-pointer" : ""} ${isExpanded ? "bg-amber-50" : "hover:bg-gray-50"}`}
                                >
                                  {/* Name */}
                                  <td className="py-3 pr-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs flex-shrink-0 overflow-hidden">
                                        {emp.photo
                                          ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                                          : emp.name?.charAt(0)?.toUpperCase()
                                        }
                                      </div>
                                      {emp.employeeId ? (
                                        <Link
                                          to={`/employees/${encodeURIComponent(emp.employeeId)}/report`}
                                          onClick={(e) => e.stopPropagation()}
                                          title={`View ${emp.name}'s report`}
                                          className="font-medium text-gray-700 truncate max-w-[130px] hover:text-indigo-600 hover:underline underline-offset-2"
                                        >
                                          {emp.name}
                                        </Link>
                                      ) : (
                                        <span className="font-medium text-gray-700 truncate max-w-[130px]">{emp.name}</span>
                                      )}
                                    </div>
                                  </td>
                                  {/* Designation */}
                                  <td className="py-3 pr-4 text-gray-500 text-xs">{emp.designation || "—"}</td>
                                  {/* Domain */}
                                  <td className="py-3 pr-4">
                                    {emp.domain
                                      ? <span className="px-2 py-0.5 bg-violet-50 text-violet-700 rounded-full text-xs font-medium">{emp.domain}</span>
                                      : <span className="text-gray-400">—</span>
                                    }
                                  </td>
                                  {/* Emp ID */}
                                  <td className="py-3 pr-4 text-gray-400 font-mono text-xs">{emp.employeeId || "—"}</td>
                                  {/* Last col */}
                                  <td className="py-3 pr-4 text-gray-400 text-xs">
                                    {!activeFilter || activeFilter === "absent"
                                      ? (emp.createdAt ? new Date(emp.createdAt).toLocaleDateString("en-GB") : "—")
                                      : activeFilter === "onLeave"
                                      ? <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">{emp.leaveType || "—"}</span>
                                      : <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(emp.checkInTime)}</span>
                                    }
                                  </td>
                                  {/* Check-Out col */}
                                  {cfg?.showCheckOut && (
                                    <td className="py-3 text-gray-400 text-xs">
                                      {emp.checkOutTime
                                        ? <span className="flex items-center gap-1 text-red-400"><Clock className="w-3 h-3" />{fmtTime(emp.checkOutTime)}</span>
                                        : <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-xs font-medium">Active</span>
                                      }
                                    </td>
                                  )}
                                  {/* Break Since col */}
                                  {cfg?.showBreak && (
                                    <td className="py-3 text-amber-500 text-xs">
                                      <span className="flex items-center gap-1">
                                        <Coffee className="w-3 h-3" />{fmtTime(emp.breakStartTime)}
                                        <span className="ml-1 text-amber-400">▾</span>
                                      </span>
                                    </td>
                                  )}
                                  {/* Breaks Today col (Present / Late) — count · total, opens the history */}
                                  {cfg?.showBreakSummary && (
                                    <td className="py-3 pl-4 text-xs">
                                      {emp.breakCount > 0 ? (
                                        <span className={`flex items-center gap-1 whitespace-nowrap ${emp.breakSecs > 60 * 60 ? "text-red-500" : "text-amber-600"}`}>
                                          <Coffee className="w-3 h-3" />
                                          {emp.breakCount} · {fmtDuration(emp.breakSecs)}
                                          {emp.onBreakNow && (
                                            <span className="ml-1 rounded-full border border-amber-300 px-1.5 text-[10px] font-semibold text-amber-600">on break</span>
                                          )}
                                          <span className={`ml-1 text-amber-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                                        </span>
                                      ) : (
                                        <span className="text-gray-300">—</span>
                                      )}
                                    </td>
                                  )}
                                  {/* Report col — always-visible entry to the Employee Report */}
                                  <td className="py-3 pl-4 text-right">
                                    {emp.employeeId ? (
                                      <Link
                                        to={`/employees/${encodeURIComponent(emp.employeeId)}/report`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-50"
                                      >
                                        <FileBarChart className="w-3 h-3" /> View report
                                      </Link>
                                    ) : (
                                      <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                </tr>

                                {/* ── Break history accordion ── */}
                                {isExpanded && (
                                  <tr key={`${emp._id}-expand`}>
                                    <td colSpan={colSpan} className="px-0 pb-3 pt-0">
                                      <div className={`mx-2 rounded-xl border ${isOverLimit ? "border-red-200 bg-red-50" : "border-amber-100 bg-amber-50"} px-4 py-3`}>
                                        <p className={`text-[11px] font-bold uppercase tracking-wide mb-2 ${isOverLimit ? "text-red-500" : "text-amber-600"}`}>
                                          <Coffee className="w-3 h-3 inline mr-1" />
                                          Break History Today — {emp.name}
                                        </p>

                                        {logs === null ? (
                                          <p className="text-xs text-gray-400 animate-pulse">Loading...</p>
                                        ) : logs.length === 0 ? (
                                          <p className="text-xs text-gray-400">No break records found for today.</p>
                                        ) : (
                                          <>
                                            <table className="w-full text-xs">
                                              <thead>
                                                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-amber-100">
                                                  <th className="pb-1.5 pr-4">#</th>
                                                  <th className="pb-1.5 pr-4">Start Time</th>
                                                  <th className="pb-1.5 pr-4">End Time</th>
                                                  <th className="pb-1.5">Duration</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-amber-100">
                                                {logs.map((b, idx) => {
                                                  const ongoing = !b.endTime;
                                                  return (
                                                    <tr key={b._id} className={ongoing ? "text-amber-600 font-semibold" : "text-gray-600"}>
                                                      <td className="py-1.5 pr-4">{idx + 1}</td>
                                                      <td className="py-1.5 pr-4">{fmtTime(b.startTime)}</td>
                                                      <td className="py-1.5 pr-4">
                                                        {ongoing
                                                          ? <span className="px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded text-[10px] font-bold">Ongoing</span>
                                                          : fmtTime(b.endTime)
                                                        }
                                                      </td>
                                                      <td className="py-1.5">
                                                        {ongoing
                                                          ? <span className="text-amber-500">{fmtTime(b.startTime)} →</span>
                                                          : fmtDuration(b.durationInSeconds)
                                                        }
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                            <div className={`mt-2 pt-2 border-t flex items-center justify-between ${isOverLimit ? "border-red-200" : "border-amber-100"}`}>
                                              <span className={`text-[11px] font-bold ${isOverLimit ? "text-red-600" : "text-amber-700"}`}>
                                                Total break today: {fmtDuration(totalSecs)}
                                              </span>
                                              {isOverLimit && (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">
                                                  Over 60 min limit
                                                </span>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-gray-400 text-sm">No employees found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right — 1/3 */}
        <div className="space-y-5">

          {/* Project Overview — ring tiles (same look as the Employee Report) */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Project Overview</h3>
              <span className="text-[11px] text-gray-400">{stats?.totalProjects || 0} total</span>
            </div>
            <ul className="space-y-2">
              {[
                { label: "Ongoing",   count: stats?.ongoingProjects   || 0, fill: PROJECT_STATUS_COLORS[0], track: "#ede9fe", note: "In progress right now" },
                { label: "Completed", count: stats?.completedProjects || 0, fill: PROJECT_STATUS_COLORS[1], track: "#cffafe", note: "Delivered" },
                { label: "Pending",   count: stats?.pendingProjects   || 0, fill: PROJECT_STATUS_COLORS[2], track: "#fef3c7", note: "Not started yet" },
              ].map(({ label, count, fill, track, note }) => {
                const total = stats?.totalProjects || 0;
                const pct = total ? count / total : 0;
                return (
                  <li key={label}
                    className="flex items-center gap-4 rounded-xl border p-3 transition hover:shadow-sm"
                    style={{ borderColor: `${fill}26`, background: `${fill}08` }}>
                    <MeterRing pct={pct} fill={fill} track={track} label={`${count} of ${total} projects ${label.toLowerCase()}`}>
                      <span className="text-[11px] font-black text-gray-700">{total ? `${Math.round(pct * 100)}%` : "—"}</span>
                      <span className="mt-0.5 text-[8px] font-semibold text-gray-400">of {total}</span>
                    </MeterRing>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800">{label}</p>
                      <p className="text-[11px] text-gray-400">{note}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-lg font-black leading-none ${count ? "text-gray-800" : "text-gray-300"}`}>{count}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{count === 1 ? "project" : "projects"}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Today's Attendance */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Today's Attendance</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "present",  label: "Present",  count: stats?.presentCount  ?? 0, Icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50",  ring: "ring-green-300",  activeBg: "bg-green-500"  },
                { key: "late",     label: "Late",     count: stats?.lateCount     ?? 0, Icon: AlertCircle,  color: "text-yellow-600", bg: "bg-yellow-50", ring: "ring-yellow-300", activeBg: "bg-yellow-400" },
                { key: "onLeave",  label: "On Leave", count: stats?.onLeaveCount  ?? 0, Icon: AlertCircle,  color: "text-blue-500",   bg: "bg-blue-50",   ring: "ring-blue-300",   activeBg: "bg-blue-500"   },
                { key: "absent",   label: "Absent",   count: stats?.absentCount   ?? 0, Icon: XCircle,      color: "text-red-500",    bg: "bg-red-50",    ring: "ring-red-300",    activeBg: "bg-red-500"    },
              ].map(({ key, label, count, Icon, color, bg, ring, activeBg }) => {
                const isActive = activeFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveFilter(isActive ? null : key)}
                    className={`flex flex-col items-center gap-2 p-2 rounded-xl transition-all cursor-pointer ${isActive ? "bg-gray-50 ring-1 ring-gray-200" : "hover:bg-gray-50"}`}
                  >
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center ring-2 transition-all ${isActive ? `${activeBg} ring-transparent` : `${bg} ${ring}`}`}>
                      <span className={`text-xl font-bold ${isActive ? "text-white" : color}`}>
                        {loading ? "—" : count}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icon className={`w-3.5 h-3.5 ${isActive ? "text-gray-600" : color}`} />
                      <span className={`text-xs font-medium ${isActive ? "text-gray-700" : "text-gray-500"}`}>{label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ongoing Projects */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Ongoing Projects</h3>
              <span className="text-xs font-semibold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full">
                {stats?.ongoingProjectsList?.length || 0}
              </span>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-36" />
                    <div className="h-2.5 bg-gray-100 rounded animate-pulse w-24" />
                  </div>
                ))}
              </div>
            ) : stats?.ongoingProjectsList?.length > 0 ? (() => {
                const rows = stats.ongoingProjectsList
                  .flatMap(proj => (proj.teamMembers || []).map(m => ({
                    empId: m.empId,
                    name: m.name,
                    manager: proj.manager,
                    projectId: proj.projectId,
                  })))
                  .sort((a, b) => a.projectId.localeCompare(b.projectId, undefined, { numeric: true }));
                return (
                  <div className="max-h-[240px] overflow-y-auto pr-1">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-gray-400 text-left border-b border-gray-100">
                          <th className="pb-2 font-semibold pr-2">Emp ID</th>
                          <th className="pb-2 font-semibold pr-2">Name</th>
                          <th className="pb-2 font-semibold pr-2">Manager</th>
                          <th className="pb-2 font-semibold">Project</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-1.5 pr-2 font-mono text-gray-400">{r.empId}</td>
                            <td className="py-1.5 pr-2 text-gray-700 truncate max-w-[70px]">{r.name}</td>
                            <td className="py-1.5 pr-2 text-gray-500 truncate max-w-[70px]">{r.manager}</td>
                            <td className="py-1.5 font-mono text-violet-500">{r.projectId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })() : (
              <p className="text-sm text-gray-400 text-center py-4">No ongoing projects</p>
            )}
          </div>

        </div>
      </div>

      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
    </div>
  );
};

export default AdminDashboard;