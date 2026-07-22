import { useState, useEffect } from "react";
import LeaveDonutChart, { LEAVE_TYPE_KEYS } from "../components/LeaveDonutChart";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import { RefreshCw, X, CalendarDays, FileText, Tag } from "lucide-react";

const LEAVE_META = {
  "Planned Leave": { color: "#6366f1", light: "#eef2ff", border: "border-indigo-400", text: "text-indigo-600", bg: "bg-indigo-50" },
  "Wellness Leave": { color: "#10b981", light: "#ecfdf5", border: "border-emerald-400", text: "text-emerald-600", bg: "bg-emerald-50" },
  "Polling Leave": { color: "#f59e0b", light: "#fffbeb", border: "border-amber-400", text: "text-amber-600", bg: "bg-amber-50" },
  "Unplanned Leave (LOP)": { color: "#ef4444", light: "#fef2f2", border: "border-red-400", text: "text-red-600", bg: "bg-red-50" },
};

const CODE_BASE = 'px-3 py-0.5 rounded-full text-xs font-medium border';
const STATUS_CHIP = {
  Approved: "border-emerald-500 text-emerald-600",
  Pending: "border-amber-500 text-amber-600",
  Rejected: "border-red-500 text-red-600",
};


const isWeekend = (d) => { const day = new Date(d).getDay(); return day === 0 || day === 6; };

const nextWorkingDay = (d) => {
  const date = new Date(d);
  while (isWeekend(date.toISOString().split("T")[0])) date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
};

const calcWorkingDays = (start, end) => {
  if (!start || !end) return 0;
  let count = 0;
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

const minDate = () => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return nextWorkingDay(t.toISOString().split("T")[0]);
};

const fmt = (d) => new Date(d).toLocaleDateString();

