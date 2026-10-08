import { useEffect, useState } from "react";
import api from "../services/axios";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { CheckCircle, XCircle, Check, X, RefreshCw } from "lucide-react";

const STATUS_CHIP = {
  Pending:  "border border-amber-400 text-amber-600",
  Approved: "border border-emerald-400 text-emerald-600",
  Rejected: "border border-red-400 text-red-500",
};

const fmt = (d) => new Date(d).toLocaleDateString();

export default function LeaveTab() {
  const [leaves, setLeaves] = useState([]);
  const [stats, setStats] = useState({ totalRequests: 0, pendingRequests: 0, approvedThisMonth: 0, rejectedThisMonth: 0 });
  const [filters, setFilters] = useState({ status: "all", startDate: "", endDate: "", page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ totalPages: 1, currentPage: 1, totalRecords: 0 });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const [actionLoading, setActionLoading] = useState(null); // leaveId being actioned

  const fetchLeaves = async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v && v !== "all") params.append(k, v); });
      const res = await api.get(`http://localhost:5000/api/leaves/hr/all-requests?${params}`);
      setLeaves(res.data.leaves || []);
      setPagination(res.data.pagination || { totalPages: 1, currentPage: 1, totalRecords: 0 });
    } catch {
      toast.error("Failed to load leave requests.");
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

  const confirmAction = async (leave, action) => {
    const approve = action === "Approved";
    const ok = await confirm({
      tone: approve ? "success" : "danger",
      title: approve ? "Approve leave?" : "Reject leave?",
      message: approve
        ? "The employee will be notified that their leave is approved."
        : "The employee will be notified that their leave is rejected.",
      confirmText: approve ? "Yes, approve" : "Yes, reject",
      details: (
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold
            ${approve ? "border-emerald-400 text-emerald-600" : "border-red-400 text-red-600"}`}>
            {leave.userName?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800">{leave.userName}</p>
            {leave.leaveType && (
              <p className="text-xs text-gray-400">{leave.leaveType} · {leave.totalDays} {leave.totalDays === 1 ? "day" : "days"}</p>
            )}
          </div>
        </div>
      ),
    });
    if (!ok) return;

    try {
      setActionLoading(leave._id);
      await api.put(`http://localhost:5000/api/leaves/hr/status/${leave._id}`, { status: action });
      toast.success(`Leave ${action.toLowerCase()} for ${leave.userName}.`);
      await fetchLeaves(true);
      await fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update leave status.");
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