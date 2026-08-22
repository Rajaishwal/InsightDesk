// RaiseTicket.jsx — Modal to submit a support ticket to the database
import { useState, useEffect } from "react";

import { X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import FileUploader from "./FileUploader";

const CATEGORIES = ["IT Support", "HR", "Finance", "Payroll", "Leave Related", "Other"];

const PROBLEMS = {
  "IT Support":    ["Login / Access Issue", "Software Not Working", "Hardware Problem", "Network / VPN Issue", "Email Issue", "Other IT Problem"],
  "HR":            ["Offer Letter", "Experience Letter", "Policy Clarification", "Onboarding Issue", "Other HR Query"],
  "Finance":       ["Reimbursement", "Invoice Query", "Budget Approval", "Other Finance Query"],
  "Payroll":       ["Salary Not Received", "Wrong Deduction", "Bonus / Incentive", "Tax / Form 16", "Other Payroll Issue"],
  "Leave Related": ["Leave Balance Incorrect", "Leave Not Approved", "Leave Policy Query", "Other Leave Issue"],
  "Other":         ["General Query", "Suggestion", "Feedback", "Other"],
};

export default function RaiseTicket({ isOpen, onClose, onSubmit }) {
  const { user } = useAuth();
  const [form, setForm] = useState({ category: "", problem: "", priority: "Low", description: "" });
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isOpen) { setForm({ category: "", problem: "", priority: "Low", description: "" }); setAttachments([]); setErr(""); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value, ...(name === "category" ? { problem: "" } : {}) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category || !form.description.trim()) {
      setErr("Category and description are required.");
      return;
    }
    try {
      setSubmitting(true);
      setErr("");
      const res = await api.post("/tickets", { ...form, attachments });
      onSubmit?.(res.data.ticket);
      onClose();
    } catch (error) {
      setErr(error.response?.data?.message || "Failed to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Raise a Ticket</h2>
            <p className="text-indigo-200 text-xs mt-0.5">Hi {user?.name} — describe your issue below</p>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{err}</div>}

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
            <select name="category" value={form.category} onChange={handleChange} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none">
              <option value="">Select category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Problem */}
          {form.category && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Problem</label>
              <select name="problem" value={form.problem} onChange={handleChange}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                <option value="">Select problem</option>
                {PROBLEMS[form.category]?.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Priority</label>
            <div className="flex gap-2">
              {["Low", "Medium", "High"].map(p => (
                <button key={p} type="button"
                  onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                  className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition
                    ${form.priority === p
                      ? p === "Low" ? "border-gray-400 bg-gray-50 text-gray-700"
                        : p === "Medium" ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-red-400 bg-red-50 text-red-700"
                      : "border-gray-100 text-gray-400 hover:border-gray-200"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={4} required
              placeholder="Describe your issue in detail..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none placeholder-gray-300" />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Attachments</label>
            <FileUploader attachments={attachments} onChange={setAttachments} disabled={submitting} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={submitting}
              className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition">
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}