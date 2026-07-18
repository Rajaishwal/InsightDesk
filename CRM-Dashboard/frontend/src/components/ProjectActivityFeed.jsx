import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, ArrowRight, Play, Square, AlertTriangle, Activity } from "lucide-react";
import axios from "../services/axios";

const ACTION_CONFIG = {
  task_created:   { icon: Plus,          color: "text-emerald-600", bg: "bg-emerald-50",  label: "created task" },
  status_changed: { icon: ArrowRight,    color: "text-indigo-600",  bg: "bg-indigo-50",   label: "updated status" },
  timer_started:  { icon: Play,          color: "text-blue-600",    bg: "bg-blue-50",     label: "started timer on" },
  timer_stopped:  { icon: Square,        color: "text-gray-600",    bg: "bg-gray-100",    label: "stopped timer on" },
  revision_added: { icon: AlertTriangle, color: "text-red-600",     bg: "bg-red-50",      label: "added revision" },
};

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60)   return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const STATUS_COLOR = {
  Pending:   "text-amber-600 bg-amber-50",
  Ongoing:   "text-indigo-600 bg-indigo-50",
  Completed: "text-emerald-600 bg-emerald-50",
};

export default function ProjectActivityFeed({ projectId }) {
  const [activities, setActivities]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);

  const fetch = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const url = projectId
        ? `http://localhost:5000/api/project-activity?projectId=${projectId}`
        : "http://localhost:5000/api/project-activity";
      const res = await axios.get(url);
      setActivities(res.data.activities || []);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => fetch(true), 30_000);
    return () => clearInterval(id);
  }, [fetch]);

  const renderDescription = (act) => {
    const cfg = ACTION_CONFIG[act.action] || ACTION_CONFIG.task_created;
    const taskBit = <span className="font-semibold text-gray-800">"{act.taskTitle}"</span>;

    if (act.action === "status_changed") {
      return (
        <span>
          changed {taskBit}{" "}
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_COLOR[act.fromStatus] || "text-gray-500 bg-gray-100"}`}>
            {act.fromStatus}
          </span>
          {" → "}
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${STATUS_COLOR[act.toStatus] || "text-gray-500 bg-gray-100"}`}>
            {act.toStatus}
          </span>
        </span>
      );
    }

    return (
      <span>
        {cfg.label} {taskBit}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-semibold text-gray-800">Activity Feed</h2>
          {activities.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
              {activities.length} events
            </span>
          )}
        </div>
        <button
          onClick={() => fetch(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Feed */}
      <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Loading activity...</div>
        ) : activities.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">No activity yet. Task actions will appear here.</div>
        ) : (
          activities.map((act) => {
            const cfg = ACTION_CONFIG[act.action] || ACTION_CONFIG.task_created;
            const Icon = cfg.icon;
            return (
              <div key={act._id} className="flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50 transition">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {initials(act.userName)}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-1.5 text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">{act.userName}</span>
                    {renderDescription(act)}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {/* Project badge */}
                    <span className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-medium">
                      {act.projectName || act.projectId}
                    </span>
                    {/* Action icon badge */}
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {act.action.replace("_", " ")}
                    </span>
                    {/* Time */}
                    <span className="text-[11px] text-gray-400 ml-auto">{timeAgo(act.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}