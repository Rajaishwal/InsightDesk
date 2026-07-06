import React, { useEffect, useState } from "react";
import api from "../services/axios";
import { Check, CheckCircle, X, XCircle } from "lucide-react";

const LeaveTab = () => {
  // Leave management state
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveStats, setLeaveStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedThisMonth: 0,
    rejectedThisMonth: 0,
  });
  const [leaveFilters, setLeaveFilters] = useState({
    status: "all",
    page: 1,
    limit: 20,
    startDate: "",
    endDate: "",
  });
  const [leavePagination, setLeavePagination] = useState({
    totalPages: 1,
    currentPage: 1,
    totalRecords: 0,
  });
  const [leaveLoading, setLeaveLoading] = useState(false);

  // Fetch leave requests
  const fetchLeaveRequests = async () => {
    try {
      setLeaveLoading(true);
      const params = new URLSearchParams();
      Object.keys(leaveFilters).forEach((key) => {
        if (leaveFilters[key] && leaveFilters[key] !== "all") {
          params.append(key, leaveFilters[key]);
        }
      });
      const response = await api.get(`http://localhost:5000/api/leaves/hr/all-requests?${params}`);
      setLeaveRequests(response.data.leaves || []);
      setLeavePagination(response.data.pagination || { totalPages: 1, currentPage: 1, totalRecords: 0 });
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    } finally {
      setLeaveLoading(false);
    }
  };

  // Fetch leave stats
  const fetchLeaveStats = async () => {
    try {
      const response = await api.get("http://localhost:5000/api/leaves/hr/stats");
      setLeaveStats(response.data || {});
    } catch (error) {
      console.error("Error fetching leave stats:", error);
    }
  };

  // Update leave status
  const handleLeaveStatusUpdate = async (leaveId, status, hrComments = "") => {
    try {
      const response = await api.put(`http://localhost:5000/api/leaves/hr/status/${leaveId}`, { status, hrComments });
      if (response.status === 200) {
        alert(`Leave request ${status.toLowerCase()} successfully!`);
        fetchLeaveRequests();
        fetchLeaveStats();
      }
    } catch (error) {
      console.error("Error updating leave status:", error);
      alert("Error updating leave status");
    }
  };

  // Filter changes
  const handleLeaveFilterChange = (e) => {
    const { name, value } = e.target;
    setLeaveFilters((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  // Reset filters
  const resetLeaveFilters = () => {
    setLeaveFilters({
      status: "all",
      page: 1,
      limit: 20,
      startDate: "",
      endDate: "",
    });
  };

  // Page change
  const handleLeavePageChange = (newPage) => {
    setLeaveFilters((prev) => ({ ...prev, page: newPage }));
  };

  // Initial fetch
  useEffect(() => {
    fetchLeaveRequests();
    fetchLeaveStats();
  }, [leaveFilters]);

  // ----------------- Components inside LeaveTab -----------------

  const LeaveStatsCard = ({ stats }) => {
    const statsList = [
      { label: "Pending", value: stats.pending || 0, color: "bg-yellow-100 text-yellow-800" },
      { label: "Approved", value: stats.approved || 0, color: "bg-green-100 text-green-800" },
      { label: "Rejected", value: stats.rejected || 0, color: "bg-red-100 text-red-800" },
      { label: "Total", value: stats.total || 0, color: "bg-blue-100 text-blue-800" },
    ];

    return statsList.map((stat, index) => (
      <div key={index} className={`flex flex-col items-center justify-center p-4 rounded-lg shadow ${stat.color} `}>
        <span className="text-2xl font-semibold">{stat.value}</span>
        <span className="text-sm font-medium">{stat.label}</span>
      </div>
    ));
  };

  const LeaveFiltersComponent = ({ filters, setFilters }) => {
    const handleChange = (e) => {
      setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value, page: 1 }));
    };

    return (
      <div className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-700">Filter Leaves</h3>

        <select
          name="status"
          value={filters.status}
          onChange={handleChange}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">All</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>

        <input
          type="date"
          name="startDate"
          value={filters.startDate}
          onChange={handleChange}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="date"
          name="endDate"
          value={filters.endDate}
          onChange={handleChange}
          className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <button onClick={resetLeaveFilters} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">
          Reset Filters
        </button>
      </div>
    );
  };

  const LeaveTableComponent = ({ leaveRequests, leaveLoading, handleLeaveStatusUpdate }) => {
    if (leaveLoading) return <p>Loading leave requests...</p>;
    if (!leaveRequests.length) return <p>No leave requests found</p>;

    const formatDate = (date) => new Date(date).toLocaleDateString();

    return (
    <table className="attendance-table w-full  text-left border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="px-4 py-2 text-gray-600 text-sm font-medium">Employee</th>
          <th className="px-4 py-2 text-gray-600 text-sm font-medium">Leave Type</th>
          <th className="px-4 py-2 text-gray-600 text-sm font-medium">Start Date</th>
          <th className="px-4 py-2 text-gray-600 text-sm font-medium">End Date</th>
          <th className="px-4 py-2 text-gray-600 text-sm font-medium">Days</th>
          <th className="px-4 py-2 text-gray-600 text-sm font-medium">Reason</th>
          <th className="px-4 py-2 text-gray-600 text-sm font-medium">Status</th>
          <th className="px-4 py-2 text-gray-600 text-sm font-medium">Applied Date</th>
          <th className="px-7 py-2 text-gray-600 text-sm font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {leaveRequests.map((leave) => (
          <tr
            key={leave._id}
            className="bg-white hover:bg-gray-50 transition rounded-lg shadow-sm mb-2"
          >
            <td className="px-4 py-3">
              <div className="flex flex-col">
                <span className="font-medium text-gray-700">{leave.userName}</span>
                <span className="text-gray-400 text-sm">{leave.userEmail}</span>
              </div>
            </td>
            <td className="px-4 py-3">{leave.leaveType}</td>
            <td className="px-4 py-3">{formatDate(leave.startDate)}</td>
            <td className="px-4 py-3">{formatDate(leave.endDate)}</td>
            <td className="px-4 py-3">{leave.totalDays}</td>
            <td className="px-4 py-3 text-gray-500">{leave.reason || 'No reason provided'}</td>
            <td className="px-4 py-3">
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  leave.status === 'Pending'
                    ? 'bg-yellow-200 text-yellow-800'
                    : leave.status === 'Approved'
                    ? 'bg-green-200 text-green-800'
                    : 'bg-red-200 text-red-800'
                }`}
              >
                {leave.status}
              </span>
            </td>
            <td className="px-4 py-3 text-gray-400 text-sm">{formatDate(leave.appliedAt)}</td>
            <td className="px-4 py-3 flex space-x-4">
              {leave.status === 'Pending' ? (
                <>
                  <button
                    onClick={() => handleLeaveStatusUpdate(leave._id, "Approved")}
                    // className="flex items-center justify-center w-8 h-8 bg-green-500 text-white hover:bg-green-600 transition rounded-full"
                    className=" flex items-center justify-center text-green-600 hover:scale-110 transition hover:bg-green-200 rounded-full w-8 h-8 cursor-pointer"
                    title="Approve"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => handleLeaveStatusUpdate(leave._id, "Rejected")}
                    className=" flex items-center justify-center text-red-600 hover:scale-110 transition hover:bg-red-200 rounded-full w-8 h-8 cursor-pointer"
                    title="Reject"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </>
              ) : (


              <span className="flex items-center gap-1 text-gray-500 font-medium">
                {leave.status === "Approved" ? (
                  <>
                    <Check size={16} className="text-green-500" /> Approved
                  </>
                ) : (
                  <>
                    <X size={16} className="text-red-500" /> Rejected
                  </>
                )}
              </span>

              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    );
  };

  // ----------------- Render -----------------
  return (
    <div className="leave-tab space-y-6">
      {/* Leave Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <LeaveStatsCard stats={{
          pending: leaveStats.pendingRequests,
          approved: leaveStats.approvedThisMonth,
          rejected: leaveStats.rejectedThisMonth,
          total: leaveStats.totalRequests
        }} />
      </div>

      {/* Leave Filters */}
      <LeaveFiltersComponent filters={leaveFilters} setFilters={setLeaveFilters} />

      {/* Pagination */}
      <div className="pagination flex justify-end items-center space-x-2">
        {Array.from({ length: leavePagination.totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() => handleLeavePageChange(i + 1)}
            className={`px-3 py-1 rounded ${
              leavePagination.currentPage === i + 1 ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {/* Leave Table */}
      <LeaveTableComponent
        leaveRequests={leaveRequests}
        leaveLoading={leaveLoading}
        handleLeaveStatusUpdate={handleLeaveStatusUpdate}
      />

    </div>
  );
};

export default LeaveTab;
