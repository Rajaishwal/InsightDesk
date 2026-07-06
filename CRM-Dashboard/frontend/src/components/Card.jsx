import { useState, useEffect } from "react";
import { Check, FolderOpen, CalendarCheck2, BarChart2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";

const RANK_LEVELS = [
  { label: "Beginner",    emoji: "🌱", min: 0,   max: 10,       bar: "bg-gray-400"    },
  { label: "Contributor", emoji: "💼", min: 10,  max: 25,       bar: "bg-blue-500"    },
  { label: "Rising Star", emoji: "⭐", min: 25,  max: 50,       bar: "bg-cyan-500"    },
  { label: "Senior",      emoji: "🔥", min: 50,  max: 80,       bar: "bg-green-500"   },
  { label: "Expert",      emoji: "👑", min: 80,  max: 120,      bar: "bg-orange-500"  },
  { label: "Elite",       emoji: "🏆", min: 120, max: Infinity, bar: "bg-purple-500"  },
];

const getRank = (tasksCompleted, attendanceDays) => {
  const score = tasksCompleted * 4 + attendanceDays * 2;
  const idx   = Math.max(0, RANK_LEVELS.findIndex(l => score >= l.min && score < l.max));
  const level = RANK_LEVELS[idx];
  const next  = RANK_LEVELS[idx + 1] || null;
  const progress = level.max === Infinity
    ? 100
    : Math.min(((score - level.min) / (level.max - level.min)) * 100, 100);
  return { ...level, score, progress: Math.round(progress), next };
};

const StatBox = ({ icon: Icon, label, value, accent, iconBg, borderColor }) => (
  <div className={`flex flex-col items-center py-5 px-4 border-t-2 ${borderColor}`}>
    <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
      <Icon className={`w-5 h-5 ${accent}`} />
    </div>
    <span className="text-2xl font-extrabold text-gray-800 tracking-tight">
      {value !== undefined && value !== null
        ? value
        : <span className="text-gray-300 font-normal text-xl">—</span>}
    </span>
    <span className="text-xs text-gray-400 mt-1 font-medium text-center leading-tight">{label}</span>
  </div>
);

const ProgressRow = ({ label, pct, text, barColor }) => (
  <div className="flex-1 min-w-0">
    <div className="flex justify-between items-center mb-1.5">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-[11px] font-bold text-gray-600">{text}</span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${barColor} rounded-full transition-all duration-700`}
        style={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%` }}
      />
    </div>
    <p className="text-[10px] text-gray-400 mt-1">{pct}%</p>
  </div>
);

const Card = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/users/profile-stats")
      .then(r => setStats(r.data))
      .catch(() => setStats({}));
  }, []);

  const rank      = stats ? getRank(stats.tasksCompleted || 0, stats.attendanceDaysThisMonth || 0) : null;
  const taskPct   = stats?.totalTasks ? Math.round((stats.tasksCompleted / stats.totalTasks) * 100) : 0;
  const attendPct = Math.round(Math.min(((stats?.attendanceDaysThisMonth || 0) / 22), 1) * 100);
  const hoursPct  = Math.round(Math.min(((stats?.monthlyWorkingHours || 0) / 160), 1) * 100);

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className="mx-6 mt-4 mb-5 rounded-2xl overflow-hidden shadow-md border border-gray-100 bg-white">

      {/* ── Light gradient header ── */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border-b border-indigo-100 px-7 py-5">
        <div className="flex items-center justify-between gap-6">

          {/* Avatar + Info */}
          <div className="flex items-center gap-5">
            {user?.photo ? (
              <img
                src={user.photo}
                alt={user?.name}
                className="w-[68px] h-[68px] rounded-2xl object-cover ring-[3px] ring-indigo-200 shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="w-[68px] h-[68px] rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold ring-[3px] ring-indigo-200 flex-shrink-0 shadow-sm select-none">
                {initials}
              </div>
            )}

            <div>
              <h2 className="text-gray-800 text-lg font-bold leading-tight tracking-tight">
                {user?.name || "Employee"}
              </h2>
              <p className="text-indigo-600 text-sm font-semibold mt-0.5">
                {user?.designation || "Not Set"}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {user?.domain && (
                  <span className="bg-indigo-100 text-indigo-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg">
                    {user.domain}
                  </span>
                )}
                {user?.employeeId && (
                  <span className="bg-blue-100 text-blue-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-lg">
                    {user.employeeId}
                  </span>
                )}
                {user?.shiftTiming && (
                  <span className="text-gray-400 text-[11px] font-medium">
                    {user.shiftTiming}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Rank card */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            {rank ? (
              <>
                <div className="bg-white border border-indigo-100 shadow-sm rounded-2xl px-5 py-3 text-center min-w-[90px]">
                  <div className="text-2xl mb-1">{rank.emoji}</div>
                  <div className="text-gray-700 text-xs font-bold tracking-wide uppercase">{rank.label}</div>
                  <div className="text-gray-400 text-[10px] mt-0.5">Score: {rank.score}</div>
                </div>
                {rank.next ? (
                  <div className="text-center">
                    <div className="w-24 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${rank.bar} rounded-full transition-all duration-700`}
                        style={{ width: `${rank.progress}%` }}
                      />
                    </div>
                    <p className="text-gray-400 text-[10px] mt-1">{rank.progress}% → {rank.next.label}</p>
                  </div>
                ) : (
                  <p className="text-indigo-400 text-[10px] font-medium">Maximum rank 🎉</p>
                )}
              </>
            ) : (
              <div className="bg-white border border-indigo-100 rounded-2xl px-5 py-3 text-gray-400 text-xs">Loading…</div>
            )}
            {user?.createdAt && (
              <p className="text-gray-400 text-[10px]">
                Since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </p>
            )}
          </div>

        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 divide-x divide-gray-100">
        <StatBox
          icon={Check}
          label="Tasks Done"
          value={stats?.tasksCompleted}
          accent="text-emerald-600"
          iconBg="bg-emerald-50"
          borderColor="border-emerald-400"
        />
        <StatBox
          icon={FolderOpen}
          label="Active Projects"
          value={stats?.activeProjects}
          accent="text-blue-600"
          iconBg="bg-blue-50"
          borderColor="border-blue-400"
        />
        <StatBox
          icon={CalendarCheck2}
          label="Days Present"
          value={stats?.attendanceDaysThisMonth}
          accent="text-violet-600"
          iconBg="bg-violet-50"
          borderColor="border-violet-400"
        />
        <StatBox
          icon={BarChart2}
          label="Leaves Taken"
          value={stats?.totalApprovedLeaveDays}
          accent="text-amber-600"
          iconBg="bg-amber-50"
          borderColor="border-amber-400"
        />
      </div>

      {/* ── Progress section ── */}
      <div className="flex items-center gap-8 px-7 py-4 bg-gray-50 border-t border-gray-100">
        <ProgressRow
          label="Task Completion"
          pct={taskPct}
          text={`${stats?.tasksCompleted || 0} / ${stats?.totalTasks || 0} tasks`}
          barColor="bg-emerald-500"
        />
        <div className="w-px h-8 bg-gray-200 flex-shrink-0" />
        <ProgressRow
          label="Monthly Attendance"
          pct={attendPct}
          text={`${stats?.attendanceDaysThisMonth || 0} days`}
          barColor="bg-violet-500"
        />
        <div className="w-px h-8 bg-gray-200 flex-shrink-0" />
        <ProgressRow
          label="Working Hours"
          pct={hoursPct}
          text={`${stats?.monthlyWorkingHours || 0}h / 160h`}
          barColor="bg-blue-500"
        />
      </div>

    </div>
  );
};

export default Card;