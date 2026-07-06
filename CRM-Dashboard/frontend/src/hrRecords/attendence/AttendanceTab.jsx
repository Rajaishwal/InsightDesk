import { useState, useEffect } from "react";
import api from "../../services/axios";
import AttendanceFilters from "./AttendanceFilters";
import AttendanceTable from "./AttendanceTable";

const AttendanceTab = () => {
  const [attendanceData, setAttendanceData] = useState([]);
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

  useEffect(() => {
    fetchAttendanceData();
  }, [filters]);

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
        />
      </div>
    </div>
  );
};

export default AttendanceTab;