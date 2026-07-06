import React, { useState, useEffect } from "react";
import LeaveCard from "../components/LeaveCard";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";

const LeaveManagement = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [_, setLastUpdated] = useState(new Date());
  const [__, setIsRefreshing] = useState(false);
  const [leaveStats, setLeaveStats] = useState({
    taken: 0,
    pending: 0,
    remaining: 0,
    monthlyAllocation: null
  });

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [newLeave, setNewLeave] = useState({ 
    startDate: "", 
    endDate: "", 
    leaveType: "Sick Leave", 
    reason: "" 
  });

  const leaveTypes = [
    'Sick Leave',
    'Casual Leave', 
    'Annual Leave', 
    'Maternity Leave',
    'Paternity Leave',
    'Emergency Leave',
    'Other'
  ];

  // Helper function to check if a date is weekend (Saturday or Sunday)
  const isWeekend = (dateString) => {
    const date = new Date(dateString);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
  };

  // Helper function to calculate working days (excluding weekends)
  const calculateWorkingDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    
    // Iterate through each day between start and end (inclusive)
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Saturday (6) and Sunday (0)
        workingDays++;
      }
    }
    
    return workingDays;
  };

  // Helper function to get next working day (skip weekends)
  const getNextWorkingDay = (dateString) => {
    const date = new Date(dateString);
    while (true) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Saturday or Sunday
        break;
      }
      date.setDate(date.getDate() + 1);
    }
    return date.toISOString().split('T')[0];
  };

  // Helper function to get the minimum allowed date (next working day)
  const getMinAllowedDate = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return getNextWorkingDay(tomorrow.toISOString().split('T')[0]);
  };

  // Handle date change with weekend validation (no alerts)
  const handleDateChange = (field, value) => {
    if (!value) {
      setNewLeave(prev => ({ ...prev, [field]: '' }));
      return;
    }

    if (isWeekend(value)) {
      const nextWorkingDay = getNextWorkingDay(value);
      setNewLeave(prev => ({ ...prev, [field]: nextWorkingDay }));
    } else {
      setNewLeave(prev => ({ ...prev, [field]: value }));
    }
  };

  // Fetch user's leaves
  const fetchUserLeaves = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const response = await api.get('http://localhost:5000/api/leaves/my-leaves');
      setLeaves(response.data.leaves);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  // Fetch leave statistics
  const fetchLeaveStats = async () => {
    try {
      setStatsLoading(true);
      const response = await api.get('http://localhost:5000/api/leaves/stats');
      const monthlyAllocation = response.data.monthlyAllocation;
      const remaining = monthlyAllocation ? monthlyAllocation.remainingLeaves : 0;
      
      setLeaveStats({
        taken: response.data.totalDaysTaken || 0,
        pending: response.data.totalDaysPending || 0,
        remaining: Math.max(0, remaining), // Ensure it never goes below 0
        monthlyAllocation: monthlyAllocation
      });
      
    } catch (error) {
      console.error('Error fetching leave stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Apply for leave
  const handleAddLeave = async () => {
    try {
      if (!newLeave.startDate || !newLeave.endDate || !newLeave.leaveType) {
        alert('Please fill in all required fields');
        return;
      }

      // Double check for weekends (additional validation - silent)
      if (isWeekend(newLeave.startDate)) {
        setNewLeave(prev => ({ ...prev, startDate: getNextWorkingDay(newLeave.startDate) }));
        return;
      }

      if (isWeekend(newLeave.endDate)) {
        setNewLeave(prev => ({ ...prev, endDate: getNextWorkingDay(newLeave.endDate) }));
        return;
      }

      const response = await api.post('http://localhost:5000/api/leaves/apply', {
        startDate: newLeave.startDate,
        endDate: newLeave.endDate,
        leaveType: newLeave.leaveType,
        reason: newLeave.reason
      });

      if (response.status === 201) {
        alert('Leave application submitted successfully!');
        setShowLeaveModal(false);
        setNewLeave({ startDate: "", endDate: "", leaveType: "Sick Leave", reason: "" });
        
        // Refresh data
        await fetchUserLeaves();
        await fetchLeaveStats();
      }
    } catch (error) {
      console.error('Error applying for leave:', error);
      alert(error.response?.data?.message || 'Error submitting leave application');
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserLeaves();
      fetchLeaveStats();
      
      // Set up polling to check for real-time updates every 30 seconds
      const pollInterval = setInterval(() => {
        fetchUserLeaves(false); // Don't show loading on auto-refresh
        fetchLeaveStats();
      }, 30000);

      return () => clearInterval(pollInterval);
    }
  }, [user]);

  // Add effect to handle weekend date styling in calendar
  useEffect(() => {
    const styleWeekendDates = () => {
      // Add event listeners to date inputs for calendar styling
      const dateInputs = document.querySelectorAll('input[type="date"].weekend-disabled');
      
      dateInputs.forEach(input => {
        // Create weekend hint element
        const container = input.parentElement;
        let hintElement = container.querySelector('.weekend-hint');
        if (!hintElement) {
          hintElement = document.createElement('div');
          hintElement.className = 'weekend-hint hide';
          hintElement.textContent = 'Weekends auto-adjust to next working day';
          container.appendChild(hintElement);
        }

        // Override the default date picker behavior
        input.addEventListener('input', (e) => {
          const selectedDate = e.target.value;
          if (selectedDate && isWeekend(selectedDate)) {
            // Add visual indication that weekend was selected
            e.target.classList.add('weekend-selected');
            hintElement.classList.remove('hide');
            hintElement.classList.add('show');
            
            // Auto-adjust to next working day after a short delay
            setTimeout(() => {
              const nextWorkingDay = getNextWorkingDay(selectedDate);
              if (e.target.value !== nextWorkingDay) {
                e.target.value = nextWorkingDay;
                // Trigger change event for React state update
                const changeEvent = new Event('change', { bubbles: true });
                e.target.dispatchEvent(changeEvent);
              }
              
              // Remove weekend styling after adjustment
              setTimeout(() => {
                e.target.classList.remove('weekend-selected');
                hintElement.classList.remove('show');
                hintElement.classList.add('hide');
              }, 1500);
            }, 500);
            
          } else {
            // Reset to normal styling
            e.target.classList.remove('weekend-selected');
            hintElement.classList.remove('show');
            hintElement.classList.add('hide');
          }
        });

        // Add styling on focus to show weekend restriction
        input.addEventListener('focus', (e) => {
          e.target.setAttribute('title', 'Weekend dates (Saturday & Sunday) will be automatically adjusted to the next working day');
          const container = e.target.parentElement;
          const hintElement = container.querySelector('.weekend-hint');
          if (hintElement) {
            hintElement.classList.remove('hide');
            hintElement.classList.add('show');
          }
        });

        // Hide hint on blur
        input.addEventListener('blur', (e) => {
          const container = e.target.parentElement;
          const hintElement = container.querySelector('.weekend-hint');
          if (hintElement && !e.target.classList.contains('weekend-selected')) {
            setTimeout(() => {
              hintElement.classList.remove('show');
              hintElement.classList.add('hide');
            }, 500);
          }
        });
      });
    };

    // Apply styling when modal is shown
    if (showLeaveModal) {
      setTimeout(styleWeekendDates, 100); // Small delay to ensure DOM is updated
    }

    // Cleanup function
    return () => {
      const dateInputs = document.querySelectorAll('input[type="date"].weekend-disabled');
      dateInputs.forEach(input => {
        // Remove event listeners to prevent memory leaks
        input.removeEventListener('input', () => {});
        input.removeEventListener('focus', () => {});
        input.removeEventListener('blur', () => {});
      });
    };
  }, [showLeaveModal]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'approved';
      case 'pending': return 'pending';
      case 'rejected': return 'rejected';
      default: return '';
    }
  };

  return (
  <div className="page-container p-6 font-sans">
    {/* Title */}
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <h1 className="text-gray-500 text-1xl font-bold mb-4 uppercase pl-5">
        Leave Management
      </h1>
    </div>

    {/* Leave Stats */}
    {statsLoading ? (
      <div className="flex justify-center items-center py-8">
        <div className="animate-pulse text-gray-500 text-lg">
          Loading leave statistics...
        </div>
      </div>
    ) : (
      <LeaveCard
        taken={leaveStats.taken}
        pending={leaveStats.pending}
        left={leaveStats.remaining}
        monthlyAllocation={leaveStats.monthlyAllocation}
      />
    )}

    {/* Leave Requests Section */}
    <div className="bg-white rounded-2xl shadow-lg mt-8 ml-6 mr-6 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-3">
        <h3 className="text-xl font-semibold text-gray-800">
          My Leave Requests
        </h3>
        <button
          onClick={() => setShowLeaveModal(true)}
          disabled={statsLoading || leaveStats.remaining <= 0}
          className={`px-5 py-2 rounded-lg text-white font-medium shadow transition-all ${
            statsLoading || leaveStats.remaining <= 0
              ? "bg-gray-400 cursor-not-allowed opacity-70"
              : "bg-emerald-500 hover:bg-emerald-600"
          }`}
          title={
            statsLoading
              ? "Loading..."
              : leaveStats.remaining <= 0
              ? "No leaves available this month"
              : ""
          }
        >
          + Request Leave
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500 text-lg">
          Loading...
        </div>
      ) : (
        <div className="overflow-x-auto bg-gray-200 border border-gray-200 pb-2">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-300">
              <tr>
                {[
                  "Start Date",
                  "End Date",
                  "Leave Type",
                  "Working Days",
                  "Reason",
                  "Status",
                  "Applied Date",
                ].map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left font-semibold text-gray-700"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {leaves.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="text-center py-8 text-gray-500 text-base"
                  >
                    No leave requests found
                  </td>
                </tr>
              ) : (
                leaves.map((leave, idx) => (
                  <tr
                    key={leave._id || idx}
                    className=" shadow-md hover:bg-blue-50 transition rounded-lg"
                  >
                    <td className="px-4 py-3">{formatDate(leave.startDate)}</td>
                    <td className="px-4 py-3">{formatDate(leave.endDate)}</td>
                    <td className="px-4 py-3">{leave.leaveType}</td>
                    <td className="px-4 py-3">{leave.totalDays}</td>
                    <td className="px-4 py-3">{leave.reason || "N/A"}</td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        leave.status === "Approved"
                          ? "text-green-600"
                          : leave.status === "Pending"
                          ? "text-yellow-600"
                          : "text-red-600"
                      }`}
                    >
                      {leave.status}
                    </td>
                    <td className="px-4 py-3">{formatDate(leave.appliedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* Modal */}
    {showLeaveModal && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-fadeIn">
          <h3 className="text-xl font-semibold text-center text-gray-800 mb-4">
            Request Leave
          </h3>
          <hr className="border-gray-200 mb-4" />

          {/* Start Date */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date:
          </label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={newLeave.startDate}
            onChange={(e) => handleDateChange("startDate", e.target.value)}
            min={getMinAllowedDate()}
          />

          {/* End Date */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date:
          </label>
          <input
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={newLeave.endDate}
            onChange={(e) => handleDateChange("endDate", e.target.value)}
            min={newLeave.startDate || getMinAllowedDate()}
          />

          {/* Working Days Info */}
          {newLeave.startDate && newLeave.endDate && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-md p-3 mb-4">
              Working days:{" "}
              <span className="font-semibold">
                {calculateWorkingDays(newLeave.startDate, newLeave.endDate)}
              </span>{" "}
              {calculateWorkingDays(newLeave.startDate, newLeave.endDate) === 1
                ? "day"
                : "days"}{" "}
              <span className="text-gray-500 font-normal">(weekends excluded)</span>
            </div>
          )}

          {/* Leave Type */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Leave Type:
          </label>
          <select
            value={newLeave.leaveType}
            onChange={(e) =>
              setNewLeave({ ...newLeave, leaveType: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {leaveTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {/* Reason */}
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason (Optional):
          </label>
          <textarea
            value={newLeave.reason}
            onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Reason for leave..."
            rows="3"
          />

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleAddLeave}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-lg shadow transition"
            >
              Submit
            </button>
            <button
              onClick={() => setShowLeaveModal(false)}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg shadow transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
export default LeaveManagement;
