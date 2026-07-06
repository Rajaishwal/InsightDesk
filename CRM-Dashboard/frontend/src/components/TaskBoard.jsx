import { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, Plus, CheckCircle2, Trash2, Timer, X, Clock } from "lucide-react";
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
   Add-task panel with inline timer
───────────────────────────────────────────────────────── */
function AddTaskPanel({ onSaved, onCancel }) {
  const [secs, setSecs]       = useState(0);
  const [running, setRunning] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [title, setTitle]     = useState("");
  const [desc, setDesc]       = useState("");
  const [saving, setSaving]   = useState(false);
  const ivRef   = useRef(null);
  const baseRef = useRef(0);
  const atRef   = useRef(0);

  const clearIv = () => clearInterval(ivRef.current);
  useEffect(() => () => clearIv(), []);

  const startTimer = () => {
    atRef.current = Date.now();
    ivRef.current = setInterval(() => {
      setSecs(baseRef.current + Math.floor((Date.now() - atRef.current) / 1000));
    }, 500);
    setRunning(true);
  };

  const pauseTimer = () => {
    clearIv();
    baseRef.current += Math.floor((Date.now() - atRef.current) / 1000);
    setSecs(baseRef.current);
    setRunning(false);
  };

  const stopTimer = () => {
    clearIv();
    if (running) {
      baseRef.current += Math.floor((Date.now() - atRef.current) / 1000);
      setSecs(baseRef.current);
    }
    setRunning(false);
    setStopped(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await api.post("http://localhost:5000/api/tasks", {
        title: title.trim(),
        description: desc.trim(),
        taskCompletionTime: fmt(baseRef.current),
      });
      if (res.data.success) onSaved(res.data.task);
    } catch { alert("Failed to save task."); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/20 p-4 space-y-3">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> New Task Timer
        </span>
        <button onClick={onCancel} className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Timer display */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3.5 border border-indigo-100 shadow-sm">
        <span className={`font-mono text-3xl font-black tabular-nums ${running ? "text-indigo-600" : stopped ? "text-emerald-600" : "text-gray-700"}`}>
          {fmt(secs)}
        </span>
        <div className="flex items-center gap-2">
          {stopped ? (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Recorded
            </span>
          ) : (
            <>
              {!running
                ? <button onClick={startTimer}
                    className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3.5 py-2 rounded-lg hover:bg-indigo-700 transition">
                    <Play className="w-3.5 h-3.5 fill-current" /> Start
                  </button>
                : <button onClick={pauseTimer}
                    className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 text-white px-3.5 py-2 rounded-lg hover:bg-amber-600 transition">
                    <Pause className="w-3.5 h-3.5 fill-current" /> Pause
                  </button>
              }
              <button onClick={stopTimer} disabled={secs === 0 && !running}
                className="flex items-center gap-1.5 text-xs font-bold bg-red-500 text-white px-3.5 py-2 rounded-lg hover:bg-red-600 disabled:opacity-40 transition">
                <Square className="w-3.5 h-3.5 fill-current" /> Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Form — shown after stop */}
      {stopped && (
        <div className="space-y-2.5 pt-1">
          <input
            autoFocus
            type="text"
            placeholder="Task title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full text-sm px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white"
          />
          <textarea
            rows={2}
            placeholder="Description (optional)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            className="w-full text-sm px-3.5 py-2.5 border border-gray-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 bg-white resize-none"
          />
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[11px] text-gray-400">
              Time recorded: <strong className="text-gray-700 font-mono">{fmt(baseRef.current)}</strong>
            </span>
            <button onClick={handleSave} disabled={!title.trim() || saving}
              className="text-xs font-bold bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
              {saving ? "Saving…" : "Save Task"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main TaskBoard
───────────────────────────────────────────────────────── */
export default function TaskBoard() {
  const { user }                    = useAuth();
  const [hrTasks,   setHrTasks]     = useState([]);
  const [selfTasks, setSelfTasks]   = useState([]);
  const [loading,   setLoading]     = useState(true);
  const [showAdd,   setShowAdd]     = useState(false);

  useEffect(() => {
    const open = () => setShowAdd(true);
    window.addEventListener("openTaskTimer", open);
    return () => window.removeEventListener("openTaskTimer", open);
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get("http://localhost:5000/api/hr-tasks/my"),
      api.get(`http://localhost:5000/api/tasks/user/${user._id}`),
    ]).then(([hr, self]) => {
      if (hr.data.success)   setHrTasks(hr.data.tasks);
      if (self.data.success) setSelfTasks(self.data.tasks);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  /* HR tasks: show all except completed > 24h ago */
  const visibleHr = hrTasks.filter(t => {
    if (t.status !== "Completed") return true;
    const at = t.completedAt || t.updatedAt;
    return !at || Date.now() - new Date(at).getTime() < 86_400_000;
  });

  /* Self tasks: only today */
  const todaySelf = selfTasks.filter(t => {
    const d = new Date(t.createdAt), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  });

  const onHrComplete = (id, timeTaken) =>
    setHrTasks(p => p.map(t => t._id === id ? { ...t, taskCompletionTime: timeTaken, status: "Completed" } : t));

  const onSelfSaved = (task) => { setSelfTasks(p => [task, ...p]); setShowAdd(false); };

  const onDeleteSelf = async (id) => {
    if (!confirm("Delete this task?")) return;
    try { await api.delete(`/tasks/${id}`); setSelfTasks(p => p.filter(t => t._id !== id)); }
    catch { alert("Failed to delete task."); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-bold text-gray-800">Task Board</h2>
          <div className="flex items-center gap-1 ml-1">
            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold">{visibleHr.length} hr</span>
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">{todaySelf.length} mine</span>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition
            ${showAdd ? "bg-gray-100 text-gray-600" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
        >
          {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAdd ? "Cancel" : "Add with Timer"}
        </button>
      </div>

      {/* Add task panel */}
      {showAdd && <AddTaskPanel onSaved={onSelfSaved} onCancel={() => setShowAdd(false)} />}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── HR Assigned ── */}
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

          {/* ── My Tasks (Today) ── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">My Tasks · Today</p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            {todaySelf.length === 0
              ? <div className="text-center py-5 text-sm text-gray-400 bg-gray-50 rounded-xl">No self-tasks yet today</div>
              : todaySelf.map(t => (
                  <div key={t._id} className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition group">
                    <div className="w-1 h-9 bg-indigo-400 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{t.title}</p>
                      {t.description && <p className="text-[11px] text-gray-400 truncate mt-0.5">{t.description}</p>}
                    </div>
                    {t.taskCompletionTime && (
                      <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg flex-shrink-0">
                        {t.taskCompletionTime}
                      </span>
                    )}
                    <button onClick={() => onDeleteSelf(t._id)}
                      className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
            }
          </div>
        </>
      )}
    </div>
  );
}