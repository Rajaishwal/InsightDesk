// AttendanceTab.jsx — HR attendance records tab: fetches logs, task time map, passes to AttendanceTable
import { useState, useEffect } from "react";
import api from "../../services/axios";
import AttendanceFilters from "./AttendanceFilters";
import AttendanceTable from "./AttendanceTable";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";

const AttendanceTab = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [taskTimeMap, setTaskTimeMap] = useState({});   // { userId: seconds }
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    startDate: "",
    endDate: "",
    userId: ""
  });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    totalPages: 1,
    currentPage: 1,
    totalRecords: 0
  });

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams(filters).toString();
      const res = await api.get(`http://localhost:5000/api/attendance/logs?${params}`);
      setAttendanceData(res.data.attendance);
      setPagination(res.data);
    } catch (err) {
      console.error("Error fetching attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [filters]);

  // Silent background refresh when any attendance event fires
  useAutoRefresh(fetchAttendanceData, ["crm:attendance:updated"]);

  // Refresh task time every 30s so live timers stay current
  useEffect(() => {
    const fetchTaskTime = () =>
      api.get("/project-tasks/all-users-today-time")
        .then((r) => setTaskTimeMap(r.data.totals || {}))
        .catch(() => {});
    fetchTaskTime();
    const id = setInterval(fetchTaskTime, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Page Heading */}
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Attendance Records
      </h2>

      {/* Filters */}
      <div className="mb-6">
        <AttendanceFilters filters={filters} setFilters={setFilters} />
      </div>

      {/* Table Section */}
      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200">
        <AttendanceTable
          data={attendanceData}
          loading={loading}
          pagination={pagination}
          setFilters={setFilters}
          filters={filters}
          taskTimeMap={taskTimeMap}
        />
      </div>
    </div>
  );
};

export default AttendanceTab;