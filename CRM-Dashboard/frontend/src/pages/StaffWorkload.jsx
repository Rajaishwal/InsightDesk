

import { useState, useEffect, useRef } from "react";
import axios from "../services/axios";
import { Users, Briefcase, BarChart2, PieChart, CheckCircle, AlertCircle, UserCheck } from "lucide-react";
import { Bar, Line } from 'react-chartjs-2';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const StaffWorkload = () => {
  // State for dashboard data
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [attendanceRate, setAttendanceRate] = useState(0);
  const [projectProgress, setProjectProgress] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [topPerformer, setTopPerformer] = useState("");
  const [presentToday, setPresentToday] = useState(0);
  const [employeesList, setEmployeesList] = useState([]);
  // For employee attendance count per employee
  const [attendanceGraph, setAttendanceGraph] = useState([]);
  const [projectGraph, setProjectGraph] = useState(null);
  const [projectStatusSummary, setProjectStatusSummary] = useState({});
  const [projectStatusDetails, setProjectStatusDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef(null);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/users/search?query=${encodeURIComponent(searchTerm)}`);
        setSuggestions(res.data || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const highlightMatch = (text, query) => {
    if (!text || !query) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-bold text-indigo-600">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch employees for search (always global)
        const empRes = await axios.get("http://localhost:5000/api/employees/list");
        setEmployeesList(empRes.data);

        // If an employee is selected, fetch their dashboard data
        if (selectedEmployee) {
          const summaryRes = await axios.get(`http://localhost:5000/api/dashboard/summary/${selectedEmployee.employeeId}`);
          setTotalEmployees(1);
          setTotalProjects(summaryRes.data.totalProjects);
          setAttendanceRate(summaryRes.data.attendanceRate);
          setProjectProgress(summaryRes.data.projectProgress);
          setPendingTasks(summaryRes.data.pendingTasks);
          setTopPerformer(summaryRes.data.topPerformer);

          // Fetch attendance graph for this employee
          const attGraphRes = await axios.get(`http://localhost:5000/api/dashboard/attendance-count-graph/${selectedEmployee.employeeId}`);
          setAttendanceGraph(attGraphRes.data);

          // Fetch project graph for this employee
          const projGraphRes = await axios.get(`http://localhost:5000/api/dashboard/project-graph/${selectedEmployee.employeeId}`);
          setProjectGraph(projGraphRes.data);

          // Fetch project status summary for pie chart
          const statusRes = await axios.get(`http://localhost:5000/api/dashboard/project-status-summary/${selectedEmployee.employeeId}`);
          setProjectStatusSummary(statusRes.data);
          // Fetch project status details for pie chart hover
          const detailsRes = await axios.get(`http://localhost:5000/api/dashboard/project-status-details/${selectedEmployee.employeeId}`);
          setProjectStatusDetails(detailsRes.data);
        } else {
          // Fetch global dashboard data
          const summaryRes = await axios.get("http://localhost:5000/api/dashboard/summary");
          setTotalEmployees(summaryRes.data.totalEmployees);
          setPresentToday(summaryRes.data.presentToday || 0);
          setTotalProjects(summaryRes.data.totalProjects);
          setAttendanceRate(summaryRes.data.attendanceRate);
          setProjectProgress(summaryRes.data.projectProgress);
          setPendingTasks(summaryRes.data.pendingTasks);
          setTopPerformer(summaryRes.data.topPerformer);

          // Fetch employee attendance count graph data
          const attGraphRes = await axios.get("http://localhost:5000/api/dashboard/attendance-count-graph");
          setAttendanceGraph(attGraphRes.data);

          // Fetch project progress graph data
          const projGraphRes = await axios.get("http://localhost:5000/api/dashboard/project-graph");
          setProjectGraph(projGraphRes.data);

          // Fetch project status summary for pie chart
          const statusRes = await axios.get("http://localhost:5000/api/dashboard/project-status-summary");
          setProjectStatusSummary(statusRes.data);
          // Fetch project status details for pie chart hover
          const detailsRes = await axios.get("http://localhost:5000/api/dashboard/project-status-details");
          setProjectStatusDetails(detailsRes.data);
        }
      } catch (err) {
        setError("Failed to fetch dashboard data.");
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedEmployee]);

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <BarChart2 className="w-8 h-8 text-blue-600" /> Staff Workload Dashboard
      </h2>

      {loading ? (
        <div className="text-center py-20 text-lg text-gray-500">Loading dashboard...</div>
      ) : error ? (
        <div className="text-center py-20 text-red-500">{error}</div>
      ) : (
        <>
          {/* Employee Search Bar */}
          <div className="mb-8" ref={searchWrapperRef}>
            <div className="relative w-full md:w-96">
              <div className="flex items-center bg-white border border-gray-300 rounded shadow-sm px-3">
                <svg className="text-gray-400 w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
                <input
                  type="text"
                  placeholder="Search employee by name or ID..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="w-full py-2 outline-none text-gray-700 bg-transparent"
                />
                {searchTerm && (
                  <button type="button" onClick={() => { setSearchTerm(''); setSuggestions([]); setShowSuggestions(false); setSelectedEmployee(null); }} className="text-gray-400 hover:text-red-500">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {suggestions.map((emp) => (
                    <div
                      key={emp._id}
                      onMouseDown={() => { setSelectedEmployee({ employeeId: emp.employeeId, name: emp.name }); setSearchTerm(''); setShowSuggestions(false); }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                        {emp.photo
                          ? <img src={emp.photo} alt={emp.name} className="w-full h-full rounded-full object-cover" />
                          : emp.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{highlightMatch(emp.name, searchTerm)}</p>
                        <p className="text-xs text-gray-500 truncate">{emp.email} · {highlightMatch(emp.employeeId, searchTerm)}</p>
                      </div>
                      <span className="text-xs text-indigo-500 font-medium shrink-0">{emp.designation || emp.role}</span>
                    </div>
                  ))}
                </div>
              )}
              {showSuggestions && searchTerm && suggestions.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500">
                  No employees found
                </div>
              )}
            </div>
            {selectedEmployee && (
              <div className="mt-3 inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-4 py-1.5">
                <span className="text-sm font-medium text-indigo-700">{selectedEmployee.name}</span>
                <span className="text-xs text-indigo-400">{selectedEmployee.employeeId}</span>
                <button onClick={() => setSelectedEmployee(null)} className="text-indigo-300 hover:text-red-500 ml-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            )}
          </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-10">
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
              <Users className="w-8 h-8 text-indigo-600 mb-2" />
              <div className="text-2xl font-bold">{selectedEmployee ? 1 : totalEmployees}</div>
              <div className="text-gray-500">Registered Employees</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
              <UserCheck className="w-8 h-8 text-emerald-600 mb-2" />
              <div className="text-2xl font-bold text-emerald-600">{selectedEmployee ? "-" : presentToday}</div>
              <div className="text-gray-500">Present Today</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
              <Briefcase className="w-8 h-8 text-green-600 mb-2" />
              <div className="text-2xl font-bold">{totalProjects}</div>
              <div className="text-gray-500">Projects Allocated</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
              <CheckCircle className="w-8 h-8 text-blue-600 mb-2" />
              <div className="text-2xl font-bold">{attendanceRate}%</div>
              <div className="text-gray-500">Attendance Rate</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
              <PieChart className="w-8 h-8 text-yellow-600 mb-2" />
              <div className="text-2xl font-bold">{projectProgress}%</div>
              <div className="text-gray-500">Project Progress</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Employee Attendance Count Bar Chart */}
            <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center justify-center" style={{ minHeight: '320px' }}>
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart2 className="w-6 h-10 text-blue-600" /> Employee Attendance
              </h3>
              <div className="w-full flex items-center justify-center" style={{ height: '240px' }}>
                {selectedEmployee ? (
                  attendanceGraph && attendanceGraph.length > 0 ? (
                    <Bar
                      data={{
                        labels: [attendanceGraph[0]?.name || selectedEmployee.name],
                        datasets: [
                          {
                            label: 'Attendance Count',
                            data: [attendanceGraph[0]?.count > 0 ? attendanceGraph[0].count : 0.1], // Show small bar for zero
                            backgroundColor: 'rgba(37, 99, 235, 0.7)',
                            minBarLength: 150, // Increase only bar length
                            barPercentage: 0.5, // Decrease only bar width
                            categoryPercentage: 0.2,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          title: { display: false },
                          tooltip: {
                            enabled: true,
                            callbacks: {
                              label: function (context) {
                                return `Attendance: ${attendanceGraph[0]?.count ?? 0}`;
                              }
                            }
                          },
                          datalabels: {
                            display: true,
                            color: '#222',
                            anchor: 'end',
                            align: 'top',
                            formatter: function () {
                              return attendanceGraph[0]?.count ?? 0;
                            }
                          }
                        },
                        scales: {
                          x: { grid: { display: false } },
                          y: {
                            beginAtZero: true,
                            grid: { display: false },
                            max: 1,
                          },
                        },
                      }}
                      height={220}
                    />
                  ) : (
                    <span className="text-gray-400">No graph data available.</span>
                  )
                ) : (
                  attendanceGraph && attendanceGraph.length > 0 ? (
                    <Bar
                      data={{
                        labels: attendanceGraph.map(d => d.name),
                        datasets: [
                          {
                            label: 'Attendance Count',
                            data: attendanceGraph.map(d => d.count),
                            backgroundColor: 'rgba(37, 99, 235, 0.7)',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { display: false },
                          title: { display: false },
                        },
                        scales: {
                          x: { grid: { display: false } },
                          y: { beginAtZero: true, grid: { display: false } },
                        },
                      }}
                    />
                  ) : (
                    <span className="text-gray-400">No graph data available.</span>
                  )
                )}
              </div>
            </div>
            {/* Project Assessment Pie Chart by Status */}
            <div className="bg-white rounded-lg shadow p-6 mt-8">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <PieChart className="w-6 h-6 text-yellow-600" /> Project Records
              </h3>
              <div className="h-64 flex items-center justify-center">
                {projectStatusSummary && (projectStatusSummary['Ongoing'] > 0 || projectStatusSummary['Completed'] > 0) ? (
                  <Pie
                    data={{
                      labels: ['Ongoing', 'Completed'],
                      datasets: [
                        {
                          data: [projectStatusSummary['Ongoing'] || 0, projectStatusSummary['Completed'] || 0],
                          backgroundColor: [
                            'rgba(37, 99, 235, 0.7)',
                            'rgba(34, 197, 94, 0.7)'
                          ],
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: { display: true },
                        title: { display: false },
                        tooltip: {
                          callbacks: {
                            label: function (context) {
                              return `${context.label}: ${context.parsed}`;
                            }
                          }
                        }
                      },
                    }}
                  />
                ) : (
                  <span className="text-gray-400">No project status data available.</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
            {/* Ongoing Projects Count */}
            <div className="bg-white rounded-lg shadow p-6 flex items-center gap-4">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
              <div>
                <div className="text-xl font-bold">{projectStatusSummary['Ongoing'] || 0}</div>
                <div className="text-gray-500">Ongoing Projects</div>
              </div>
            </div>
            {/* Top Performer */}
            <div className="bg-white rounded-lg shadow p-6 flex items-center gap-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-xl font-bold">{topPerformer}</div>
                <div className="text-gray-500">Top Performer</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StaffWorkload;
