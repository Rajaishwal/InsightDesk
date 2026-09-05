// EmployeeDashboard.jsx — Employee home dashboard: focus ring, project task cards, HR task board, calendar
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { getCache, setCache } from "../utils/pageCache";
import { Calendar, Clock, Layers, CheckSquare, User, Pencil, ListChecks, MapPin } from "lucide-react";
import EditProfileModal from "../components/EditProfileModal";
import HrTaskBoard from "../components/HrTaskBoard";
import ProjectTaskDrawer from "../components/ProjectTaskDrawer";
import LiveTaskTimer from "../components/LiveTaskTimer";

/* ── Calendar day status styles ── */
const DAY_STYLE = {
  present:    ["bg-emerald-100 hover:bg-emerald-200", "text-emerald-700"],
  late:       ["bg-amber-100   hover:bg-amber-200",   "text-amber-700"],
  leave:      ["bg-blue-100    hover:bg-blue-200",    "text-blue-700"],
  "half-leave": [null, "text-blue-700"],   // background handled via inline gradient
  absent:     ["bg-red-100     hover:bg-red-200",     "text-red-600"],
  weekend:    ["bg-gray-50",                          "text-gray-300 cursor-default"],
  future:     ["bg-white",                            "text-gray-200 cursor-default"],
};
const STATUS_LABEL = { present:"Present", late:"Late (after 9:30)", leave:"On Leave", "half-leave":"Half Day Leave", absent:"Absent", weekend:"Weekend", future:"—" };

const LEAVE_ABBR = {
  "Planned Leave":          "PL",
  "Wellness Leave":         "SL",
  "Polling Leave":          "PoL",
  "Unplanned Leave (LOP)":  "LOP",
};

const PROJ_CHIP = {
  "Ongoing":   "border border-blue-400    text-blue-600",
  "Completed": "border border-emerald-400 text-emerald-600",
  "Pending":   "border border-amber-400   text-amber-600",
};

