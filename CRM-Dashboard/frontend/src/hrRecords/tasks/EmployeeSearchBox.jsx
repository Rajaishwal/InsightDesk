import React, { useState, useEffect, useRef } from "react";
import api from "../../services/axios";
import { User, CheckCircle, Search as SearchIcon, Frown } from "lucide-react";

const EmployeeSearchBox = ({ onSelectEmployee }) => {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      if (!search.trim()) return setEmployees([]);
      setLoading(true);
      try {
        const res = await api.get(`http://localhost:5000/api/users/search?query=${encodeURIComponent(search)}`);
        setEmployees(res.data || []);
      } catch (err) {
        console.error("Error searching employees:", err);
        const status = err.response?.status;
        if (status === 401) {
          alert("Session expired. Please log in again.");
        } else if (status >= 500) {
          alert("Server error while searching. Check if the backend is running.");
        }
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };
    const debounce = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(debounce);
  }, [search]);

  const handleEmployeeSelect = (emp, empId) => {
    setSelectedEmployee(empId);
    onSelectEmployee(emp); // pass full employee object so caller has both _id and employeeId
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          placeholder="Search employee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <SearchIcon className="absolute left-3 top-2.5 text-gray-400" size={18} />
      </div>

      {search && loading && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-2 text-gray-500 text-sm flex items-center space-x-2">
          <span>Searching...</span>
        </div>
      )}

      {search && !loading && employees.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          <h4 className="px-4 pt-3 text-sm font-semibold text-gray-700">
            Select Employee:
          </h4>
          <div className="divide-y divide-gray-200">
            {employees.map((emp, index) => {
              const empId =
                typeof emp._id === "object"
                  ? emp._id._id || emp._id.toString()
                  : String(emp._id);

              return (
                <div
                  key={`${empId}-${index}`}
                  className={`flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-blue-50 transition ${
                    selectedEmployee === empId ? "bg-blue-100" : ""
                  }`}
                  onClick={() => handleEmployeeSelect(emp, empId)}
                >
                  <div className="flex items-center space-x-3">
                    <User className="text-gray-400" size={20} />
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-800">{emp.name}</span>
                      <span className="text-sm text-gray-500">{emp.email}</span>
                    </div>
                  </div>
                  {selectedEmployee === empId ? (
                    <CheckCircle className="text-green-500" size={20} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {search && !loading && employees.length === 0 && (
        <div className="mt-2 text-sm text-gray-500 flex items-center space-x-2">
          <Frown className="text-gray-400" size={18} />
          <span>No employees found matching "{search}"</span>
        </div>
      )}
    </div>
  );
};

export default EmployeeSearchBox;
