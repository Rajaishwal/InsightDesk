import { useState, useEffect, useRef } from "react";
import { X, Plus, RefreshCw, GitCommitHorizontal, Play, Square, Clock } from "lucide-react";
import api from "../services/axios";
import { useAuth } from "../context/AuthContext";

const STATUS_STYLES = {
  Pending:   { dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-700" },
  Ongoing:   { dot: "bg-indigo-500",  badge: "bg-indigo-100 text-indigo-700" },
  Completed: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
};

// Format seconds → "1h 04m 32s" or "04m 32s" or "32s"
const fmtDuration = (secs) => {
  if (!secs && secs !== 0) return "0s";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
};

// Live ticking counter component
function LiveTimer({ startedAt, base }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const calc = () => Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    setElapsed(calc());
    const id = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="font-mono text-xs font-bold text-indigo-600">{fmtDuration(base + elapsed)}</span>;
}

export default function ProjectTracklist({ project, onClose, isManager }) {
  const { user } = useAuth();
  const [tasks, setTasks]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [addOpen, setAddOpen]             = useState(false);
  const [form, setForm]                   = useState({ title: "", description: "", isRevision: false });
  const [submitting, setSubmitting]       = useState(false);
  const [statusLoading, setStatusLoading] = useState(null);
  const [timerLoading, setTimerLoading]   = useState(null);
  const [toast, setToast]                 = useState(null);
  const bottomRef = useRef(null);

  const myId = user?._id || user?.id;

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get(`http://localhost:5000/api/project-tasks/${project.projectId}`);
      setTasks(res.data.tasks || []);
    } catch {
      showToast("error", "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [project.projectId]);

  // Returns the current user's timer entry for a task
  const myTimer = (task) => task.timers?.find(t => t.userId === myId || t.userId?._id === myId || t.userId?.toString?.() === myId);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      setSubmitting(true);
      await api.post(`http://localhost:5000/api/project-tasks/${project.projectId}`, form);
      setForm({ title: "", description: "", isRevision: false });
      setAddOpen(false);
      await fetchTasks();
      showToast("success", "Task added");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to add task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId, status, isRevision) => {
    try {
      setStatusLoading(taskId);
      await api.put(`http://localhost:5000/api/project-tasks/${taskId}/status`, { status });
      setTasks(prev =>
        prev.map(t =>
          t._id === taskId
            ? { ...t, status, completedAt: status === "Completed" ? new Date() : t.completedAt }
            : t
        )
      );
      if (isRevision && status === "Completed") {
        showToast("success", "Revision complete — manager has been notified.");
      }
    } catch {
      showToast("error", "Failed to update status");
    } finally {
      setStatusLoading(null);
    }
  };

  const handleTimerToggle = async (task) => {
    const timer   = myTimer(task);
    const running = !!timer?.timerStartedAt;
    const action  = running ? "stop" : "start";
    try {
      setTimerLoading(task._id);
      const res = await api.post(`http://localhost:5000/api/project-tasks/${task._id}/timer/${action}`);
      setTasks(prev => prev.map(t => t._id === task._id ? res.data.task : t));
      if (!running) showToast("success", "Timer started");
    } catch (err) {
      showToast("error", err.response?.data?.message || `Failed to ${action} timer`);
    } finally {
      setTimerLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
                {project.projectId}
              </span>
              <h2 className="text-lg font-bold mt-1.5 leading-tight">{project.title}</h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                {tasks.length} task{tasks.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={fetchTasks} className="p-1.5 rounded-lg hover:bg-white/15 transition" title="Refresh">
                <RefreshCw size={14} />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
                <X size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="py-20 text-center text-gray-400 text-sm">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <GitCommitHorizontal size={22} className="text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No tasks yet</p>
              <p className="text-gray-400 text-xs mt-1">Add the first task below</p>
            </div>
          ) : (
            <div>
              {tasks.map((task, i) => {
                const isLast   = i === tasks.length - 1;
                const style    = STATUS_STYLES[task.status] || STATUS_STYLES.Pending;
                const dotCls   = task.isRevision ? "bg-red-500" : style.dot;
                const badgeCls = task.isRevision ? "bg-red-100 text-red-700" : style.badge;
                const timer    = myTimer(task);
                const running  = !!timer?.timerStartedAt;
                const base     = timer?.totalTimeLogged || 0;
                const busy     = timerLoading === task._id || statusLoading === task._id;

                return (
                  <div key={task._id} className="flex gap-4 relative">
                    {/* Spine */}
                    <div className="flex flex-col items-center flex-shrink-0 pt-1">
                      <div className={`w-3 h-3 rounded-full ${dotCls} ring-2 ring-white shadow z-10 flex-shrink-0
                        ${running ? "animate-pulse" : ""}`} />
                      {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1 min-h-[24px]" />}
                    </div>

                    {/* Card */}
                    <div className={`flex-1 mb-5 bg-gray-50 rounded-xl border p-4 min-w-0 transition
                      ${running ? "border-indigo-300 bg-indigo-50/40" : "border-gray-100"}
                      ${busy ? "opacity-70" : ""}`}>

                      {/* Title + Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-gray-800">{task.title}</span>
                          {task.isRevision && (
                            <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">
                              Revision
                            </span>
                          )}
                        </div>
                        <select
                          value={task.status}
                          disabled={busy}
                          onChange={(e) => handleStatusChange(task._id, e.target.value, task.isRevision)}
                          className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer
                            focus:outline-none focus:ring-1 focus:ring-indigo-400 ${badgeCls}`}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Ongoing">Ongoing</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>

                      {/* Description */}
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-2 leading-relaxed">{task.description}</p>
                      )}

                      {/* Timer row */}
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 gap-2">
                        {/* Left: timer display */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Clock size={12} className={running ? "text-indigo-500" : "text-gray-300"} />
                          {running ? (
                            <LiveTimer startedAt={timer.timerStartedAt} base={base} />
                          ) : base > 0 ? (
                            <span className="text-xs text-gray-400 font-mono">{fmtDuration(base)} logged</span>
                          ) : (
                            <span className="text-xs text-gray-300">No time logged</span>
                          )}
                        </div>

                        {/* Right: play/stop + creator */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Creator avatar */}
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0
                              ${task.createdByRole === "employee" ? "bg-indigo-400" : "bg-slate-600"}`}>
                              {task.createdByName?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[11px] text-gray-400 hidden sm:inline">{task.createdByName}</span>
                          </div>

                          {/* Timer button */}
                          {task.status !== "Completed" && (
                            <button
                              onClick={() => handleTimerToggle(task)}
                              disabled={busy}
                              title={running ? "Stop timer" : "Start timer"}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50
                                ${running
                                  ? "bg-red-100 text-red-600 hover:bg-red-200"
                                  : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"}`}
                            >
                              {running
                                ? <><Square size={11} className="fill-current" /> Stop</>
                                : <><Play  size={11} className="fill-current" /> Start</>}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Team timers summary (others who also logged time) */}
                      {task.timers?.filter(t => (t.totalTimeLogged > 0 || t.timerStartedAt) && (t.userId?.toString?.() !== myId && t.userId !== myId)).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {task.timers
                            .filter(t => (t.totalTimeLogged > 0 || t.timerStartedAt) && (t.userId?.toString?.() !== myId && t.userId !== myId))
                            .map((t, idx) => (
                              <span key={idx} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="font-medium">{t.userName}</span>
                                <span className="text-gray-400">{fmtDuration(t.totalTimeLogged)}</span>
                                {t.timerStartedAt && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Add Task */}
        <div className="border-t border-gray-100 bg-white flex-shrink-0">
          {!addOpen ? (
            <button
              onClick={() => setAddOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-4 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition"
            >
              <Plus size={16} /> Add Task
            </button>
          ) : (
            <form onSubmit={handleAddTask} className="px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">New Task</span>
                <button
                  type="button"
                  onClick={() => { setAddOpen(false); setForm({ title: "", description: "", isRevision: false }); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={15} />
                </button>
              </div>

              <input
                type="text"
                placeholder="Task title *"
                value={form.title}
                onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                required
                autoFocus
              />

              <textarea
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />

              {isManager && (
                <label
                  className="flex items-center gap-2.5 cursor-pointer select-none"
                  onClick={() => setForm(p => ({ ...p, isRevision: !p.isRevision }))}
                >
                  <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5
                    ${form.isRevision ? "bg-red-500" : "bg-gray-200"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform
                      ${form.isRevision ? "translate-x-4" : "translate-x-0"}`} />
                  </div>
                  <span className={`text-xs font-medium ${form.isRevision ? "text-red-600" : "text-gray-500"}`}>
                    {form.isRevision ? "Revision task" : "Mark as Revision"}
                  </span>
                </label>
              )}

              <button
                type="submit"
                disabled={submitting || !form.title.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition"
              >
                {submitting ? "Adding..." : "Add Task"}
              </button>
            </form>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`absolute bottom-24 left-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
            ${toast.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}