// StaffWorkload.jsx — Admin view of all employees task and workload distribution
import { useState, useEffect, useRef } from "react";
import axios from "../services/axios";
import { getCache, setCache } from "../utils/pageCache";
import { Users, Briefcase, BarChart2, PieChart, CheckCircle, AlertCircle, UserCheck } from "lucide-react";
import { Bar } from 'react-chartjs-2';
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

/* ── Skeleton shimmer shown only on true first visit ── */
const Shimmer = ({ className = "", style }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} style={style} />
);

const WorkloadSkeleton = () => (
  <div className="p-8 min-h-screen bg-gray-50">
    <Shimmer className="h-9 w-72 mb-8" />
    <Shimmer className="h-10 w-96 mb-8" />
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-10">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-6 flex flex-col items-center gap-3">
          <Shimmer className="h-8 w-8 rounded-full" />
          <Shimmer className="h-7 w-14" />
          <Shimmer className="h-4 w-24" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white rounded-lg shadow p-6">
        <Shimmer className="h-6 w-48 mb-4" />
        <Shimmer className="h-56 w-full" />
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <Shimmer className="h-6 w-48 mb-4" />
        <Shimmer className="h-56 w-full" style={{ borderRadius: "50%", maxWidth: 220, margin: "0 auto" }} />
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
      {[0, 1].map(i => (
        <div key={i} className="bg-white rounded-lg shadow p-6 flex items-center gap-4">
          <Shimmer className="h-8 w-8 rounded-full" />
          <div className="space-y-2 flex-1">
            <Shimmer className="h-6 w-12" />
            <Shimmer className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const StaffWorkload = () => {
  // Initialise all state from cache — zero loading flash on revisit
  const _c = getCache("workload-global") || {};

  const [totalEmployees, setTotalEmployees]           = useState(_c.totalEmployees       ?? 0);
  const [totalProjects, setTotalProjects]             = useState(_c.totalProjects         ?? 0);
  const [attendanceRate, setAttendanceRate]           = useState(_c.attendanceRate        ?? 0);
  const [projectProgress, setProjectProgress]         = useState(_c.projectProgress       ?? 0);
  const [topPerformer, setTopPerformer]               = useState(_c.topPerformer          ?? "");
  const [presentToday, setPresentToday]               = useState(_c.presentToday          ?? 0);
  const [attendanceGraph, setAttendanceGraph]         = useState(_c.attendanceGraph       ?? []);
  const [projectStatusSummary, setProjectStatusSummary] = useState(_c.projectStatusSummary ?? {});
  // Show skeleton only on true first visit (no cache) with no employee selected
  const [loading, setLoading] = useState(!getCache("workload-global"));
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
      // Show loading only when: no cache (first visit) OR an employee is selected
      if (!getCache("workload-global") || selectedEmployee) setLoading(true);
      setError("");
      try {
        if (selectedEmployee) {
          // Per-employee view — always fresh, not cached
          const [summaryRes, attGraphRes, statusRes] = await Promise.all([
            axios.get(`http://localhost:5000/api/dashboard/summary/${selectedEmployee.employeeId}`),
            axios.get(`http://localhost:5000/api/dashboard/attendance-count-graph/${selectedEmployee.employeeId}`),
            axios.get(`http://localhost:5000/api/dashboard/project-status-summary/${selectedEmployee.employeeId}`),
          ]);
          setTotalEmployees(1);
          setTotalProjects(summaryRes.data.totalProjects);
          setAttendanceRate(summaryRes.data.attendanceRate);
          setProjectProgress(summaryRes.data.projectProgress);
          setTopPerformer(summaryRes.data.topPerformer);
          setAttendanceGraph(attGraphRes.data);
          setProjectStatusSummary(statusRes.data);
        } else {
          // Global view — fetch fresh and save to cache
          const [summaryRes, attGraphRes, statusRes] = await Promise.all([
            axios.get("http://localhost:5000/api/dashboard/summary"),
            axios.get("http://localhost:5000/api/dashboard/attendance-count-graph"),
            axios.get("http://localhost:5000/api/dashboard/project-status-summary"),
          ]);

          setTotalEmployees(summaryRes.data.totalEmployees);
          setPresentToday(summaryRes.data.presentToday || 0);
          setTotalProjects(summaryRes.data.totalProjects);
          setAttendanceRate(summaryRes.data.attendanceRate);
          setProjectProgress(summaryRes.data.projectProgress);
          setTopPerformer(summaryRes.data.topPerformer);
          setAttendanceGraph(attGraphRes.data);
          setProjectStatusSummary(statusRes.data);

          // Persist global data for instant revisit
          setCache("workload-global", {
            totalEmployees:       summaryRes.data.totalEmployees,
            presentToday:         summaryRes.data.presentToday || 0,
            totalProjects:        summaryRes.data.totalProjects,
            attendanceRate:       summaryRes.data.attendanceRate,
            projectProgress:      summaryRes.data.projectProgress,
            topPerformer:         summaryRes.data.topPerformer,
            attendanceGraph:      attGraphRes.data,
            projectStatusSummary: statusRes.data,
          });
        }
      } catch {
        setError("Failed to fetch dashboard data.");
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedEmployee]);

  // Show skeleton on first visit
  if (loading) return <WorkloadSkeleton />;

  if (error) return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <BarChart2 className="w-8 h-8 text-blue-600" /> Staff Workload Dashboard
      </h2>
      <div className="text-center py-20 text-red-500">{error}</div>
    </div>
  );

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
        <BarChart2 className="w-8 h-8 text-blue-600" /> Staff Workload Dashboard
      </h2>

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
                          data: [attendanceGraph[0]?.count > 0 ? attendanceGraph[0].count : 0.1],
                          backgroundColor: 'rgba(37, 99, 235, 0.7)',
                          minBarLength: 150,
                          barPercentage: 0.5,
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
                            label: () => `Attendance: ${attendanceGraph[0]?.count ?? 0}`,
                          }
                        },
                      },
                      scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, grid: { display: false }, max: 1 },
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
                          label: (context) => `${context.label}: ${context.parsed}`,
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
    </div>
  );
};

export default StaffWorkload;