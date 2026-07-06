import React, { useState, useEffect, useRef } from "react";
import { Eye, Search, X } from "lucide-react";
import PrjModle from "../components/PrjModle";
import AddProject from "./AddProject";
import axios from "../services/axios";

const HrProject = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [showProjectAdd, setShowProjectAdd] = useState(false);
  const [hrData, setHrData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

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
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
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

  // Fetch HR project data from backend
  // Refetch logic
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get("http://localhost:5000/api/hr-projects");
      setHrData(res.data);
    } catch (err) {
      setError("Failed to load HR projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Group by projectId to avoid duplicate rows
  const uniqueProjectsMap = {};
  hrData.forEach((emp) => {
    if (!uniqueProjectsMap[emp.projectId]) {
      uniqueProjectsMap[emp.projectId] = emp;
    }
  });
  const uniqueProjects = Object.values(uniqueProjectsMap);

  // Filter projects based on search
  const filteredData = uniqueProjects.filter((emp) => {    
    return (
      (emp.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.projectId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.manager || "").toLowerCase().includes(searchTerm.toLowerCase())||
      (emp.status || "").toLowerCase().includes(searchTerm.toLowerCase())
  )})

  // Fetch full project details when viewing
  const handleView = async (emp) => {
    try {
      setLoading(true);
      const res = await axios.get(`http://localhost:5000/api/hr-projects/${emp.projectId}`);
      setSelectedEmp(res.data);
      setShowModal(true);
    } catch (err) {
      setError("Failed to load project details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 p-6 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* Header + Search + Button */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900">
            HR Employee Projects
          </h1>

          {/* Search + Button Wrapper */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <div className="relative w-full md:w-72" ref={wrapperRef}>
              <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm px-3">
                <Search className="text-gray-400 h-5 w-5 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by name, projectId, manager..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="w-full py-2 outline-none text-gray-700 bg-transparent"
                />
                {searchTerm && (
                  <button type="button" onClick={() => { setSearchTerm(""); setSuggestions([]); setShowSuggestions(false); }}>
                    <X size={15} className="text-gray-400 hover:text-red-500" />
                  </button>
                )}
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {suggestions.map((emp) => (
                    <div
                      key={emp._id}
                      onMouseDown={() => { setSearchTerm(emp.name); setShowSuggestions(false); }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                        {emp.photo
                          ? <img src={emp.photo} alt={emp.name} className="w-full h-full rounded-full object-cover" />
                          : emp.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{highlightMatch(emp.name, searchTerm)}</p>
                        <p className="text-xs text-gray-500 truncate">{emp.designation || emp.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Project Button */}
            <button onClick={() => setShowProjectAdd(true)} className="bg-gray-700 cursor-pointer text-white px-5 py-2 hover:shadow-lg transition">
              + Project
            </button>
            {showProjectAdd && (
              <AddProject
                onClose={() => setShowProjectAdd(false)}
              />
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow">
          <table className="min-w-full border-gray-200 overflow-hidden">
            <thead className="bg-gray-700 text-white">
              <tr>
                <th className="py-3 px-6 text-left text-sm font-semibold">Project ID</th>
                <th className="py-3 px-6 text-left text-sm font-semibold">Title</th>
                <th className="py-3 px-6 text-left text-sm font-semibold">Description</th>
                <th className="py-3 px-6 text-left text-sm font-semibold">Project Manager</th>
                <th className="py-3 px-6 text-left text-sm font-semibold">Status</th>
                <th className="py-3 px-6 text-left text-sm font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-gray-500 text-sm">Loading...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-red-500 text-sm">{error}</td>
                </tr>
              ) : filteredData.length > 0 ? (
                filteredData.map((emp) => (
                  <tr key={emp.empId + emp.projectId} className="hover:bg-gray-50 transition">
                    <td className="py-3 px-6 text-sm text-gray-700">{emp.projectId}</td>
                    <td className="py-3 px-6 text-sm text-gray-700 font-medium">{emp.title}</td>
                    <td className="py-3 px-6 text-sm text-gray-700">{emp.description}</td>                    
                    <td className="py-3 px-6 text-sm text-gray-700">{emp.manager || "-"}</td>
                    <td className="py-3 px-6 text-sm">
                      <select
                        value={emp.status}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          try {
                            console.log('PUT /projects/', emp.projectId, 'status:', newStatus);
                            const res = await axios.put(`http://localhost:5000/projects/${emp.projectId}`, {
                              status: newStatus,
                            });
                            console.log('Update response:', res);
                            // Refetch data after update to reflect changes
                            fetchData();
                          } catch (err) {
                            console.error('Status update error:', err);
                            alert("Failed to update status");
                          }
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          emp.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : emp.status === "Ongoing"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                        style={{ minWidth: 100 }}
                      >
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </td>
                    <td className="py-3 px-6 text-sm">
                      <button
                        onClick={() => handleView(emp)}
                        className="text-blue-600 hover:text-blue-800 cursor-pointer transition transform hover:scale-110 p-2 rounded-full"
                        title="View Employee"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-gray-500 text-sm">
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <PrjModle
            project={selectedEmp}
            onClose={() => setShowModal(false)}
            isHrView={true}
          />
        )}
      </div>
    </div>
  );
};

export default HrProject;
