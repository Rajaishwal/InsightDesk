import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import axios from "../services/axios";

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

export const HrTaskForm = ({ onClose }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskCompletionTime, setTaskCompletionTime] = useState("");
  const [assignedTo, setAssignedTo] = useState(""); // stores employeeId
  const [displayName, setDisplayName] = useState(""); // stores what user typed / selected name
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Search suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!displayName.trim() || assignedTo) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/api/users/search?query=${encodeURIComponent(displayName)}`
        );
        setSuggestions(res.data || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [displayName, assignedTo]);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectEmployee = (emp) => {
    setAssignedTo(emp.employeeId);
    setDisplayName(`${emp.name} (${emp.employeeId})`);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const clearEmployee = () => {
    setAssignedTo("");
    setDisplayName("");
    setSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await axios.post("http://localhost:5000/api/hr-tasks/", {
        title,
        description,
        taskCompletionTime,
        assignedTo,
      });
      if (response.data.success) {
        setMessage("✅ Task assigned successfully!");
        setTitle("");
        setDescription("");
        setTaskCompletionTime("");
        setAssignedTo("");
        setDisplayName("");
      }
    } catch (error) {
      setMessage(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-5">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Assign New Task</h2>

        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded-lg text-center font-medium ${
              message.includes("successfully")
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-300"
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Assign To — live search */}
          <div ref={wrapperRef} className="relative">
            <div className={`flex items-center border-2 rounded-lg px-4 py-3 gap-2 bg-white transition ${
              showSuggestions ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-400"
            }`}>
              <input
                type="text"
                placeholder="Assign To — search by name, email or Emp ID"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setAssignedTo(""); // clear selection if user edits
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                required
                disabled={loading}
                className="flex-1 text-base outline-none placeholder-gray-400 bg-transparent disabled:cursor-not-allowed"
              />
              {displayName && (
                <button type="button" onClick={clearEmployee} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Selected pill */}
            {assignedTo && (
              <p className="mt-1 ml-1 text-xs text-green-600 font-medium">
                ✓ Employee ID: <span className="font-bold">{assignedTo}</span>
              </p>
            )}

            {/* Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                {suggestions.map((emp) => (
                  <li key={emp._id}>
                    <button
                      type="button"
                      onMouseDown={() => selectEmployee(emp)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition text-left"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {emp.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800">
                          {highlightMatch(emp.name, displayName)}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {highlightMatch(emp.employeeId, displayName)}
                          {emp.designation && ` · ${highlightMatch(emp.designation, displayName)}`}
                          {emp.email && ` · ${highlightMatch(emp.email, displayName)}`}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <input
            type="text"
            placeholder="Task Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-base focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />

          <textarea
            placeholder="Task Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows="4"
            disabled={loading}
            className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-base resize-y min-h-[100px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />

          <div className="flex justify-end gap-3 sm:flex-row flex-col">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-6 py-3 text-red-500 border-2 border-red-500 text-sm font-semibold hover:bg-red-500 hover:text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading || !assignedTo}
              className="px-6 py-3 bg-gray-800 text-white text-sm font-semibold hover:bg-blue-600 transition disabled:opacity-60 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Assigning..." : "Assign Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};