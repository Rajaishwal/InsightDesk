import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import { Calendar, Clock, Layers, CheckSquare, User, TrendingUp, Pencil } from "lucide-react";
import EditProfileModal from "../components/EditProfileModal";
import TaskBoard from "../components/TaskBoard";

/* ── SVG Performance Ring ── */
const Ring = ({ percent, color, label, sub }) => {
  const r = 36, circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(percent, 0), 100) / 100 * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[88px] h-[88px]">
        <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="#f3f4f6" strokeWidth="8" />
          <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[17px] font-black text-gray-800">{percent}%</span>
        </div>
      </div>
      <p className="text-xs font-bold text-gray-700 text-center">{label}</p>
      <p className="text-[10px] text-gray-400 text-center">{sub}</p>
    </div>
  );
};

/* ── Calendar day status styles ── */
const DAY_STYLE = {
  present: "bg-emerald-100 text-emerald-700 font-semibold",
  late:    "bg-amber-100  text-amber-700   font-semibold",
  leave:   "bg-blue-100   text-blue-700    font-semibold",
  absent:  "bg-red-100    text-red-600     font-semibold",
  weekend: "bg-gray-50    text-gray-300",
  future:  "text-gray-200",
};
const STATUS_LABEL = { present:"Present", late:"Late (after 9:30)", leave:"On Leave", absent:"Absent", weekend:"Weekend", future:"—" };

const PROJ_CHIP = {
  "Ongoing":   "bg-blue-50   text-blue-700",
  "Completed": "bg-emerald-50 text-emerald-700",
  "Pending":   "bg-amber-50  text-amber-700",
};

const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    api.get("/users/employee-dashboard")
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
    completedTasks, totalTasks,
    attendanceRate, taskCompletionRate, avgWorkingHoursPerDay,
    calendarDays = [], projects = [], monthYear,
  } = data;

  /* ── Calendar grid ── */
  const firstDow    = calendarDays.length > 0 ? (new Date(calendarDays[0].date).getDay() + 6) % 7 : 0;
  const cells       = [...Array(firstDow).fill(null), ...calendarDays];
  const calRows     = [];
  for (let i = 0; i < cells.length; i += 7) calRows.push(cells.slice(i, i + 7));

  const statCards = [
    {
      label: "Days Present",
      value: attendanceDaysThisMonth,
      sub:   `of ${totalWorkingDaysThisMonth} working days`,
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

      {/* ── Profile header ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />
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

          {/* Attendance rate pill */}
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{monthYear}</p>
            <p className={`text-3xl font-black mt-0.5 ${attendanceRate >= 75 ? "text-emerald-600" : attendanceRate >= 50 ? "text-amber-500" : "text-red-500"}`}>
              {attendanceRate}%
            </p>
            <p className="text-[10px] text-gray-400">attendance rate</p>
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
                  ["bg-emerald-400", "Present"],
                  ["bg-amber-400",   "Late"],
                  ["bg-blue-400",    "On Leave"],
                  ["bg-red-400",     "Absent"],
                ].map(([cls, lbl]) => (
                  <div key={lbl} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${cls}`} />
                    <span className="text-[10px] text-gray-500">{lbl}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Day name row */}
            <div className="grid grid-cols-7 mb-1">
              {["M","T","W","T","F","S","S"].map((d, i) => (
                <div key={i} className={`text-center text-[11px] font-bold py-1 ${i >= 5 ? "text-gray-300" : "text-gray-400"}`}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="space-y-1">
              {calRows.map((row, ri) => (
                <div key={ri} className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 7 }).map((_, ci) => {
                    const cell = row[ci];
                    if (!cell) return <div key={ci} />;
                    return (
                      <div
                        key={ci}
                        onMouseEnter={() => setHoveredDay(cell)}
                        onMouseLeave={() => setHoveredDay(null)}
                        className={`
                          h-9 rounded-lg flex items-center justify-center text-[13px]
                          cursor-default select-none transition-opacity
                          ${DAY_STYLE[cell.status] || "text-gray-200"}
                          ${cell.isToday ? "ring-2 ring-indigo-500 ring-offset-1" : ""}
                        `}
                      >
                        {cell.day}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Hover info strip */}
            <div className={`mt-3 overflow-hidden transition-all duration-200 ${hoveredDay && hoveredDay.status !== "weekend" && hoveredDay.status !== "future" ? "max-h-20" : "max-h-0"}`}>
              {hoveredDay && (
                <div className="px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-700">
                      {new Date(hoveredDay.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
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
          <TaskBoard />
        </div>

        {/* RIGHT */}
        <div className="space-y-5">

          {/* Performance rings */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-gray-800">Performance</h2>
            </div>

            <div className="flex justify-around">
              <Ring
                percent={attendanceRate}
                color="#10b981"
                label="Attendance Rate"
                sub={`${attendanceDaysThisMonth} of ${totalWorkingDaysThisMonth} days`}
              />
              <Ring
                percent={taskCompletionRate}
                color="#6366f1"
                label="Task Completion"
                sub={`${completedTasks} of ${totalTasks} tasks`}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Avg Hours/Day</p>
                <p className="text-xl font-black text-gray-800 mt-0.5">{avgWorkingHoursPerDay}<span className="text-sm font-semibold text-gray-400">h</span></p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Total Hours</p>
                <p className="text-xl font-black text-gray-800 mt-0.5">{workingHoursThisMonth}<span className="text-sm font-semibold text-gray-400">h</span></p>
              </div>
            </div>
          </div>

          {/* Projects */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-bold text-gray-800">Projects</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-blue-50   text-blue-600   px-2 py-0.5 rounded font-bold">{activeProjects} active</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-bold">{completedProjects} done</span>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Layers className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">No projects assigned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((proj) => (
                  <div key={proj._id} className="p-3 rounded-lg border border-gray-100 hover:border-violet-200 hover:bg-violet-50/30 transition">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold text-gray-400 font-mono tracking-widest">{proj.projectId}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${PROJ_CHIP[proj.status] || "bg-gray-100 text-gray-500"}`}>
                        {proj.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 leading-tight">{proj.title}</p>
                    {proj.manager && (
                      <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                        <User className="w-3 h-3" />{proj.manager}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}