const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(getCache("emp-dashboard") || null);
  const [loading, setLoading] = useState(!getCache("emp-dashboard"));
  const [hoveredDay, setHoveredDay] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tracklistProject, setTracklistProject] = useState(null);
  const [locationStatus, setLocationStatus] = useState(null);

  useEffect(() => {
    api.get("/users/employee-dashboard")
      .then(r => { setData(r.data); setCache("emp-dashboard", r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?._id) return;
    api.get(`/attendance/status/${user._id}`)
      .then(r => setLocationStatus(r.data?.attendance?.status || "checked-out"))
      .catch(() => setLocationStatus("checked-out"));
  }, [user?._id]);

  // Silent background refresh — swaps data in-place, no loading flash
  const silentRefresh = () => Promise.all([
    api.get("/users/employee-dashboard").then(r => { setData(r.data); setCache("emp-dashboard", r.data); }).catch(() => {}),
    user?._id
      ? api.get(`/attendance/status/${user._id}`)
          .then(r => setLocationStatus(r.data?.attendance?.status || "checked-out"))
          .catch(() => {})
      : Promise.resolve(),
  ]);
  useAutoRefresh(silentRefresh, ["crm:attendance:updated", "crm:task:updated"]);

  // Task timer lives in <LiveTaskTimer /> — no polling here

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  );
  if (!data) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <p className="text-sm text-gray-400">Failed to load dashboard.</p>
    </div>
  );

  const {
    attendanceDaysThisMonth, workingHoursThisMonth, totalWorkingDaysThisMonth,
    activeProjects, completedProjects, totalProjects,
    activeTimerProjectId,
    completedTasks, totalTasks,
    taskCompletionRate, avgWorkingHoursPerDay,
    calendarDays = [], projects = [], monthYear,
  } = data;

  // Project with active timer first → then Ongoing → Pending → Completed
  const STATUS_ORDER = { Ongoing: 0, Pending: 1, Completed: 2 };
  const sortedProjects = [...projects].sort((a, b) => {
    const aActive = a.projectId === activeTimerProjectId ? -1 : 0;
    const bActive = b.projectId === activeTimerProjectId ? -1 : 0;
    if (aActive !== bActive) return aActive - bActive;
    return (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1);
  });

  /* ── Calendar grid ── */
  const firstDow    = calendarDays.length > 0 ? (new Date(calendarDays[0].date).getDay() + 6) % 7 : 0;
  const cells       = [...Array(firstDow).fill(null), ...calendarDays];
  const calRows     = [];
  for (let i = 0; i < cells.length; i += 7) calRows.push(cells.slice(i, i + 7));

  /* ── Task time lives in <LiveTaskTimer /> ── */

  const statCards = [
    {
      label: "Days Present",
      value: attendanceDaysThisMonth,
      sub:   `of ${totalWorkingDaysThisMonth} working days this week`,
      Icon:  Calendar,
      iconBg: "bg-emerald-50", iconColor: "text-emerald-600",
      accent: "border-l-4 border-emerald-400",
    },
    {
      label: "Work Hours",
      value: `${workingHoursThisMonth}h`,
      sub:   `avg ${avgWorkingHoursPerDay}h / day`,
      Icon:  Clock,
      iconBg: "bg-indigo-50", iconColor: "text-indigo-600",
      accent: "border-l-4 border-indigo-400",
    },
    {
      label: "Projects",
      value: activeProjects,
      sub:   `${completedProjects} completed · ${totalProjects} total`,
      Icon:  Layers,
      iconBg: "bg-violet-50", iconColor: "text-violet-600",
      accent: "border-l-4 border-violet-400",
    },
    {
      label: "Tasks Done",
      value: `${completedTasks}/${totalTasks}`,
      sub:   `${taskCompletionRate}% completion rate`,
      Icon:  CheckSquare,
      iconBg: "bg-amber-50", iconColor: "text-amber-600",
      accent: "border-l-4 border-amber-400",
    },
  ];

  return (
    <div className="p-5 bg-gray-50 min-h-screen space-y-5">
      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
      {tracklistProject && (
        <ProjectTaskDrawer
          project={tracklistProject}
          onClose={() => setTracklistProject(null)}
          isManager={user?.role !== "employee"}
        />
      )}

      {/* ── Profile header ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />
        <div className="px-6 py-4 flex items-center gap-5">
          {/* Avatar with hover edit button */}
          <div className="group relative w-14 h-14 flex-shrink-0">
            {/* Inner div handles overflow-hidden for photo crop */}
            <div className="w-full h-full rounded-2xl overflow-hidden bg-indigo-100 border-2 border-indigo-100">
              {user?.photo
                ? <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl font-black text-indigo-600">
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </div>
              }
            </div>
            {/* Edit button — 50% in / 50% out of top-right corner */}
            <button
              onClick={() => setShowEditModal(true)}
              className="absolute -top-[4px] -right-[4px] w-[18px] h-[18px] rounded-full bg-white border border-gray-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 shadow-sm"
            >
              <Pencil className="w-2.5 h-2.5 text-indigo-600" />
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{user?.name}</h1>
            <p className="text-sm text-indigo-600 font-medium">{user?.designation || user?.role}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {user?.employeeId && (
                <span className="text-[11px] font-bold text-gray-400 font-mono tracking-widest">{user.employeeId}</span>
              )}
              {user?.domain && (
                <span className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-semibold">{user.domain}</span>
              )}
              {user?.shiftTiming && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />{user.shiftTiming}
                </span>
              )}
            </div>
          </div>

          {/* Location status badge */}
          <div className="flex-shrink-0 text-center">
            {locationStatus === "checked-in" ? (
              <div className="flex flex-col items-center gap-1">
                <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Active</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100">
                  <MapPin className="w-5 h-5 text-gray-400" />
                </div>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Inactive</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, Icon, iconBg, iconColor, accent }) => (
          <div key={label} className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${accent}`}>
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
                <p className="text-2xl font-black text-gray-800 mt-1 leading-none">{value}</p>
                <p className="text-[11px] text-gray-400 mt-1.5 truncate">{sub}</p>
              </div>
              <div className={`${iconBg} p-2.5 rounded-xl flex-shrink-0 ml-2`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 2-col ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_310px] gap-5">

        {/* LEFT */}
        <div className="space-y-5">

          {/* Monthly Attendance Calendar */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-800">Monthly Attendance</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">{monthYear}</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                {[
                  ["bg-emerald-400", null, "Present"],
                  ["bg-amber-400",   null, "Late"],
                  ["bg-blue-400",    null, "On Leave"],
                  ["bg-red-400",     null, "Absent"],
                ].map(([cls, , lbl]) => (
                  <div key={lbl} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${cls}`} />
                    <span className="text-[10px] text-gray-500">{lbl}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Day header row */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-t-lg overflow-hidden">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
                <div key={i} className={`text-center text-[10px] font-bold py-1.5 tracking-wide
                  ${i === 6 ? "text-rose-500 bg-rose-50" : "text-gray-500 bg-gray-50"}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar flat grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-b-lg overflow-hidden">
              {calRows.flat().map((cell, idx) => {
                const ci = idx % 7;
                const isSunday = ci === 6;

                if (!cell) {
                  return (
                    <div key={idx} className={`h-9 ${isSunday ? "bg-rose-50" : "bg-white"}`} />
                  );
                }

                const isInactive = cell.status === "weekend" || cell.status === "future";
                const isHalfLeave = cell.status === "half-leave";
                const [bg, text] = isSunday && isInactive
                  ? ["bg-rose-50", "text-rose-200 cursor-default"]
                  : (DAY_STYLE[cell.status] || ["bg-white", "text-gray-200 cursor-default"]);

                return (
                  <button
                    key={idx}
                    onMouseEnter={() => setHoveredDay(cell)}
                    onMouseLeave={() => setHoveredDay(null)}
                    style={isHalfLeave ? { background: "linear-gradient(to right, #d1fae5 50%, #dbeafe 50%)" } : undefined}
                    className={`
                      relative h-9 flex items-center justify-center
                      text-[11px] font-bold select-none transition-colors duration-150
                      ${isHalfLeave ? "" : `${bg} ${text}`}
                      ${cell.isToday ? "ring-2 ring-inset ring-indigo-400" : ""}
                    `}
                  >
                    {isHalfLeave ? (
                      <>
                        <span className="absolute left-[25%] -translate-x-1/2 text-[11px] font-bold text-emerald-700">{cell.day}</span>
                        <span className="absolute right-[25%] translate-x-1/2 text-[9px] font-black text-blue-700 leading-none tracking-wide">HD</span>
                      </>
                    ) : cell.day}
                    {cell.status === "leave" && cell.leaveType && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] font-black text-blue-600 leading-none tracking-wide">
                        {LEAVE_ABBR[cell.leaveType] ?? cell.leaveType}
                      </span>
                    )}
                    {isSunday && (
                      <span className="absolute top-0.5 right-0.5 text-[6px] text-rose-300 leading-none">☀</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Hover info strip */}
            <div className={`mt-3 overflow-hidden transition-all duration-200 ${hoveredDay && hoveredDay.status !== "weekend" && hoveredDay.status !== "future" ? "max-h-20" : "max-h-0"}`}>
              {hoveredDay && (
                <div className="px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-700">
                      {new Date(hoveredDay.date).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{STATUS_LABEL[hoveredDay.status]}</p>
                  </div>
                  {hoveredDay.checkIn && (
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-gray-600">In: {fmtTime(hoveredDay.checkIn)}</p>
                      <p className="text-[11px] text-gray-400">Out: {fmtTime(hoveredDay.checkOut)}</p>
                      {hoveredDay.workingHours > 0 && (
                        <p className="text-[11px] font-bold text-indigo-600">{hoveredDay.workingHours}h worked</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Task Board with live timers */}
          <HrTaskBoard />
        </div>

        {/* RIGHT */}
        <div className="space-y-5">

          {/* Today's Focus — isolated component, only it ticks every second */}
          <LiveTaskTimer checkedOut={locationStatus === "checked-out"} />

          {/* Projects */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-bold text-gray-800">Projects</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] border border-blue-400    text-blue-600   px-2 py-0.5 rounded font-bold">{activeProjects} active</span>
                <span className="text-[10px] border border-emerald-400 text-emerald-600 px-2 py-0.5 rounded font-bold">{completedProjects} done</span>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Layers className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No projects assigned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedProjects.map((proj) => {
                  const hasActiveTimer = proj.projectId === activeTimerProjectId;
                  return (
                  <button
                    key={proj._id}
                    onClick={() => setTracklistProject(proj)}
                    className={`w-full text-left p-3 rounded-lg border transition group
                      ${hasActiveTimer
                        ? "border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50/70"
                        : "border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/40"}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-gray-400 font-mono tracking-widest">{proj.projectId}</span>
                        {hasActiveTimer && (
                          <span className="flex items-center gap-1 text-[9px] text-indigo-500 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                            Timer running
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PROJ_CHIP[proj.status] || "border border-gray-300 text-gray-500"}`}>
                        {proj.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{proj.title}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      {proj.manager && (
                        <p className="text-[11px] text-gray-400 flex items-center gap-1">
                          <User className="w-3 h-3" />{proj.manager}
                        </p>
                      )}
                      <span className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition ml-auto">
                        <ListChecks className="w-3 h-3" />View tasks
                      </span>
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}