export default function LeaveManagement() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leaveStats, setLeaveStats] = useState({ taken: 0, pending: 0, remaining: 0, monthlyAllocation: null });
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }
  const [form, setForm] = useState({ startDate: "", endDate: "", leaveType: LEAVE_TYPE_KEYS[0], reason: "" });
  const [formErr, setFormErr] = useState("");

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLeaves = async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const res = await api.get("http://localhost:5000/api/leaves/my-leaves");
      setLeaves(res.data.leaves || []);
    } catch {
      if (!silent) showToast("error", "Failed to load leave requests.");
    } finally {
      if (!silent) setLoading(false); else setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get("http://localhost:5000/api/leaves/stats");
      const ma = res.data.monthlyAllocation;
      setLeaveStats({
        taken: res.data.totalDaysTaken || 0,
        pending: res.data.totalDaysPending || 0,
        remaining: Math.max(0, ma ? ma.remainingLeaves : 0),
        monthlyAllocation: ma,
      });
    } catch {
      /* silent */
    } finally {
      setStatsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLeaves(true), fetchStats()]);
    setRefreshing(false);
  };

  useEffect(() => {
    if (user) { fetchLeaves(); fetchStats(); }
  }, [user]);

  const handleDateChange = (field, val) => {
    if (!val) { setForm(p => ({ ...p, [field]: "" })); return; }
    setForm(p => ({ ...p, [field]: isWeekend(val) ? nextWorkingDay(val) : val }));
  };

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate || !form.leaveType) {
      setFormErr("Please fill in Start Date, End Date and Leave Type.");
      return;
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      setFormErr("End Date cannot be before Start Date.");
      return;
    }
    setFormErr("");
    try {
      setSubmitting(true);
      await api.post("http://localhost:5000/api/leaves/apply", {
        startDate: form.startDate,
        endDate: form.endDate,
        leaveType: form.leaveType,
        reason: form.reason,
      });
      setShowModal(false);
      setForm({ startDate: "", endDate: "", leaveType: LEAVE_TYPE_KEYS[0], reason: "" });
      showToast("success", "Leave application submitted successfully!");
      await fetchLeaves();
      await fetchStats();
    } catch (err) {
      setFormErr(err.response?.data?.message || "Failed to submit leave application.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (leaveId) => {
    try {
      setCancellingId(leaveId);
      await api.delete(`http://localhost:5000/api/leaves/cancel/${leaveId}`);
      showToast("success", "Leave request cancelled.");
      await fetchLeaves();
      await fetchStats();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to cancel leave.");
    } finally {
      setCancellingId(null);
    }
  };

  const workingDays = calcWorkingDays(form.startDate, form.endDate);

  return (
    <div className="page-container p-6 font-sans">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${toast.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between pl-5 mb-2">
        <h1 className="text-gray-500 text-sm font-bold uppercase">Leave Management</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition mr-6"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Yearly leave breakdown chart */}
      <LeaveDonutChart leaves={leaves} />

      {/* Leave requests table */}
      <div className="bg-white rounded-2xl shadow-lg mt-6 mx-6 p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-semibold text-gray-700">My Leave Requests</h3>
          <button
            onClick={() => setShowModal(true)}
            disabled={statsLoading || leaveStats.remaining <= 0}
            title={leaveStats.remaining <= 0 ? "No leaves remaining this month" : ""}
            className={`px-4 py-2 rounded-lg text-sm font-medium shadow transition-all
              ${statsLoading || leaveStats.remaining <= 0
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-indigo-500 hover:bg-indigo-600 text-white"}`}
          >
            + Request Leave
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Start Date", "End Date", "Type", "Days", "Reason", "Status", "Applied", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400">No leave requests yet</td>
                  </tr>
                ) : leaves.map((leave) => (
                  <tr key={leave._id} className="hover:bg-indigo-50/40 transition">
                    <td className="px-4 py-3 text-gray-700">{fmt(leave.startDate)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmt(leave.endDate)}</td>
                    <td className="px-4 py-3 text-gray-700">{leave.leaveType}</td>
                    <td className="px-4 py-3 font-medium text-gray-700">{leave.totalDays}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{leave.reason || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`${CODE_BASE} ${STATUS_CHIP[leave.status] || "border-gray-300 text-gray-600"}`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmt(leave.appliedAt)}</td>
                    <td className="px-4 py-3">
                      {leave.status === "Pending" && (
                        <button
                          onClick={() => handleCancel(leave._id)}
                          disabled={cancellingId === leave._id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium transition disabled:opacity-50"
                        >
                          {cancellingId === leave._id ? "Cancelling..." : "Cancel"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

            {/* Colored header */}
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-white font-semibold text-lg">Request Leave</h3>
                <p className="text-indigo-200 text-xs mt-0.5">Fill in the details below to apply</p>
              </div>
              <button
                onClick={() => { setShowModal(false); setFormErr(""); }}
                className="text-indigo-200 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* Error */}
              {formErr && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                  {formErr}
                </div>
              )}

              {/* Date row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    <CalendarDays size={12} /> Start Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none focus:border-transparent"
                    value={form.startDate}
                    min={minDate()}
                    onChange={(e) => handleDateChange("startDate", e.target.value)}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    <CalendarDays size={12} /> End Date
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none focus:border-transparent"
                    value={form.endDate}
                    min={form.startDate || minDate()}
                    onChange={(e) => handleDateChange("endDate", e.target.value)}
                  />
                </div>
              </div>

              {/* Working days pill */}
              {form.startDate && form.endDate && (
                <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
                  <span className="text-2xl font-bold text-indigo-600">{workingDays}</span>
                  <span className="text-sm text-indigo-500">working {workingDays === 1 ? "day" : "days"} requested
                    <span className="text-indigo-300 text-xs ml-1">(weekends excluded)</span>
                  </span>
                </div>
              )}

              {/* Leave type cards */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <Tag size={12} /> Leave Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_TYPE_KEYS.map(t => {
                    const m = LEAVE_META[t];
                    const active = form.leaveType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, leaveType: t }))}
                        className={`text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
                          ${active
                            ? `${m.border} ${m.bg} ${m.text}`
                            : "border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-gray-100"
                          }`}
                      >
                        <span className={`inline-block w-2 h-2 rounded-full mr-2`}
                          style={{ backgroundColor: active ? m.color : "#d1d5db" }} />
                        {t.replace(" (LOP)", "")}
                        {t.includes("LOP") && <span className="text-[10px] ml-1 opacity-60">(LOP)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <FileText size={12} /> Reason
                  <span className="normal-case font-normal text-gray-400 ml-1">— optional</span>
                </label>
                <textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm(p => ({ ...p, reason: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none focus:border-transparent resize-none placeholder-gray-300"
                  placeholder="Briefly describe the reason for your leave..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-sm shadow-indigo-200"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
                <button
                  onClick={() => { setShowModal(false); setFormErr(""); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm transition"
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}