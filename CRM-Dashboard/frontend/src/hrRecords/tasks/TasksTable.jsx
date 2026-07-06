import { Trash2Icon } from "lucide-react";
import axios from "../../services/axios";

const STATUS_CHIP = {
  "Completed":   "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "In Progress": "bg-amber-50   text-amber-700   border border-amber-200",
  "Assigned":    "bg-indigo-50  text-indigo-700  border border-indigo-200",
  "Failed":      "bg-red-50     text-red-700     border border-red-200",
};

const fmt = (ts) =>
  ts ? new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const TasksTable = ({ tasks, loading, setTasks }) => {
  if (loading)
    return <div className="text-center py-10 text-gray-500 font-medium">Loading tasks…</div>;

  if (!tasks.length)
    return <div className="text-center py-10 text-gray-500 font-medium">No tasks found for this employee.</div>;

  // Completed tasks first (most recently completed), then others newest first
  const sorted = [...tasks].sort((a, b) => {
    const aDone = a.status === "Completed";
    const bDone = b.status === "Completed";
    if (aDone && !bDone) return -1;
    if (!aDone && bDone) return 1;
    if (aDone && bDone)
      return new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const handleDelete = async (taskId) => {
    const task = tasks.find(t => t._id === taskId);
    if (!task) return;
    if (!confirm(`Delete task "${task.title}"?`)) return;
    try {
      await axios.delete(`http://localhost:5000/api/hr-tasks/${taskId}`);
      setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete task.");
    }
  };

  return (
    <div className="overflow-x-auto bg-white shadow rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {["Task Title", "Description", "Assigned By", "Status", "Time Taken", "Completed At", "Created", ""].map(h => (
              <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sorted.map(task => {
            const done = task.status === "Completed";
            return (
              <tr key={task._id} className={`transition ${done ? "bg-emerald-50/40 hover:bg-emerald-50" : "hover:bg-gray-50"}`}>
                {/* Title */}
                <td className="px-5 py-4 text-sm font-medium text-gray-900 max-w-[180px]">
                  <span className={done ? "line-through text-gray-400" : ""}>{task.title}</span>
                </td>

                {/* Description */}
                <td className="px-5 py-4 text-sm text-gray-500 max-w-[200px] truncate">
                  {task.description || <span className="text-gray-300">—</span>}
                </td>

                {/* Assigned by */}
                <td className="px-5 py-4 text-sm text-gray-700 whitespace-nowrap">
                  {task.assignedBy ? (task.assignedByName || "HR") : (task.createdByName || "Self")}
                </td>

                {/* Status */}
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${STATUS_CHIP[task.status] || "bg-gray-100 text-gray-500"}`}>
                    {task.status || "—"}
                  </span>
                </td>

                {/* Time taken (taskCompletionTime from timer) */}
                <td className="px-5 py-4 whitespace-nowrap">
                  {task.taskCompletionTime
                    ? <span className="font-mono text-sm font-bold text-emerald-600">{task.taskCompletionTime}</span>
                    : <span className="text-gray-300 text-sm">—</span>
                  }
                </td>

                {/* Completed at */}
                <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                  {done ? fmt(task.completedAt || task.updatedAt) : <span className="text-gray-300">—</span>}
                </td>

                {/* Created */}
                <td className="px-5 py-4 text-xs text-gray-400 whitespace-nowrap">
                  {fmt(task.createdAt)}
                </td>

                {/* Delete (HR-assigned only) */}
                <td className="px-5 py-4">
                  {task.assignedBy && (
                    <button onClick={() => handleDelete(task._id)} className="text-gray-300 hover:text-red-500 transition">
                      <Trash2Icon className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TasksTable;