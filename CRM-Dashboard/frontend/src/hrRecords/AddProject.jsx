import { useState, useEffect, useRef } from "react";
import api from "../services/axios";
import {
  Plus, Trash2, X, Loader2, User, Mail,
  FolderPlus, FileText, Briefcase, Wrench, ClipboardList
} from "lucide-react";

// Roles considered eligible as project manager
const MANAGER_ROLES = ["admin", "hr", "manager"];

// ── Autocomplete input with dropdown ───────────────────────────────────────────
const SuggestInput = ({
  value, onChange, placeholder, icon, suggestions, onSelect, disabled,
  renderRow,        // (item) => JSX for each dropdown row
  filterFn,        // (item, inputVal) => bool
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const filtered = value.trim().length > 0
    ? suggestions.filter((s) => filterFn(s, value)).slice(0, 7)
    : [];

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
        {icon}
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-50 hover:bg-white text-sm"
      />
      {value && !disabled && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onChange(""); setOpen(false); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      )}

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
          {filtered.map((item, i) => (
            <li
              key={item._id || i}
              onMouseDown={(e) => { e.preventDefault(); onSelect(item); setOpen(false); }}
              className="px-4 py-2.5 cursor-pointer hover:bg-blue-50 transition text-sm border-b border-gray-50 last:border-0"
            >
              {renderRow(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── Role badge ──────────────────────────────────────────────────────────────────
const RoleBadge = ({ role }) => {
  const colors = {
    admin:   "bg-purple-100 text-purple-700",
    hr:      "bg-blue-100 text-blue-700",
    manager: "bg-green-100 text-green-700",
  };
  return (
    <span className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${colors[role] || "bg-gray-100 text-gray-600"}`}>
      {role}
    </span>
  );
};

// ── Main component ──────────────────────────────────────────────────────────────
const AddProject = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    projectId: "",
    title: "",
    description: "",
    manager: "",
    email: "",
    Skill: "",
    tool: "",
    status: "Ongoing",
    teamMembers: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [allUsers, setAllUsers] = useState([]);

  // Fetch all users + next project ID on mount
  useEffect(() => {
    api.get("/users")
      .then((r) => setAllUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    api.get("/projects/next-id")
      .then((r) => setFormData((p) => ({ ...p, projectId: r.data.nextId })))
      .catch(() => {});
  }, []);

  const managerUsers  = allUsers.filter((u) => MANAGER_ROLES.includes(u.role));
  const employeeUsers = allUsers.filter((u) => u.employeeId); // anyone with an empId

  // ── Field handlers ────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleManagerNameSelect = (user) => {
    setFormData((prev) => ({ ...prev, manager: user.name || "", email: user.email || "" }));
  };

  const handleManagerEmailSelect = (user) => {
    setFormData((prev) => ({ ...prev, manager: user.name || "", email: user.email || "" }));
  };

  const handleTeamMemberChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.teamMembers];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, teamMembers: updated };
    });
  };

  const handleTeamMemberSelect = (index, user) => {
    setFormData((prev) => {
      const updated = [...prev.teamMembers];
      updated[index] = { empId: user.employeeId || "", empEmail: user.email || "" };
      return { ...prev, teamMembers: updated };
    });
  };

  const handleAddTeamMember = () => {
    if (formData.teamMembers.length >= 4) return;
    setFormData((prev) => ({
      ...prev,
      teamMembers: [...prev.teamMembers, { empId: "", empEmail: "" }],
    }));
  };

  const handleRemoveTeamMember = (index) => {
    setFormData((prev) => {
      const updated = [...prev.teamMembers];
      updated.splice(index, 1);
      return { ...prev, teamMembers: updated };
    });
  };

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSaveClick = async () => {
    if (!formData.title || !formData.manager || !formData.email) {
      setError("Title, Manager name, and Manager email are required.");
      return;
    }
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid manager email address.");
      return;
    }
    if (formData.teamMembers.length > 4) {
      setError("Maximum 4 team members are allowed.");
      return;
    }
    for (const member of formData.teamMembers) {
      if (member.empId && !member.empEmail) {
        setError("All team members must have both Employee ID and Email.");
        return;
      }
      if (member.empEmail && !emailRegex.test(member.empEmail)) {
        setError("Please enter valid email addresses for all team members.");
        return;
      }
    }

    setIsLoading(true);
    setError("");

    const payload = {
      ...formData,
      skills: formData.Skill || "",
      tools: formData.tool || "",
    };
    delete payload.Skill;
    delete payload.tool;

    try {
      const response = await api.post("/projects", payload);
      if (response.data.success) {
        if (typeof onSave === "function") onSave(response.data.project);
        onClose();
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setError(err.response.data.errors.join(", "));
      } else {
        setError(err.response?.data?.message || "Failed to save project. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center z-[1000] p-4 overflow-y-auto">
      <div className="bg-white/95 rounded-2xl shadow-2xl w-full max-w-2xl p-8 relative border border-gray-200 my-10">

        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition">
          <X size={22} />
        </button>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3 border-b pb-3">
          <FolderPlus size={28} className="text-blue-600" />
          Add New Project
        </h2>

        {/* ── Row 1: ID + Title ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><ClipboardList size={18} /></span>
            <input
              type="text"
              value={formData.projectId || "Loading..."}
              readOnly disabled
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed text-sm font-mono"
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><FileText size={18} /></span>
            <input
              type="text" name="title" placeholder="Project Title"
              value={formData.title} onChange={handleChange} disabled={isLoading}
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50 hover:bg-white text-sm"
            />
          </div>
        </div>

        {/* ── Manager section ── */}
        <div className="mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <User size={13} /> Project Manager
            <span className="ml-1 text-[10px] normal-case font-normal text-gray-400">(admin / hr / manager roles only)</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Manager Name */}
            <SuggestInput
              value={formData.manager}
              onChange={(v) => setFormData((p) => ({ ...p, manager: v }))}
              placeholder="Manager Name"
              icon={<User size={18} />}
              suggestions={managerUsers}
              onSelect={handleManagerNameSelect}
              disabled={isLoading}
              filterFn={(u, v) => u.name?.toLowerCase().includes(v.toLowerCase())}
              renderRow={(u) => (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-800">{u.name}</span>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
              )}
            />

            {/* Manager Email */}
            <SuggestInput
              value={formData.email}
              onChange={(v) => setFormData((p) => ({ ...p, email: v }))}
              placeholder="Manager Email"
              icon={<Mail size={18} />}
              suggestions={managerUsers}
              onSelect={handleManagerEmailSelect}
              disabled={isLoading}
              filterFn={(u, v) => u.email?.toLowerCase().includes(v.toLowerCase())}
              renderRow={(u) => (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-800">{u.email}</span>
                    <p className="text-xs text-gray-400">{u.name}</p>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
              )}
            />
          </div>
        </div>

        {/* ── Skills & Tools ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Briefcase size={18} /></span>
            <input
              type="text" name="Skill" placeholder="Skills (comma separated)"
              value={formData.Skill} onChange={handleChange} disabled={isLoading}
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50 hover:bg-white text-sm"
            />
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Wrench size={18} /></span>
            <input
              type="text" name="tool" placeholder="Tools (comma separated)"
              value={formData.tool} onChange={handleChange} disabled={isLoading}
              className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50 hover:bg-white text-sm"
            />
          </div>
        </div>

        {/* ── Description ── */}
        <textarea
          name="description" placeholder="Project Description"
          value={formData.description} onChange={handleChange}
          rows="3" disabled={isLoading}
          className="border border-gray-300 rounded-lg w-full p-3 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition resize-none bg-gray-50 hover:bg-white text-sm mt-5"
        />

        {/* ── Error ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mt-3">
            {error}
          </div>
        )}

        {/* ── Team Members ── */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <User size={16} className="text-green-600" />
              Team Members
              <span className="text-xs text-gray-400 font-normal">(max 4)</span>
            </h3>
            <span className="text-xs text-gray-400">{formData.teamMembers.length} / 4</span>
          </div>

          <div className="flex flex-col gap-3">
            {formData.teamMembers.map((member, index) => (
              <div key={index} className="flex items-start gap-2">
                {/* Emp ID */}
                <div className="flex-1">
                  <SuggestInput
                    value={member.empId}
                    onChange={(v) => handleTeamMemberChange(index, "empId", v)}
                    placeholder="Employee ID"
                    icon={<ClipboardList size={15} />}
                    suggestions={employeeUsers}
                    onSelect={(u) => handleTeamMemberSelect(index, u)}
                    disabled={isLoading}
                    filterFn={(u, v) => u.employeeId?.toLowerCase().includes(v.toLowerCase())}
                    renderRow={(u) => (
                      <div>
                        <span className="font-medium text-gray-800">{u.employeeId}</span>
                        <span className="text-gray-400 text-xs ml-2">{u.name}</span>
                      </div>
                    )}
                  />
                </div>

                {/* Emp Email */}
                <div className="flex-1">
                  <SuggestInput
                    value={member.empEmail}
                    onChange={(v) => handleTeamMemberChange(index, "empEmail", v)}
                    placeholder="Employee Email"
                    icon={<Mail size={15} />}
                    suggestions={employeeUsers}
                    onSelect={(u) => handleTeamMemberSelect(index, u)}
                    disabled={isLoading}
                    filterFn={(u, v) => u.email?.toLowerCase().includes(v.toLowerCase())}
                    renderRow={(u) => (
                      <div>
                        <span className="font-medium text-gray-800">{u.email}</span>
                        <span className="text-gray-400 text-xs ml-2">{u.employeeId}</span>
                      </div>
                    )}
                  />
                </div>

                <button
                  onClick={() => handleRemoveTeamMember(index)}
                  className="mt-2.5 text-red-400 hover:text-red-600 transition flex-shrink-0"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddTeamMember}
            disabled={formData.teamMembers.length >= 4 || isLoading}
            className="mt-3 flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} /> Add Team Member
          </button>
        </div>

        {/* ── Actions ── */}
        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose} disabled={isLoading}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 disabled:opacity-60 transition text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick} disabled={isLoading}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2 shadow-md transition text-sm"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={15} />}
            {isLoading ? "Saving…" : "Save Project"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProject;