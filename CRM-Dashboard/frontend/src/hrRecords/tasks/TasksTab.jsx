import { useState, useEffect, useMemo, useRef } from "react";
import api from "../../services/axios";
import { HrTaskForm } from "../../components/HrTaskCard";
import TasksTable from "./TasksTable";
import {
  CheckCircle2, Search, Clock, RotateCcw, Plus,
  X, ClipboardList, Loader2, Users,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────── */
const fmtShort = (ts) => {
  if (!ts) return "—";
  const d = new Date(ts);
  const diffMins = Math.floor((Date.now() - d) / 60000);
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const h = Math.floor(diffMins / 60);
  if (h < 24) return `${h}h ago`;
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
};

const startOf = (period) => {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week")  { const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  return null;
};

const PERIODS = [
  { id: "today", label: "Today"  },
  { id: "week",  label: "7 Days" },
  { id: "month", label: "Month"  },
  { id: "all",   label: "All"    },
];


/* ─────────────────────────────────────────────────────────
   Main TasksTab
───────────────────────────────────────────────────────── */
export default function TasksTab() {
  /* ── Completed tasks (global) ── */
  const [allCompleted,  setAllCompleted]  = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [period,        setPeriod]        = useState("today");

  /* ── Assign form ── */
  const [showForm, setShowForm] = useState(false);

  /* ── Unified search ── */
  const [query,         setQuery]         = useState("");
  const [suggestions,   setSuggestions]   = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropOpen,      setDropOpen]      = useState(false);

  /* ── Selected employee ── */
  const [employee,    setEmployee]    = useState(null);
  const [empTasks,    setEmpTasks]    = useState([]);
  const [taskLoading, setTaskLoading] = useState(false);

  const wrapRef = useRef(null);

  /* ── Load all completed tasks ── */
  const loadCompleted = () => {
    setRecentLoading(true);
    api.get("http://localhost:5000/api/hr-tasks/")
      .then(res => {
        const completed = (res.data.tasks || [])
          .filter(t => t.status === "Completed")
          .sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt));
        setAllCompleted(completed);
      })
      .catch(console.error)
      .finally(() => setRecentLoading(false));
  };

  useEffect(() => { loadCompleted(); }, []);

  /* ── Debounced employee search ── */
  useEffect(() => {
    if (!query.trim() || employee) { setSuggestions([]); setDropOpen(false); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get(`http://localhost:5000/api/users/search?query=${encodeURIComponent(query)}`);
        setSuggestions(res.data || []);
        setDropOpen(true);
      } catch { setSuggestions([]); }
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, employee]);

  /* ── Click outside dropdown ── */
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setDropOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ── Select employee → fetch their tasks ── */
  const selectEmployee = async (emp) => {
    const _id = typeof emp._id === "object" ? String(emp._id) : emp._id;
    setEmployee({ ...emp, _id });
    setQuery(`${emp.name}  (${emp.employeeId})`);
    setSuggestions([]);
    setDropOpen(false);
    setTaskLoading(true);
    try {
      const [selfRes, hrRes] = await Promise.all([
        api.get(`http://localhost:5000/api/tasks/user/${_id}`),
        api.get("http://localhost:5000/api/hr-tasks/assigned-by-me"),
      ]);
      const selfTasks = selfRes.data.tasks || [];
      const hrTasks   = (hrRes.data.tasks || []).filter(t => t.assignedTo === emp.employeeId);
      setEmpTasks([...selfTasks, ...hrTasks]);
    } catch { setEmpTasks([]); }
    finally { setTaskLoading(false); }
  };

  const clearEmployee = () => {
    setEmployee(null);
    setQuery("");
    setEmpTasks([]);
    setSuggestions([]);
    setDropOpen(false);
  };

  /* ── Filter completed tasks panel ── */
  const completedFiltered = useMemo(() => {
    const cutoff = startOf(period);
    return allCompleted.filter(t => {
      // Period filter
      const ts = t.completedAt || t.updatedAt;
      if (cutoff && ts && new Date(ts) < cutoff) return false;
      // If employee selected: filter to their tasks only
      if (employee) return t.assignedTo === employee.employeeId;
      // If text typed but no employee selected yet: filter by text
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          t.title?.toLowerCase().includes(q) ||
          t.assignedToName?.toLowerCase().includes(q) ||
          t.assignedTo?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allCompleted, period, employee, query]);

/* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <div className="p-6 space-y-5">

      {/* ── Unified Search Bar ── */}
      <div ref={wrapRef} className="relative">
        <div className={`flex items-center gap-2.5 px-4 py-3 border-2 rounded-xl bg-white shadow-sm transition-all ${
          dropOpen ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200 hover:border-gray-300"
        }`}>
          {searchLoading
            ? <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />
            : <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          }

          {/* Selected employee pill */}
          {employee ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {employee.photo
                ? <img src={employee.photo} className="w-6 h-6 rounded-lg object-cover flex-shrink-0" alt="" />
                : <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {employee.name?.[0]?.toUpperCase()}
                  </div>
              }
              <span className="text-sm font-semibold text-gray-800 truncate">{employee.name}</span>
              <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded flex-shrink-0">
                {employee.employeeId}
              </span>
              {employee.designation && (
                <span className="text-[11px] text-gray-400 truncate hidden sm:block">{employee.designation}</span>
              )}
            </div>
          ) : (
            <input
              type="text"
              placeholder="Search employee by name or ID — select to view their tasks…"
              value={query}
              onChange={e => { setQuery(e.target.value); }}
              onFocus={() => suggestions.length > 0 && setDropOpen(true)}
              className="flex-1 text-sm outline-none placeholder:text-gray-400 bg-transparent"
            />
          )}

          {/* Clear */}
          {(query || employee) && (
            <button onClick={clearEmployee} className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {dropOpen && suggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Users className="w-3 h-3" /> {suggestions.length} employee{suggestions.length !== 1 ? "s" : ""} found
            </p>
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
              {suggestions.map(emp => {
                const id = typeof emp._id === "object" ? String(emp._id) : emp._id;
                return (
                  <button key={id} type="button" onMouseDown={() => selectEmployee(emp)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition text-left">
                    {emp.photo
                      ? <img src={emp.photo} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" alt="" />
                      : <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase() || "?"}
                        </div>
                    }
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800">{emp.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{emp.employeeId}</span>
                        {emp.designation && <span className="text-[11px] text-gray-400">{emp.designation}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* No results */}
        {dropOpen && !searchLoading && query.trim() && !employee && suggestions.length === 0 && (
          <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
            No employees found for "{query}"
          </div>
        )}
      </div>


      {/* ── Recent Completed Tasks panel ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 flex-wrap gap-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-sm font-bold text-gray-800">
              {employee ? `${employee.name}'s Completed Tasks` : "Recent Completed Tasks"}
            </span>
            <span className="text-[11px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
              {completedFiltered.length}
              {!employee && period !== "all" && allCompleted.length !== completedFiltered.length
                ? ` / ${allCompleted.length}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Period tabs */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-md transition-all ${
                    period === p.id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}>{p.label}</button>
              ))}
            </div>
            {/* Assign */}
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-xs font-bold bg-gray-800 text-white px-3.5 py-2 rounded-lg hover:bg-indigo-700 transition whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Assign New Task
            </button>
            {/* Refresh */}
            <button onClick={loadCompleted} title="Refresh"
              className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {recentLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />Loading…
          </div>
        ) : completedFiltered.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">
            {employee
              ? `No completed tasks for ${employee.name} in this period.`
              : "No completed tasks for this period."}
          </div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: "340px" }}>
            <table className="min-w-full">
              <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Task", "Emp ID", "Employee", "Time Taken", "Status", "Completed"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {completedFiltered.map((task, i) => (
                  <tr key={task._id} className={`transition hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-sm font-medium text-gray-800 truncate" title={task.title}>{task.title}</p>
                      {task.description && <p className="text-[11px] text-gray-400 truncate">{task.description}</p>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{task.assignedTo || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{task.assignedToName || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {task.taskCompletionTime
                        ? <span className="font-mono text-sm font-bold text-emerald-600">{task.taskCompletionTime}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Completed
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                        {fmtShort(task.completedAt || task.updatedAt)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!recentLoading && completedFiltered.length > 0 && (
          <div className="px-5 py-2 border-t border-gray-100 bg-gray-50/60 text-[11px] text-gray-400 flex items-center justify-between">
            <span>Showing {completedFiltered.length} completed task{completedFiltered.length !== 1 ? "s" : ""}</span>
            {!employee && period !== "all" && allCompleted.length > completedFiltered.length && (
              <button onClick={() => setPeriod("all")} className="text-indigo-500 hover:text-indigo-700 font-semibold">
                View all {allCompleted.length} →
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── All tasks for selected employee ── */}
      {employee && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
            <ClipboardList className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-gray-800">All Tasks — {employee.name}</span>
            <span className="text-[11px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">{empTasks.length}</span>
          </div>
          <div className="p-4">
            <TasksTable tasks={empTasks} loading={taskLoading} setTasks={setEmpTasks} />
          </div>
        </div>
      )}

      {/* ── Assign Task modal ── */}
      {showForm && (
        <HrTaskForm onClose={() => { setShowForm(false); loadCompleted(); }} />
      )}
    </div>
  );
}