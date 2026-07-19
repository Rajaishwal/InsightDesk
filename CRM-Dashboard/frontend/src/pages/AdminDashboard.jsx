import { useState, useEffect } from "react";
import EditProfileModal from "../components/EditProfileModal";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import { Users, UserPlus, Briefcase, CheckCircle2, AlertCircle, XCircle, X, Clock, Coffee, Pencil, MapPin } from "lucide-react";

const PIE_COLORS = ["#7c3aed", "#06b6d4", "#f59e0b"];

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(null); // 'present'|'late'|'onLeave'|'absent'
  const [showEditModal, setShowEditModal] = useState(false);
  const [locationStatus, setLocationStatus] = useState("checked-out");

  useEffect(() => {
    api.get("/users/admin-stats")
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?._id) return;
    api.get(`/attendance/status/${user._id}`)
      .then(r => setLocationStatus(r.data?.attendance?.status || "checked-out"))
      .catch(() => {});
  }, [user?._id]);

  const pieData = [
    { name: "Ongoing",   value: stats?.ongoingProjects   || 0 },
    { name: "Completed", value: stats?.completedProjects || 0 },
    { name: "Pending",   value: stats?.pendingProjects   || 0 },
  ].filter(d => d.value > 0);

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
              {/* Green status dot */}
              <span className="absolute bottom-1.5 right-1.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
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
              present: { label: "Present Employees",  dot: "bg-green-500",  lastCol: "Check-In",  showCheckOut: true  },
              late:    { label: "Late Employees",      dot: "bg-yellow-400", lastCol: "Check-In",  showCheckOut: true  },
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
                  {activeFilter && (
                    <button
                      onClick={() => setActiveFilter(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition"
                    >
                      <X className="w-3.5 h-3.5" /> Clear
                    </button>
                  )}
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {loading ? (
                          Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i}>
                              {Array.from({ length: 5 }).map((_, j) => (
                                <td key={j} className="py-3 pr-4">
                                  <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? 120 : 80 }} />
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : rows.length > 0 ? (
                          rows.map((emp, i) => (
                            <tr key={emp._id || i} className="hover:bg-gray-50 transition-colors">
                              {/* Name */}
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs flex-shrink-0 overflow-hidden">
                                    {emp.photo
                                      ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                                      : emp.name?.charAt(0)?.toUpperCase()
                                    }
                                  </div>
                                  <span className="font-medium text-gray-700 truncate max-w-[130px]">{emp.name}</span>
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
                              {/* Last col: Joined / Check-In / Leave Type */}
                              <td className="py-3 pr-4 text-gray-400 text-xs">
                                {!activeFilter || activeFilter === "absent"
                                  ? (emp.createdAt ? new Date(emp.createdAt).toLocaleDateString("en-GB") : "—")
                                  : activeFilter === "onLeave"
                                  ? <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">{emp.leaveType || "—"}</span>
                                  : <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(emp.checkInTime)}</span>
                                }
                              </td>
                              {/* Check-Out col (present / late only) */}
                              {cfg?.showCheckOut && (
                                <td className="py-3 text-gray-400 text-xs">
                                  {emp.checkOutTime
                                    ? <span className="flex items-center gap-1 text-red-400"><Clock className="w-3 h-3" />{fmtTime(emp.checkOutTime)}</span>
                                    : <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full text-xs font-medium">Active</span>
                                  }
                                </td>
                              )}
                              {/* Break Since col (onBreak only) */}
                              {cfg?.showBreak && (
                                <td className="py-3 text-amber-500 text-xs">
                                  <span className="flex items-center gap-1">
                                    <Coffee className="w-3 h-3" />{fmtTime(emp.breakStartTime)}
                                  </span>
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-gray-400 text-sm">No employees found</td>
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

          {/* Project Overview */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Project Overview</h3>
            <div className="space-y-4">
              {[
                { label: "Ongoing",   count: stats?.ongoingProjects   || 0, color: "bg-violet-500" },
                { label: "Completed", count: stats?.completedProjects || 0, color: "bg-cyan-500"   },
                { label: "Pending",   count: stats?.pendingProjects   || 0, color: "bg-amber-400"  },
              ].map(({ label, count, color }) => {
                const total = stats?.totalProjects || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-semibold text-gray-700">{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
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

          {/* Projects Pie Chart */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Projects Status</h3>
            {!loading && pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "4px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-300 text-sm">
                {loading ? "Loading…" : "No project data"}
              </div>
            )}
          </div>

        </div>
      </div>

      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
    </div>
  );
};

export default AdminDashboard;