// LeaveManagement.jsx — Employee leave application and leave history page
import { useState, useEffect } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { getCache, setCache } from "../utils/pageCache";
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
  const [leaves, setLeaves] = useState(getCache("leaves") || []);
  const [loading, setLoading] = useState(!getCache("leaves"));
  const [statsLoading, setStatsLoading] = useState(!getCache("leave-stats"));
  const [refreshing, setRefreshing] = useState(false);
  const [leaveStats, setLeaveStats] = useState(getCache("leave-stats") || { taken: 0, pending: 0, remaining: 0, monthlyAllocation: null });
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }
  const [form, setForm] = useState({ startDate: "", endDate: "", leaveType: LEAVE_TYPE_KEYS[0], reason: "", halfDay: false });

  // Leave types that support half-day option (Polling Leave excluded)
  const HALF_DAY_TYPES = ["Planned Leave", "Wellness Leave", "Unplanned Leave (LOP)"];
  const [formErr, setFormErr] = useState("");

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLeaves = async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const res = await api.get("http://localhost:5000/api/leaves/my-leaves");
      const list = res.data.leaves || [];
      setLeaves(list);
      setCache("leaves", list);
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
      const computed = {
        taken: res.data.totalDaysTaken || 0,
        pending: res.data.totalDaysPending || 0,
        remaining: Math.max(0, ma ? ma.remainingLeaves : 0),
        monthlyAllocation: ma,
      };
      setLeaveStats(computed);
      setCache("leave-stats", computed);
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

  useAutoRefresh(
    () => Promise.all([fetchLeaves(true), fetchStats()]),
    ["crm:leave:updated"]
  );

  const handleDateChange = (field, val) => {
    if (!val) { setForm(p => ({ ...p, [field]: "" })); return; }
    const adjusted = isWeekend(val) ? nextWorkingDay(val) : val;
    // When half-day is on, keep end date locked to start date
    if (field === "startDate" && form.halfDay) {
      setForm(p => ({ ...p, startDate: adjusted, endDate: adjusted }));
    } else {
      setForm(p => ({ ...p, [field]: adjusted }));
    }
  };

  const handleSubmit = async () => {
    if (!form.startDate || (!form.halfDay && !form.endDate) || !form.leaveType) {
      setFormErr("Please fill in Start Date, End Date and Leave Type.");
      return;
    }
    if (!form.halfDay && new Date(form.endDate) < new Date(form.startDate)) {
      setFormErr("End Date cannot be before Start Date.");
      return;
    }
    setFormErr("");
    try {
      setSubmitting(true);
      await api.post("http://localhost:5000/api/leaves/apply", {
        startDate: form.startDate,
        endDate: form.halfDay ? form.startDate : form.endDate,
        leaveType: form.leaveType,
        reason: form.reason,
        halfDay: form.halfDay,
      });
      setShowModal(false);
      setForm({ startDate: "", endDate: "", leaveType: LEAVE_TYPE_KEYS[0], reason: "", halfDay: false });
      showToast("success", "Leave application submitted successfully!");
      window.dispatchEvent(new CustomEvent("crm:leave:updated"));
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
      window.dispatchEvent(new CustomEvent("crm:leave:updated"));
      await fetchLeaves();
      await fetchStats();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to cancel leave.");
    } finally {
      setCancellingId(null);
    }
  };

  const workingDays = form.halfDay ? 0.5 : calcWorkingDays(form.startDate, form.endDate);

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
                  {["Start Date", "End Date", "Type", "Days", "Reason", "Status", "Applied", "Action"].map(h => (
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
                    <td className="px-4 py-3 font-medium text-gray-700">
                      {leave.halfDay
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-xs font-semibold">½ day</span>
                        : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border border-indigo-200 text-indigo-600 text-xs font-semibold bg-indigo-50">{leave.totalDays}</span>}
                    </td>
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
                          className="text-xs text-red-500 border border-red-300 hover:bg-red-50 font-semibold px-3 py-1 rounded-full transition disabled:opacity-50"
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
                onClick={() => { setShowModal(false); setFormErr(""); setForm({ startDate: "", endDate: "", leaveType: LEAVE_TYPE_KEYS[0], reason: "", halfDay: false }); }}
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
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none focus:border-transparent transition-colors
                      ${form.halfDay
                        ? "border-amber-200 bg-amber-50 text-amber-600 cursor-not-allowed"
                        : "border-gray-200 text-gray-700"}`}
                    value={form.halfDay ? form.startDate : form.endDate}
                    min={form.startDate || minDate()}
                    disabled={form.halfDay}
                    onChange={(e) => handleDateChange("endDate", e.target.value)}
                  />
                  {form.halfDay && (
                    <p className="text-[11px] text-amber-500 mt-1 ml-1">Same as start date for half-day</p>
                  )}
                </div>
              </div>

              {/* Working days pill */}
              {form.startDate && (form.halfDay || form.endDate) && (
                <div className={`flex items-center gap-2 border rounded-xl px-4 py-2.5 ${form.halfDay ? "bg-amber-50 border-amber-100" : "bg-indigo-50 border-indigo-100"}`}>
                  <span className={`text-2xl font-bold ${form.halfDay ? "text-amber-500" : "text-indigo-600"}`}>
                    {form.halfDay ? "½" : workingDays}
                  </span>
                  <span className={`text-sm ${form.halfDay ? "text-amber-600" : "text-indigo-500"}`}>
                    {form.halfDay ? "half day requested" : `working ${workingDays === 1 ? "day" : "days"} requested`}
                    {!form.halfDay && <span className="text-indigo-300 text-xs ml-1">(weekends excluded)</span>}
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
                        onClick={() => setForm(p => ({
                          ...p,
                          leaveType: t,
                          // Reset half-day when switching to Polling Leave
                          halfDay: HALF_DAY_TYPES.includes(t) ? p.halfDay : false,
                        }))}
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

              {/* Half-day toggle — only for PL, SL, LOP (not Polling Leave) */}
              {HALF_DAY_TYPES.includes(form.leaveType) && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-amber-700">Half Day</div>
                    <div className="text-xs text-amber-500 mt-0.5">Deducts 0.5 days from your leave balance</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !form.halfDay;
                      setForm(p => ({
                        ...p,
                        halfDay: next,
                        // Lock end date to start date when enabling half-day
                        ...(next && p.startDate ? { endDate: p.startDate } : {}),
                      }));
                    }}
                    className={`relative flex-shrink-0 w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 focus:outline-none ${form.halfDay ? "bg-amber-400" : "bg-gray-200"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.halfDay ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              )}

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
              <div className="pt-1">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Action</label>
                <div className="flex gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-full text-sm transition shadow-sm shadow-indigo-200"
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </button>
                  <button
                    onClick={() => { setShowModal(false); setFormErr(""); setForm({ startDate: "", endDate: "", leaveType: LEAVE_TYPE_KEYS[0], reason: "", halfDay: false }); }}
                    className="flex-1 border border-red-300 text-red-500 hover:bg-red-50 font-semibold py-2.5 rounded-full text-sm transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}