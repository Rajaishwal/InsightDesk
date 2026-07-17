import { useEffect, useState } from "react";
import api from "../services/axios";
import { CheckCircle, XCircle, Check, X, RefreshCw } from "lucide-react";

const STATUS_CHIP = {
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-red-100 text-red-700",
};

const fmt = (d) => new Date(d).toLocaleDateString();

export default function LeaveTab() {
  const [leaves, setLeaves] = useState([]);
  const [stats, setStats] = useState({ totalRequests: 0, pendingRequests: 0, approvedThisMonth: 0, rejectedThisMonth: 0 });
  const [filters, setFilters] = useState({ status: "all", startDate: "", endDate: "", page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ totalPages: 1, currentPage: 1, totalRecords: 0 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null); // { leaveId, action: 'Approved'|'Rejected', name }
  const [actionLoading, setActionLoading] = useState(null); // leaveId being actioned

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchLeaves = async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v && v !== "all") params.append(k, v); });
      const res = await api.get(`http://localhost:5000/api/leaves/hr/all-requests?${params}`);
      setLeaves(res.data.leaves || []);
      setPagination(res.data.pagination || { totalPages: 1, currentPage: 1, totalRecords: 0 });
    } catch {
      showToast("error", "Failed to load leave requests.");
    } finally {
      if (!silent) setLoading(false); else setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("http://localhost:5000/api/leaves/hr/stats");
      setStats(res.data || {});
    } catch { /* silent */ }
  };

  useEffect(() => { fetchLeaves(); fetchStats(); }, [filters]);

  const handleFilterChange = (e) => {
    setFilters(p => ({ ...p, [e.target.name]: e.target.value, page: 1 }));
  };

  const resetFilters = () => setFilters({ status: "all", startDate: "", endDate: "", page: 1, limit: 20 });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLeaves(true), fetchStats()]);
    setRefreshing(false);
  };

  const confirmAction = (leave, action) => {
    setConfirm({ leaveId: leave._id, action, name: leave.userName, leaveType: leave.leaveType, days: leave.totalDays });
  };

  const executeAction = async () => {
    if (!confirm) return;
    try {
      setActionLoading(confirm.leaveId);
      await api.put(`http://localhost:5000/api/leaves/hr/status/${confirm.leaveId}`, { status: confirm.action });
      showToast("success", `Leave ${confirm.action.toLowerCase()} for ${confirm.name}.`);
      setConfirm(null);
      await fetchLeaves(true);
      await fetchStats();
    } catch (err) {
      showToast("error", err.response?.data?.message || "Failed to update leave status.");
      setConfirm(null);
    } finally {
      setActionLoading(null);
    }
  };

  const statsList = [
    { label: "Total", value: stats.totalRequests || 0, cls: "bg-indigo-50 text-indigo-700" },
    { label: "Pending", value: stats.pendingRequests || 0, cls: "bg-amber-50 text-amber-700" },
    { label: "Approved", value: stats.approvedThisMonth || 0, cls: "bg-emerald-50 text-emerald-700" },
    { label: "Rejected", value: stats.rejectedThisMonth || 0, cls: "bg-red-50 text-red-700" },
  ];

  return (
    <div className="leave-tab space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">

            {/* Gradient header */}
            <div className={`px-6 pt-6 pb-5 text-white text-center
              ${confirm.action === "Approved"
                ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
                : "bg-gradient-to-br from-red-400 to-red-600"}`}>
              <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center mx-auto mb-3">
                {confirm.action === "Approved"
                  ? <CheckCircle className="w-6 h-6 text-white" />
                  : <XCircle className="w-6 h-6 text-white" />}
              </div>
              <h3 className="text-lg font-bold tracking-tight">
                {confirm.action === "Approved" ? "Approve Leave?" : "Reject Leave?"}
              </h3>
              <p className="text-white/70 text-xs mt-1">This action will update the leave status</p>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {/* Employee info row */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3 mb-5">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0
                  ${confirm.action === "Approved" ? "bg-emerald-500" : "bg-red-500"}`}>
                  {confirm.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{confirm.name}</p>
                  {confirm.leaveType && (
                    <p className="text-xs text-gray-400">{confirm.leaveType} · {confirm.days} {confirm.days === 1 ? "day" : "days"}</p>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2.5">
                <button
                  onClick={executeAction}
                  disabled={!!actionLoading}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition disabled:opacity-60
                    ${confirm.action === "Approved"
                      ? "bg-emerald-500 hover:bg-emerald-600"
                      : "bg-red-500 hover:bg-red-600"}`}
                >
                  {actionLoading ? "Saving..." : confirm.action === "Approved" ? "Yes, Approve" : "Yes, Reject"}
                </button>
                <button
                  onClick={() => setConfirm(null)}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border border-gray-200 hover:bg-gray-50 text-gray-500 transition"
                >
                  Cancel
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsList.map(s => (
          <div key={s.label} className={`flex flex-col items-center justify-center p-4 rounded-xl shadow-sm ${s.cls}`}>
            <span className="text-2xl font-bold">{s.value}</span>
            <span className="text-xs font-medium mt-0.5">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm flex flex-wrap gap-3 items-center">
        <select
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="all">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <button onClick={resetFilters} className="px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition">
          Reset
        </button>
        <button onClick={handleRefresh} disabled={refreshing}
          className="ml-auto flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-700 transition">
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-end gap-1.5">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button key={i}
              onClick={() => setFilters(p => ({ ...p, page: i + 1 }))}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition
                ${pagination.currentPage === i + 1 ? "bg-indigo-500 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-600"}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-10 text-center text-gray-400 text-sm">Loading leave requests...</div>
      ) : leaves.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">No leave requests found</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Employee", "Leave Type", "Start", "End", "Days", "Reason", "Status", "Applied", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leaves.map((leave) => (
                <tr key={leave._id} className="hover:bg-indigo-50/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-700 leading-tight">{leave.userName}</div>
                    {leave.userEmployeeId && (
                      <div className="text-xs text-gray-400">ID: {leave.userEmployeeId}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{leave.leaveType}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(leave.startDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(leave.endDate)}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">{leave.totalDays}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{leave.reason || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CHIP[leave.status] || "bg-gray-100 text-gray-600"}`}>
                      {leave.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmt(leave.appliedAt)}</td>
                  <td className="px-4 py-3">
                    {leave.status === "Pending" ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => confirmAction(leave, "Approved")}
                          disabled={actionLoading === leave._id}
                          className="flex items-center justify-center w-8 h-8 text-emerald-600 hover:bg-emerald-100 rounded-full transition disabled:opacity-40"
                          title="Approve"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          onClick={() => confirmAction(leave, "Rejected")}
                          disabled={actionLoading === leave._id}
                          className="flex items-center justify-center w-8 h-8 text-red-500 hover:bg-red-100 rounded-full transition disabled:opacity-40"
                          title="Reject"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    ) : (
                      <span className={`flex items-center gap-1 text-xs font-medium ${leave.status === "Approved" ? "text-emerald-600" : "text-red-500"}`}>
                        {leave.status === "Approved" ? <Check size={13} /> : <X size={13} />}
                        {leave.status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}