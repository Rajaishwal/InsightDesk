import { useState, useEffect } from "react";
import { Play, Pause, Square, CheckCircle2, Timer } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";

/* ─────────────────────────────────────────────────────────
   Timer helpers — timestamp-based so reload doesn't lose time
───────────────────────────────────────────────────────── */
const LS = {
  get:    (k)    => localStorage.getItem(k),
  set:    (k, v) => localStorage.setItem(k, String(v)),
  del:    (k)    => localStorage.removeItem(k),
  active: ()     => localStorage.getItem("_activeTimer"),
};

const getElapsed = (id) => {
  const base    = Number(LS.get(`_t${id}base`)) || 0;
  const startAt = Number(LS.get(`_t${id}start`)) || 0;
  return startAt ? base + Math.floor((Date.now() - startAt) / 1000) : base;
};

const fmt = (s) => {
  const n = Math.max(0, s);
  return [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
    .map(v => String(v).padStart(2, "0")).join(":");
};

/* ─────────────────────────────────────────────────────────
   useTaskTimer hook
───────────────────────────────────────────────────────── */
function useTaskTimer(id, disabled) {
  const [secs, setSecs]       = useState(() => getElapsed(id));
  const [running, setRunning] = useState(
    () => !disabled && LS.active() === id && !!LS.get(`_t${id}start`)
  );

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setSecs(getElapsed(id)), 500);
    return () => clearInterval(iv);
  }, [running, id]);

  const start = () => {
    const active = LS.active();
    if (active && active !== id) { alert("Another timer is running — stop it first."); return; }
    LS.set("_activeTimer", id);
    LS.set(`_t${id}base`,  secs);
    LS.set(`_t${id}start`, Date.now());
    setRunning(true);
  };

  const pause = () => {
    const saved = getElapsed(id);
    LS.set(`_t${id}base`, saved);
    LS.del(`_t${id}start`);
    LS.del("_activeTimer");
    setSecs(saved);
    setRunning(false);
  };

  const stop = () => {
    const elapsed = getElapsed(id);
    LS.del(`_t${id}base`);
    LS.del(`_t${id}start`);
    LS.del("_activeTimer");
    setRunning(false);
    setSecs(0);
    return fmt(elapsed);
  };

  return { secs, running, start, pause, stop };
}

/* ─────────────────────────────────────────────────────────
   HR Task Row with integrated timer
───────────────────────────────────────────────────────── */
const CHIP = {
  "Assigned":    "bg-indigo-50  text-indigo-700",
  "In Progress": "bg-amber-50   text-amber-700",
  "Completed":   "bg-emerald-50 text-emerald-700",
  "Failed":      "bg-red-50     text-red-700",
};

function HrTaskRow({ task, onComplete }) {
  const done   = !!task.taskCompletionTime || task.status === "Completed";
  const { secs, running, start, pause, stop } = useTaskTimer(task._id, done);
  const [saving, setSaving] = useState(false);
  const [localDone, setLocalDone] = useState(done);
  const [localTime, setLocalTime] = useState(task.taskCompletionTime || null);

  const handleStop = async () => {
    if (secs === 0 && !running) return;
    const timeTaken = stop();
    setSaving(true);
    try {
      await api.put(`http://localhost:5000/api/hr-tasks/${task._id}/time`, { timeTaken });
      setLocalTime(timeTaken);
      setLocalDone(true);
      onComplete(task._id, timeTaken);
    } catch {
      alert("Failed to save time. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200
      ${localDone
        ? "bg-gray-50 border-gray-100"
        : running
        ? "bg-indigo-50/50 border-indigo-200 shadow-sm"
        : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
      }`}
    >
      {/* Status bar */}
      <div className={`w-1 h-10 rounded-full flex-shrink-0 transition-all ${
        localDone ? "bg-emerald-400" : running ? "bg-indigo-500" : "bg-gray-200"
      }`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${localDone ? "text-gray-400 line-through" : "text-gray-800"}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5">{task.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CHIP[task.status] || "bg-gray-100 text-gray-500"}`}>
            {task.status}
          </span>
          {task.assignedByName && (
            <span className="text-[10px] text-gray-400">by {task.assignedByName}</span>
          )}
        </div>
      </div>

      {/* Timer */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {localDone ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
              {localTime || "—"}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        ) : (
          <>
            <span className={`font-mono text-sm font-bold tabular-nums w-[68px] text-right
              ${running ? "text-indigo-600" : "text-gray-500"}`}>
              {fmt(secs)}
            </span>
            <div className="flex items-center gap-1">
              {!running
                ? <button onClick={start} title="Start"
                    className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                : <button onClick={pause} title="Pause"
                    className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition">
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  </button>
              }
              <button onClick={handleStop} disabled={saving || (secs === 0 && !running)} title="Stop & Save"
                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition disabled:opacity-30 disabled:cursor-not-allowed">
                {saving
                  ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <Square className="w-3.5 h-3.5 fill-current" />
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main TaskBoard — HR assigned tasks only
───────────────────────────────────────────────────────── */
export default function TaskBoard() {
  const { user }              = useAuth();
  const [hrTasks, setHrTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.get("http://localhost:5000/api/hr-tasks/my")
      .then(r => { if (r.data.success) setHrTasks(r.data.tasks); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const visibleHr = hrTasks.filter(t => {
    if (t.status !== "Completed") return true;
    const at = t.completedAt || t.updatedAt;
    return !at || Date.now() - new Date(at).getTime() < 86_400_000;
  });

  const onHrComplete = (id, timeTaken) =>
    setHrTasks(p => p.map(t => t._id === id ? { ...t, taskCompletionTime: timeTaken, status: "Completed" } : t));

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-bold text-gray-800">Task Board</h2>
        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold ml-1">
          {visibleHr.length} hr
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">HR Assigned</p>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          {visibleHr.length === 0
            ? <div className="text-center py-5 text-sm text-gray-400 bg-gray-50 rounded-xl">No tasks assigned yet</div>
            : visibleHr.map(t => <HrTaskRow key={t._id} task={t} onComplete={onHrComplete} />)
          }
        </div>
      )}
    </div>
  );
}