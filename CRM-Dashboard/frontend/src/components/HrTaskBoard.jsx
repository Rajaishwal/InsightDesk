// HrTaskBoard.jsx — Employee panel showing HR-assigned tasks with timer controls and status updates
import { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, CheckCircle2, Timer, ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../services/axios";

const fmt = (s) => {
  const n = Math.max(0, s);
  return [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
    .map(v => String(v).padStart(2, "0")).join(":");
};

const CHIP = {
  "Assigned":    "bg-indigo-50  text-indigo-700",
  "In Progress": "bg-amber-50   text-amber-700",
  "Completed":   "bg-emerald-50 text-emerald-700",
  "Failed":      "bg-red-50     text-red-700",
};

const STATUS_OPTIONS = ["Assigned", "In Progress", "Completed", "Failed"];

/* ── Status dropdown badge ── */
function StatusBadge({ status, taskId, onStatusChange }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = async (newStatus) => {
    if (newStatus === status) { setOpen(false); return; }
    setOpen(false);
    setSaving(true);
    try {
      await api.put(`/hr-tasks/${taskId}`, { status: newStatus });
      onStatusChange(taskId, newStatus);
    } catch { toast.error("Failed to update status"); }
    finally { setSaving(false); }
  };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full transition hover:opacity-80 ${CHIP[status] || "bg-gray-100 text-gray-500"}`}>
        {saving
          ? <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
          : <>{status}<ChevronDown className="w-2.5 h-2.5" /></>
        }
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-50 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[130px]">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => select(s)}
              className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-gray-50 transition
                ${s === status ? "text-indigo-600" : "text-gray-700"}`}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── HR Task Row ── */
function HrTaskRow({ task, userId, onTaskUpdate }) {
  const toast = useToast();
  const myTimer = task.timers?.find(t => t.userId?.toString() === userId?.toString());
  const isRunning = !!myTimer?.timerStartedAt;

  const calcElapsed = () => {
    const base = myTimer?.totalTimeLogged || 0;
    if (!isRunning) return base;
    return base + Math.floor((Date.now() - new Date(myTimer.timerStartedAt)) / 1000);
  };

  const [elapsed, setElapsed] = useState(calcElapsed);
  const [busy, setBusy]       = useState(false);
  const [localStatus, setLocalStatus] = useState(task.status);

  useEffect(() => {
    setElapsed(calcElapsed());
    if (!isRunning) return;
    const base    = myTimer?.totalTimeLogged || 0;
    const startAt = new Date(myTimer.timerStartedAt);
    const iv = setInterval(() => {
      setElapsed(base + Math.floor((Date.now() - startAt) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [isRunning, myTimer?.timerStartedAt, myTimer?.totalTimeLogged]);

  const handleTimer = async () => {
    setBusy(true);
    try {
      const action = isRunning ? "stop" : "start";
      const r = await api.post(`/hr-tasks/${task._id}/timer/${action}`);
      onTaskUpdate(r.data.task);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to toggle timer");
    } finally { setBusy(false); }
  };

  const done = localStatus === "Completed" || localStatus === "Failed";

  const handleStatusChange = (_id, newStatus) => {
    setLocalStatus(newStatus);
    onTaskUpdate({ ...task, status: newStatus });
  };

  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200
      ${done
        ? "bg-gray-50 border-gray-100"
        : isRunning
        ? "bg-indigo-50/50 border-indigo-200 shadow-sm"
        : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
      }`}>

      {/* Left bar */}
      <div className={`w-1 h-10 rounded-full flex-shrink-0 transition-all ${
        done ? "bg-emerald-400" : isRunning ? "bg-indigo-500" : "bg-gray-200"
      }`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate text-gray-800">
          {task.title}
        </p>
        {task.description && (
          <p className="text-[11px] text-gray-400 truncate mt-0.5">{task.description}</p>
        )}
        {task.assignedByName && (
          <span className="text-[10px] text-gray-400 mt-1 block">by {task.assignedByName}</span>
        )}
      </div>

      {/* Status badge — left of timer */}
      <StatusBadge status={localStatus} taskId={task._id} onStatusChange={handleStatusChange} />

      {/* Timer controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {done ? (
          <div className="flex items-center gap-1.5">
            {myTimer?.totalTimeLogged > 0 && (
              <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                {fmt(myTimer.totalTimeLogged)}
              </span>
            )}
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        ) : (
          <>
            <span className={`font-mono text-sm font-bold tabular-nums w-[68px] text-right
              ${isRunning ? "text-indigo-600" : "text-gray-500"}`}>
              {fmt(elapsed)}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleTimer}
                disabled={busy}
                title={isRunning ? "Pause" : "Start"}
                className={`p-1.5 rounded-lg transition disabled:opacity-50 ${
                  isRunning
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-600"
                    : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                }`}>
                {busy
                  ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : isRunning
                  ? <Pause className="w-3.5 h-3.5 fill-current" />
                  : <Play  className="w-3.5 h-3.5 fill-current" />
                }
              </button>
              {isRunning && (
                <button
                  onClick={handleTimer}
                  disabled={busy}
                  title="Stop"
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition disabled:opacity-30">
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main TaskBoard ── */
export default function HrTaskBoard() {
  const { user }              = useAuth();
  const [hrTasks, setHrTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = user?._id?.toString() || user?.id?.toString();

  useEffect(() => {
    if (!user) return;
    api.get("/hr-tasks/my")
      .then(r => { if (r.data.success) setHrTasks(r.data.tasks); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const onTaskUpdate = (updated) =>
    setHrTasks(prev => prev.map(t => t._id === updated._id ? updated : t));

  const visibleHr = hrTasks.filter(t => {
    if (t.status !== "Completed" && t.status !== "Failed") return true;
    const at = t.completedAt || t.updatedAt;
    return !at || Date.now() - new Date(at).getTime() < 86_400_000;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-bold text-gray-800">Task Board</h2>
        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold ml-1">
          {visibleHr.filter(t => t.status !== "Completed" && t.status !== "Failed").length} active
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
            : visibleHr.map(t => (
                <HrTaskRow key={t._id} task={t} userId={userId} onTaskUpdate={onTaskUpdate} />
              ))
          }
        </div>
      )}
    </div>
  );
}