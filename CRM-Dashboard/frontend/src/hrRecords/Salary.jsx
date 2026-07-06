import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "../services/axios";
import { PlusCircle, Trash2, CheckCircle, X, Search, FileEdit, IndianRupee } from "lucide-react";

const Salary = () => {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    userId: user?.employeeId || "",
    userName: user?.name || "",
    userEmail: user?.email || "",
    basicPay: 0,
    allowances: { housing: 0, transport: 0, medical: 0, performanceBonus: 0, otherAllowance: 0, other: 0 },
    deductions: { incomeTax: 0, socialSecurity: 0, otherSecurity: 0, healthInsurance: 0, providentFund: 0, other: 0 },
    month: "",
    year: new Date().getFullYear().toString(),
    netPay: 0,
  });
  const [paidMonthYears, setPaidMonthYears] = useState([]);

  // Live suggestions
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

  // Close suggestions on outside click
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

  // Fetch paid months/years for selected employee
  useEffect(() => {
    async function fetchPaidMonthYears() {
      if (formData.userId) {
        try {
          const res = await axios.get("http://localhost:5000/api/salary?userId=" + formData.userId);
          setPaidMonthYears(res.data.map(s => `${s.month}-${s.year}`));
        } catch {
          setPaidMonthYears([]);
        }
      } else {
        setPaidMonthYears([]);
      }
    }
    if (showForm) fetchPaidMonthYears();
  }, [formData.userId, showForm]);

  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:5000/api/salary");
      setSalaries(res.data);
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSalaries(); }, []);

  // Auto-fill user info when modal opens (Add mode)
  useEffect(() => {
    if (showForm && !editingId && user) {
      setFormData((prev) => ({
        ...prev,
        userId: user.employeeId || "",
        userName: user.name || "",
        userEmail: user.email || "",
      }));
    }
  }, [showForm, editingId, user]);

  const filteredSalaries = salaries.filter(
    (s) =>
      s.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.userId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Auto-calculate Net Pay
  useEffect(() => {
    if (!showForm) return;
    const basic = Number(formData.basicPay) || 0;
    const hra = +(basic * 0.5).toFixed(2);
    const ma = +(basic * 0.0625).toFixed(2);
    const pa = +(basic * 0.1).toFixed(2);
    const pf = +(basic * 0.12).toFixed(2);
    const esi = +(basic * 0.0075).toFixed(2);
    const incomeTax = +(basic * 0.05).toFixed(2);
    const allow = hra + ma + pa + Number(formData.allowances.transport) + Number(formData.allowances.otherAllowance) + Number(formData.allowances.other);
    const deduct = pf + esi + incomeTax + Number(formData.deductions.socialSecurity) + Number(formData.deductions.otherSecurity) + Number(formData.deductions.other);
    setFormData((prev) => ({
      ...prev,
      allowances: { ...prev.allowances, housing: hra, medical: ma, performanceBonus: pa },
      deductions: { ...prev.deductions, providentFund: pf, healthInsurance: esi, incomeTax },
      netPay: basic + allow - deduct,
    }));
  }, [formData.basicPay, formData.allowances.transport, formData.allowances.otherAllowance, formData.allowances.other, formData.deductions.socialSecurity, formData.deductions.otherSecurity, formData.deductions.other]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userId || formData.userId.trim() === "") {
      alert("Employee ID is missing.");
      return;
    }
    try {
      const submitData = {
        userId: formData.userId, userName: formData.userName, userEmail: formData.userEmail,
        basicPay: formData.basicPay, allowances: formData.allowances, deductions: formData.deductions,
        netPay: formData.netPay, month: formData.month, year: formData.year,
      };
      if (editingId) {
        await axios.put(`http://localhost:5000/api/salary/${editingId}`, submitData);
      } else {
        await axios.post("http://localhost:5000/api/salary", submitData);
      }
      setEditingId(null);
      setShowForm(false);
      fetchSalaries();
    } catch (err) {
      alert(err.response?.data?.error || "Error saving salary");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this salary record?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/salary/${id}`);
      fetchSalaries();
    } catch (err) {
      alert(err.response?.data?.error || "Error deleting salary");
    }
  };

  const handleStatus = async (id, status) => {
    try {
      await axios.patch(`http://localhost:5000/api/salary/${id}/status`, { status });
      fetchSalaries();
    } catch (err) {
      alert(err.response?.data?.error || "Error updating status");
    }
  };

  const handleEdit = (salary) => {
    setFormData({
      userId: salary.userId || "",
      userName: salary.userName || "",
      userEmail: salary.userEmail || "",
      basicPay: Number(salary.basicPay) || 0,
      allowances: {
        housing: Number(salary.allowances?.housing) || 0,
        transport: Number(salary.allowances?.transport) || 0,
        medical: Number(salary.allowances?.medical) || 0,
        performanceBonus: Number(salary.allowances?.performanceBonus) || 0,
        otherAllowance: Number(salary.allowances?.otherAllowance) || 0,
        other: Number(salary.allowances?.other) || 0,
      },
      deductions: {
        incomeTax: Number(salary.deductions?.incomeTax) || 0,
        socialSecurity: Number(salary.deductions?.socialSecurity) || 0,
        otherSecurity: Number(salary.deductions?.otherSecurity) || 0,
        healthInsurance: Number(salary.deductions?.healthInsurance) || 0,
        providentFund: Number(salary.deductions?.providentFund) || 0,
        other: Number(salary.deductions?.other) || 0,
      },
      month: salary.month || "",
      year: salary.year || new Date().getFullYear().toString(),
      netPay: Number(salary.netPay) || 0,
    });
    setEditingId(salary._id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      userId: user?.employeeId || "", userName: user?.name || "", userEmail: user?.email || "",
      basicPay: 0,
      allowances: { housing: 0, transport: 0, medical: 0, performanceBonus: 0, otherAllowance: 0, other: 0 },
      deductions: { incomeTax: 0, socialSecurity: 0, otherSecurity: 0, healthInsurance: 0, providentFund: 0, other: 0 },
      month: "", year: new Date().getFullYear().toString(), netPay: 0,
    });
    setEditingId(null);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 md:px-10 py-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gray-800 p-2.5 rounded-lg">
              <IndianRupee className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Salary Management</h1>
              <p className="text-xs text-gray-500 mt-0.5">Manage employee payroll and salary records</p>
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full md:w-64" ref={searchWrapperRef}>
              <div className="flex items-center bg-white rounded-lg border border-gray-300 shadow-sm px-3 h-10">
                <Search className="text-gray-400 h-4 w-4 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  className="w-full outline-none text-sm text-gray-700 bg-transparent"
                />
                {searchTerm && (
                  <button type="button" onClick={() => { setSearchTerm(""); setSuggestions([]); setShowSuggestions(false); }}>
                    <X size={14} className="text-gray-400 hover:text-red-500" />
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
                      <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-semibold shrink-0">
                        {emp.photo
                          ? <img src={emp.photo} alt={emp.name} className="w-full h-full rounded-full object-cover" />
                          : emp.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{highlightMatch(emp.name, searchTerm)}</p>
                        <p className="text-xs text-gray-500 truncate">{emp.employeeId}</p>
                      </div>
                      <span className="text-xs text-indigo-500 font-medium shrink-0">{emp.designation || emp.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Add Button */}
            <button
              onClick={resetForm}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 h-10 rounded-lg shadow-sm transition whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" /> Add Salary
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 md:px-10 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-800 border-t-transparent"></div>
          </div>
        ) : filteredSalaries.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <IndianRupee className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No salary records found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">Emp ID</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">Name</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">Email</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">Period</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-green-300">Allowances</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-red-300">Deductions</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-blue-300">Net Pay</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSalaries.map((sal) => {
                    const totalAllowances = Object.values(sal.allowances || {}).reduce((a, v) => a + Number(v || 0), 0);
                    const totalDeductions = Object.values(sal.deductions || {}).reduce((a, v) => a + Number(v || 0), 0);
                    return (
                      <tr key={sal._id} className="hover:bg-gray-50 transition-colors duration-100">
                        <td className="px-5 py-3.5 text-xs font-mono text-gray-500">{sal.userId}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{sal.userName}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">{sal.userEmail}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-700">
                          <span className="font-medium">{sal.month}</span>
                          <span className="text-gray-400 ml-1">{sal.year}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            ₹{totalAllowances.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            ₹{totalDeductions.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-bold text-gray-900">₹{Number(sal.netPay).toLocaleString()}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            sal.status === "Paid"
                              ? "bg-green-100 text-green-700 border-green-200"
                              : sal.status === "Pending"
                              ? "bg-amber-100 text-amber-700 border-amber-200"
                              : "bg-red-100 text-red-700 border-red-200"
                          }`}>
                            {sal.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleEdit(sal)} className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Edit">
                              <FileEdit className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleStatus(sal._id, "Paid")} className="p-1.5 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition" title="Mark Paid">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleStatus(sal._id, "Failed")} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Mark Failed">
                              <X className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(sal._id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
              {filteredSalaries.length} record{filteredSalaries.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Salary Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white shadow-2xl w-full max-w-xl rounded-xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-1.5 rounded-lg">
                  <IndianRupee className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-white font-semibold text-base">
                  {editingId ? "Edit Salary Record" : "Add Salary Record"}
                </h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-white/60 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Employee Info */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Employee Information</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Employee ID</label>
                      <input
                        type="text"
                        value={formData.userId}
                        onChange={async (e) => {
                          const empId = e.target.value;
                          setFormData((prev) => ({ ...prev, userId: empId }));
                          if (empId.length >= 4) {
                            try {
                              const res = await axios.get(`http://localhost:5000/api/user/by-employee-id/${empId}`);
                              const emp = res.data;
                              setFormData((prev) => ({ ...prev, userName: emp.name || "", userEmail: emp.email || "" }));
                            } catch {
                              setFormData((prev) => ({ ...prev, userName: "", userEmail: "" }));
                            }
                          } else {
                            setFormData((prev) => ({ ...prev, userName: "", userEmail: "" }));
                          }
                        }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                        placeholder="e.g. EMP001"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Name</label>
                      <input type="text" value={formData.userName} disabled className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Email</label>
                      <input type="email" value={formData.userEmail} disabled className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Month</label>
                      <select
                        value={formData.month}
                        onChange={e => setFormData({ ...formData, month: e.target.value })}
                        required
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                      >
                        <option value="">Select Month</option>
                        {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => {
                          const combo = `${m}-${formData.year}`;
                          const disabled = paidMonthYears.includes(combo);
                          return <option key={i} value={m} disabled={disabled}>{m}{disabled ? " (Paid)" : ""}</option>;
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Year</label>
                      <select
                        value={formData.year}
                        onChange={e => setFormData({ ...formData, year: e.target.value })}
                        required
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
                      >
                        {Array.from({ length: 10 }).map((_, i) => {
                          const year = (2025 + i).toString();
                          const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                          const allPaid = months.every(m => paidMonthYears.includes(`${m}-${year}`));
                          return <option key={year} value={year} disabled={allPaid}>{year}{allPaid ? " (All Paid)" : ""}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Basic Pay */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Basic Pay</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                    <input
                      type="number"
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gray-800"
                      value={formData.basicPay}
                      onChange={(e) => setFormData({ ...formData, basicPay: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Allowances */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-green-600 mb-3">Allowances — Auto-calculated</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: "housing", label: "HRA (50%)" },
                      { name: "medical", label: "Medical (6.25%)" },
                      { name: "performanceBonus", label: "Bonus (10%)" },
                    ].map((field) => (
                      <div key={field.name}>
                        <label className="text-xs text-gray-500 mb-1 block">{field.label}</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                          <input
                            type="number"
                            className="w-full pl-6 pr-2 py-2 border border-gray-100 rounded-lg bg-green-50 text-sm text-green-800 font-medium cursor-not-allowed"
                            value={formData.allowances[field.name]}
                            disabled
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-500 mb-3">Deductions — Auto-calculated</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: "providentFund", label: "PF (12%)" },
                      { name: "incomeTax", label: "Tax (5%)" },
                      { name: "healthInsurance", label: "ESI (0.75%)" },
                    ].map((field) => (
                      <div key={field.name}>
                        <label className="text-xs text-gray-500 mb-1 block">{field.label}</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                          <input
                            type="number"
                            className="w-full pl-6 pr-2 py-2 border border-gray-100 rounded-lg bg-red-50 text-sm text-red-800 font-medium cursor-not-allowed"
                            value={formData.deductions[field.name]}
                            disabled
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Net Pay */}
                <div className="bg-gray-900 rounded-xl px-5 py-4 flex items-center justify-between">
                  <span className="text-gray-400 text-sm font-medium">Net Pay</span>
                  <span className="text-white text-2xl font-bold">₹{Number(formData.netPay).toLocaleString()}</span>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition">
                    Cancel
                  </button>
                  <button type="submit" className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gray-800 hover:bg-gray-700 shadow-sm transition">
                    {editingId ? "Save Changes" : "Add Record"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Salary;