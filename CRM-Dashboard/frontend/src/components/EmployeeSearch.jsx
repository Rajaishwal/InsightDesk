import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  User,
  Mail,
  MapPin,
  Clock,
  Briefcase,
  X,
} from "lucide-react";
import axios from "../services/axios";

const EmployeeSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Live suggestions as user types
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/api/users/search?query=${encodeURIComponent(searchQuery)}`
        );
        setSuggestions(res.data || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setShowSuggestions(false);
    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:5000/api/users/search?query=${encodeURIComponent(searchQuery)}`
      );
      setSearchResults(response.data);
    } catch (error) {
      console.error("Search error:", error);
      alert("Error searching employees");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (emp) => {
    setSearchQuery(emp.name);
    setShowSuggestions(false);
    setSearchResults([emp]);
  };

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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800">Employee Search</h2>
        <p className="text-gray-500">Find and view employee details</p>
      </div>

      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className="flex items-center gap-3 mb-8 max-w-xl mx-auto"
        ref={wrapperRef}
      >
        <div className="relative flex-1">
          <div className="flex items-center bg-white border border-gray-300 rounded-lg shadow-sm px-3">
            <Search className="text-gray-400 w-5 h-5 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search by Name, Email or Employee ID..."
              className="w-full py-2 outline-none text-gray-700"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(""); setSuggestions([]); setSearchResults([]); }}>
                <X size={16} className="text-gray-400 hover:text-red-500" />
              </button>
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((emp) => (
                <div
                  key={emp._id}
                  onMouseDown={() => handleSuggestionClick(emp)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-semibold shrink-0">
                    {emp.photo
                      ? <img src={emp.photo} alt={emp.name} className="w-full h-full rounded-full object-cover" />
                      : emp.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{highlightMatch(emp.name, searchQuery)}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {highlightMatch(emp.email, searchQuery)}
                      {emp.employeeId && <span className="ml-2 text-gray-400">· {highlightMatch(emp.employeeId, searchQuery)}</span>}
                    </p>
                  </div>
                  <span className="text-xs text-indigo-500 font-medium shrink-0">{emp.designation || emp.role}</span>
                </div>
              ))}
            </div>
          )}

          {showSuggestions && searchQuery && suggestions.length === 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500">
              No suggestions found
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-gray-800 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg shadow-md transition flex items-center gap-2 shrink-0"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
          ) : (
            <Search size={18} />
          )}
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Results */}
      {searchResults.length > 0 && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              Search Results
            </h3>
            <span className="text-sm text-gray-500">
              {searchResults.length} employees found
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((employee) => (
              <div
                key={employee._id}
                className="bg-white shadow-lg rounded-xl p-5 hover:shadow-xl transition"
              >
                {/* Avatar + Basic Info */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-indigo-500 text-white flex items-center justify-center text-lg font-semibold">
                    {employee.photo ? (
                      <img
                        src={employee.photo}
                        alt={employee.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      employee.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">
                      {employee.name}
                    </h4>
                    <p className="text-sm text-gray-500">
                      ID: {employee.employeeId || "Not set"}
                    </p>
                  </div>
                </div>

                {/* Quick Details */}
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Mail size={16} className="text-gray-400" />
                    {employee.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase size={16} className="text-gray-400" />
                    {employee.designation || "Not set"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" />
                    {employee.domain || "Not set"}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedEmployee(employee)}
                  className="mt-4 w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2 rounded-lg transition"
                >
                  View Full Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {searchResults.length === 0 && searchQuery && !loading && (
        <div className="mt-10 text-center text-gray-500">
          <div className="text-4xl mb-2">🔍</div>
          <h3 className="text-lg font-semibold">No employees found</h3>
          <p>Try searching with a different Employee ID or Name</p>
        </div>
      )}

      {/* Employee Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full relative overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-900 to-gray-900 ">
              <h3 className="text-xl font-semibold text-white">Employee Profile</h3>
              <button
                onClick={() => setSelectedEmployee(null)}
                className="text-white/80 hover:text-white"
              >
                <X size={22} />
              </button>
            </div>

            {/* Body */}
            <div className="p-8 space-y-8">
              {/* Profile Header */}
              <div className="text-center">
                <div className="w-24 h-24 mx-auto rounded-full bg-indigo-500 text-white flex items-center justify-center text-3xl font-bold mb-3 shadow-md">
                  {selectedEmployee.photo ? (
                    <img
                      src={selectedEmployee.photo}
                      alt={selectedEmployee.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    selectedEmployee.name.charAt(0).toUpperCase()
                  )}
                </div>
                <h4 className="text-2xl font-bold text-gray-800">{selectedEmployee.name}</h4>
                <p className="text-gray-500 text-sm">
                  Employee ID: {selectedEmployee.employeeId || "Not set"}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-8">
                {/* Basic Info */}
                <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
                  <h5 className="font-semibold text-gray-700 flex items-center gap-2 mb-4 text-base">
                    <User size={18} className="text-indigo-600" /> Basic Information
                  </h5>
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="font-medium">{selectedEmployee.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Gender</p>
                      <p className="font-medium">
                        {selectedEmployee.gender || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Role</p>
                      <p className="font-medium">{selectedEmployee.role}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Profile Status</p>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          selectedEmployee.profileCompleted
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {selectedEmployee.profileCompleted ? "Complete" : "Incomplete"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Work Info */}
                <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
                  <h5 className="font-semibold text-gray-700 flex items-center gap-2 mb-4 text-base">
                    <Briefcase size={18} className="text-indigo-600" /> Work Information
                  </h5>
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <p className="text-gray-500">Designation</p>
                      <p className="font-medium">{selectedEmployee.designation || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Domain</p>
                      <p className="font-medium">{selectedEmployee.domain || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Shift Timing</p>
                      <p className="font-medium">{selectedEmployee.shiftTiming || "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Member Since</p>
                      <p className="font-medium">
                        {new Date(selectedEmployee.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Address */}
                {selectedEmployee.address && (
                  <div className="bg-gray-50 p-5 rounded-xl shadow-sm">
                    <h5 className="font-semibold text-gray-700 flex items-center gap-2 mb-4 text-base">
                      <MapPin size={18} className="text-indigo-600" /> Address Information
                    </h5>
                    <p className="text-sm font-medium text-gray-700">
                      {[
                        selectedEmployee.address.street,
                        selectedEmployee.address.city,
                        selectedEmployee.address.state,
                        selectedEmployee.address.zipCode,
                        selectedEmployee.address.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "No address provided"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default EmployeeSearch;
