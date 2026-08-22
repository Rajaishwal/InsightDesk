// LiveTaskTimer.jsx — Isolated "Today's Focus" ring that ticks every second.
// Lives in its own component so only it re-renders on each tick,
// leaving the rest of EmployeeDashboard completely undisturbed.

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import api from "../services/axios";
import { useAutoRefresh } from "../hooks/useAutoRefresh";

const TARGET_SEC = 6.5 * 3600;

const fmtHM = (sec) => {
  if (sec <= 0) return "0h 0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export default function LiveTaskTimer({ checkedOut = false }) {
  const [taskCompletedSec, setTaskCompletedSec] = useState(0);
  const [taskRunningAt, setTaskRunningAt]       = useState(null);
  const [now, setNow]                           = useState(new Date());

  const fetchTime = () =>
    api.get("/project-tasks/my-time-today")
      .then(r => {
        setTaskCompletedSec(r.data.completedSeconds || 0);
        setTaskRunningAt(r.data.isRunning ? new Date(r.data.runningStartedAt) : null);
      })
      .catch(() => {});

  // Fetch once on mount
  useEffect(() => { fetchTime(); }, []);

  // Tick every second — only this component re-renders, not the whole dashboard
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Refresh silently when a task event or checkout fires
  useAutoRefresh(fetchTime, ["crm:task:updated", "attendance:updated"]);

  /* ── Derived values ── */
  const runningSec    = (!checkedOut && taskRunningAt) ? Math.floor((now - taskRunningAt) / 1000) : 0;
  const actualTaskSec = checkedOut ? 0 : taskCompletedSec + runningSec;
  const remainingSec  = Math.max(0, TARGET_SEC - actualTaskSec);
  const taskPct       = Math.min(100, Math.round((actualTaskSec / TARGET_SEC) * 100));

  const arcColor  = actualTaskSec >= TARGET_SEC ? "#10b981"
                  : actualTaskSec >= 5 * 3600   ? "#f59e0b" : "#6366f1";
  const textColor = actualTaskSec >= TARGET_SEC ? "text-emerald-600"
                  : actualTaskSec >= 5 * 3600   ? "text-amber-500" : "text-indigo-600";

  const r    = 46;
  const circ = 2 * Math.PI * r;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-bold text-gray-800">Today's Focus</h2>
        {!checkedOut && taskRunningAt && (
          <span className="ml-auto flex items-center gap-1 text-[10px] border border-indigo-400 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
            Working
          </span>
        )}
        {checkedOut && (
          <span className="ml-auto text-[10px] text-gray-400 font-semibold">Checked out</span>
        )}
      </div>

      {/* Arc Ring */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative w-[130px] h-[130px]">
          <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
            <circle cx="55" cy="55" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle cx="55" cy="55" r={r} fill="none" stroke={arcColor} strokeWidth="10"
              strokeDasharray={`${(taskPct / 100) * circ} ${circ}`}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-[18px] font-black leading-none ${actualTaskSec > 0 ? textColor : "text-gray-300"}`}>
              {fmtHM(actualTaskSec)}
            </span>
            <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-widest mt-0.5">
              of 6.5h
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div className="h-px w-8 bg-gray-100" />
          <span className="text-[10px] text-gray-400 font-semibold">{taskPct}% complete</span>
          <div className="h-px w-8 bg-gray-100" />
        </div>
      </div>

      {/* Remaining time */}
      <div className={`rounded-xl p-3 text-center mb-3 ${
        checkedOut                  ? "bg-gray-50" :
        actualTaskSec >= TARGET_SEC ? "bg-emerald-50" :
        actualTaskSec >= 5 * 3600  ? "bg-amber-50"   : "bg-indigo-50/60"
      }`}>
        {checkedOut ? (
          <p className="text-sm font-semibold text-gray-400">Check in to start your focus</p>
        ) : actualTaskSec >= TARGET_SEC ? (
          <p className="text-sm font-black text-emerald-600">✓ Daily target reached!</p>
        ) : (
          <>
            <p className={`text-lg font-black ${textColor}`}>{fmtHM(remainingSec)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">remaining to reach 6.5h target</p>
          </>
        )}
      </div>

      {/* Timer status row */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-gray-400 font-semibold uppercase tracking-wide">Task Timer</span>
        {!checkedOut && taskRunningAt
            ? <span className="text-indigo-500 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
                Running now
              </span>
            : <span className="text-gray-300">No active timer</span>
        }
      </div>
    </div>
  );
}