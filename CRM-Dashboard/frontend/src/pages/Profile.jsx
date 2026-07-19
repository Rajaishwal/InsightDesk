import {
  faUser, faSave, faIdBadge, faHome, faBriefcase, faEdit,
  faVenusMars, faBuilding, faClock, faCamera,
  faTimes, faPhone, faBirthdayCake, faTint, faHeartbeat,
  faCode, faLayerGroup, faFileAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "../services/axios";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const EXPERIENCE_OPTS = ["0-1 years (Fresher)", "1-3 years (Junior)", "3-5 years (Mid-Level)", "5-8 years (Senior)", "8+ years (Lead/Expert)"];
const RELATIONSHIPS = ["Spouse", "Parent", "Sibling", "Friend", "Other"];

const SectionHeader = ({ icon, label, color = "text-blue-500" }) => (
  <h3 className="flex items-center gap-2 text-base font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
    <FontAwesomeIcon icon={icon} className={color} />
    {label}
  </h3>
);

const Field = ({ label, icon, children, span2 }) => (
  <div className={span2 ? "md:col-span-2" : ""}>
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
      {icon && <FontAwesomeIcon icon={icon} className="text-gray-400" />}
      {label}
    </label>
    {children}
  </div>
);

const inputCls = (disabled) =>
  `w-full border border-gray-200 rounded-lg px-3 py-2 text-sm transition ${disabled ? "bg-gray-50 text-gray-500 cursor-not-allowed" : "bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
  }`;

export default function Profile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [savedBefore, setSavedBefore] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const skillRef = useRef(null);
  const photoInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "", email: "", employeeId: "",
    gender: "", shiftTiming: "", designation: "", domain: "",
    phone: "", dateOfBirth: "", bloodGroup: "",
    emergencyContact: { name: "", phone: "", relationship: "" },
    bio: "", skills: [], experience: "",
    address: { street: "", city: "", state: "", zipCode: "", country: "" },
  });

  useEffect(() => {
    if (!user) return;
    const d = {
      name: user.name || "",
      email: user.email || "",
      employeeId: user.employeeId || "",
      gender: user.gender || "",
      shiftTiming: user.shiftTiming || "",
      designation: user.designation || "",
      domain: user.domain || "",
      phone: user.phone || "",
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split("T")[0] : "",
      bloodGroup: user.bloodGroup || "",
      emergencyContact: {
        name: user.emergencyContact?.name || "",
        phone: user.emergencyContact?.phone || "",
        relationship: user.emergencyContact?.relationship || "",
      },
      bio: user.bio || "",
      skills: user.skills || [],
      experience: user.experience || "",
      address: {
        street: user.address?.street || "",
        city: user.address?.city || "",
        state: user.address?.state || "",
        zipCode: user.address?.zipCode || "",
        country: user.address?.country || "",
      },
    };
    setForm(d);
    setPhotoUrl(user.photo || null);
    setSavedBefore(!!(d.gender || d.designation || d.domain || d.shiftTiming || d.address.city));
  }, [user]);

  // ── Photo upload ──────────────────────────────────────────────
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await axios.post("http://localhost:5000/api/upload", fd);
      await axios.put(`http://localhost:5000/api/users/${user._id}/profile`, { photo: data.fileUrl });
      setPhotoUrl(data.fileUrl);
      alert("Profile photo updated!");
    } catch (err) {
      alert(err.response?.data?.message || "Photo upload failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Field change ──────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (["name", "email", "employeeId"].includes(name)) return;
    if (name.startsWith("emergencyContact.")) {
      const f = name.split(".")[1];
      setForm(p => ({ ...p, emergencyContact: { ...p.emergencyContact, [f]: value } }));
    } else if (name.startsWith("address.")) {
      const f = name.split(".")[1];
      setForm(p => ({ ...p, address: { ...p.address, [f]: value } }));
    } else {
      setForm(p => ({ ...p, [name]: value }));
    }
  };

  // ── Skills tags ───────────────────────────────────────────────
  const addSkill = () => {
    const s = skillInput.trim();
    if (!s || form.skills.includes(s)) return;
    setForm(p => ({ ...p, skills: [...p.skills, s] }));
    setSkillInput("");
    skillRef.current?.focus();
  };
  const removeSkill = (s) => setForm(p => ({ ...p, skills: p.skills.filter(x => x !== s) }));

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { name, email, employeeId, ...rest } = form;
      await axios.put(`http://localhost:5000/api/users/${user._id}/profile`, rest);
      alert("Profile updated successfully!");
      setSavedBefore(true);
      setEditing(false);
      setEditingAddress(false);
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Error updating profile");
    } finally {
      setLoading(false);
    }
  };

  const initials = (name = "") => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const roleBadge = user?.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700";

  // Profile completion
  const completionFields = [
    form.phone, form.dateOfBirth, form.bloodGroup, form.gender,
    form.designation, form.domain, form.shiftTiming,
    form.emergencyContact.name, form.bio, form.experience,
    form.skills.length > 0 ? "x" : "", form.address.city,
  ];
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);
  const memberSince = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── BANNER ───────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-br from-indigo-50 via-violet-50 to-blue-50 overflow-hidden border border-indigo-100 rounded-2xl shadow-sm">
          {/* Subtle dot pattern */}
          <div className="absolute inset-0 opacity-[0.4]"
            style={{ backgroundImage: "radial-gradient(circle, #c7d2fe 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

          {/* Top row */}
          <div className="relative flex items-start justify-between px-8 pt-6 pb-0">
            <div className="flex items-center gap-5">
              {/* Profile photo inside banner */}
              <div className="relative flex-shrink-0">
                {photoUrl ? (
                  <img src={photoUrl} alt={form.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                    {initials(form.name)}
                  </div>
                )}
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  disabled={loading}
                  className="absolute bottom-1 right-1 w-7 h-7 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-md transition disabled:opacity-60"
                  title="Change photo">
                  <FontAwesomeIcon icon={faCamera} className="text-xs" />
                </button>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </div>
              <div>
                <h2 className="text-gray-900 text-2xl font-bold leading-tight">{form.name || "Employee"}</h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  {form.designation || "No designation"}{form.domain ? ` · ${form.domain}` : ""}
                </p>
                <span className={`mt-1.5 inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${user?.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"}`}>
                  {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                </span>
              </div>
            </div>

            {/* Edit button */}
            <button type="button" onClick={() => setEditing(v => !v)}
              className={`mt-1 px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border transition ${editing
                ? "bg-red-500 border-red-500 text-white hover:bg-red-600"
                : "bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                }`}>
              <FontAwesomeIcon icon={editing ? faTimes : faEdit} />
              {editing ? "Cancel" : "Edit Profile"}
            </button>
          </div>

          {/* Bottom stats bar */}
          <div className="relative mt-5 border-t border-indigo-100 flex divide-x divide-indigo-100">
            {/* Profile completion */}
            <div className="flex-1 px-6 py-3">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1.5">Profile Completion</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
                </div>
                <span className="text-indigo-700 font-bold text-sm">{completionPct}%</span>
              </div>
            </div>
            {/* Employee ID */}
            <div className="px-6 py-3 text-center">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Employee ID</p>
              <p className="text-gray-800 font-mono font-semibold text-sm">{form.employeeId || "—"}</p>
            </div>
            {/* Shift */}
            <div className="px-6 py-3 text-center">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Shift</p>
              <p className="text-gray-800 font-semibold text-sm">{form.shiftTiming || "—"}</p>
            </div>
            {/* Member since */}
            <div className="px-6 py-3 text-center">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Member Since</p>
              <p className="text-gray-800 font-semibold text-sm">{memberSince}</p>
            </div>
            {/* Save — appears when editing */}
            {(editing || editingAddress) && (
              <div className="px-6 py-2 flex items-center">
                <button type="submit" disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-1.5 rounded-lg flex items-center gap-2 shadow transition disabled:opacity-70 text-sm">
                  <FontAwesomeIcon icon={faSave} />
                  {loading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Grid layout: left col (2/3) + right col (1/3) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT — 2 columns wide */}
            <div className="lg:col-span-2 space-y-6">

              {/* Bio */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <SectionHeader icon={faFileAlt} label="Bio / About Me" color="text-indigo-500" />
                <Field label="" icon={null}>
                  <textarea name="bio" value={form.bio} onChange={handleChange}
                    disabled={!editing} rows={3} placeholder="Write a short introduction about yourself..."
                    className={`${inputCls(!editing)} resize-none`} />
                </Field>
              </div>

              {/* Basic Information */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <SectionHeader icon={faIdBadge} label="Basic Information" color="text-blue-500" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[{ label: "Full Name", name: "name" }, { label: "Email", name: "email" }, { label: "Employee ID", name: "employeeId" }].map(f => (
                    <Field key={f.name} label={f.label} icon={faUser}>
                      <input type="text" value={form[f.name]} disabled className={inputCls(true)} />
                    </Field>
                  ))}

                  <Field label="Gender" icon={faVenusMars}>
                    <select name="gender" value={form.gender} onChange={handleChange}
                      disabled={savedBefore || (!editing && !!form.gender)}
                      className={inputCls(savedBefore || (!editing && !!form.gender))}>
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>

                  <Field label="Designation" icon={faBriefcase}>
                    <input type="text" name="designation" value={form.designation} onChange={handleChange}
                      disabled={!editing} placeholder="e.g., Software Developer" className={inputCls(!editing)} />
                  </Field>

                  <Field label="Domain / Department" icon={faBuilding}>
                    <select name="domain" value={form.domain} onChange={handleChange}
                      disabled={savedBefore || (!editing && !!form.domain)}
                      className={inputCls(savedBefore || (!editing && !!form.domain))}>
                      <option value="">Select Domain</option>
                      <option value="IT">IT</option>
                      <option value="HR">HR</option>
                      <option value="Finance">Finance</option>
                    </select>
                  </Field>

                  <Field label="Shift Timing" icon={faClock}>
                    <select name="shiftTiming" value={form.shiftTiming} onChange={handleChange}
                      disabled={!editing && !!form.shiftTiming}
                      className={inputCls(!editing && !!form.shiftTiming)}>
                      <option value="">Select Shift</option>
                      <option value="07:00 AM - 02:00 PM">07:00 AM – 02:00 PM</option>
                      <option value="02:00 PM - 09:00 PM">02:00 PM – 09:00 PM</option>
                    </select>
                  </Field>
                </div>
              </div>

              {/* Professional Information */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <SectionHeader icon={faCode} label="Professional Information" color="text-indigo-500" />
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Experience Level" icon={faLayerGroup}>
                      <select name="experience" value={form.experience} onChange={handleChange}
                        disabled={!editing} className={inputCls(!editing)}>
                        <option value="">Select Experience</option>
                        {EXPERIENCE_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>

                    <Field label="Skills (press Enter to add)" icon={faCode}>
                      <div className={`border border-gray-200 rounded-lg px-3 py-2 min-h-[42px] flex flex-wrap gap-1.5 items-center transition ${!editing ? "bg-gray-50" : "focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-400 bg-white"
                        }`}>
                        {form.skills.map(s => (
                          <span key={s} className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                            {s}
                            {editing && (
                              <button type="button" onClick={() => removeSkill(s)} className="hover:text-red-500 ml-0.5">
                                <FontAwesomeIcon icon={faTimes} className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </span>
                        ))}
                        {editing && (
                          <input ref={skillRef} type="text" value={skillInput}
                            onChange={e => setSkillInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
                            placeholder={form.skills.length === 0 ? "e.g. React, Node.js…" : "Add more…"}
                            className="flex-1 min-w-[120px] outline-none text-sm bg-transparent" />
                        )}
                      </div>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader icon={faHome} label="Address Information" color="text-green-500" />
                  <button type="button" onClick={() => setEditingAddress(v => !v)}
                    className={`-mt-4 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${editingAddress ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>
                    <FontAwesomeIcon icon={editingAddress ? faTimes : faEdit} />
                    {editingAddress ? "Cancel" : "Edit"}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    { label: "Street Address", name: "address.street", full: true },
                    { label: "City", name: "address.city" },
                    { label: "State", name: "address.state" },
                    { label: "ZIP Code", name: "address.zipCode" },
                    { label: "Country", name: "address.country" },
                  ].map(f => (
                    <div key={f.name} className={f.full ? "md:col-span-2" : ""}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{f.label}</label>
                      <input type="text" name={f.name}
                        value={f.name.startsWith("address.") ? form.address[f.name.split(".")[1]] : form[f.name]}
                        onChange={handleChange} disabled={!editingAddress} className={inputCls(!editingAddress)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT — 1 column wide */}
            <div className="space-y-6">

              {/* Contact Information */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <SectionHeader icon={faPhone} label="Contact Information" color="text-green-500" />
                <div className="space-y-4">
                  <Field label="Phone Number" icon={faPhone}>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange}
                      disabled={!editing} placeholder="+91 98765 43210" className={inputCls(!editing)} />
                  </Field>
                  <Field label="Date of Birth" icon={faBirthdayCake}>
                    <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange}
                      disabled={!editing} className={inputCls(!editing)} />
                  </Field>
                  <Field label="Blood Group" icon={faTint}>
                    <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange}
                      disabled={!editing} className={inputCls(!editing)}>
                      <option value="">Select Blood Group</option>
                      {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <SectionHeader icon={faHeartbeat} label="Emergency Contact" color="text-red-500" />
                <div className="space-y-4">
                  <Field label="Contact Name">
                    <input type="text" name="emergencyContact.name" value={form.emergencyContact.name}
                      onChange={handleChange} disabled={!editing} placeholder="Full name" className={inputCls(!editing)} />
                  </Field>
                  <Field label="Contact Phone">
                    <input type="tel" name="emergencyContact.phone" value={form.emergencyContact.phone}
                      onChange={handleChange} disabled={!editing} placeholder="+91 98765 43210" className={inputCls(!editing)} />
                  </Field>
                  <Field label="Relationship">
                    <select name="emergencyContact.relationship" value={form.emergencyContact.relationship}
                      onChange={handleChange} disabled={!editing} className={inputCls(!editing)}>
                      <option value="">Select Relationship</option>
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

            </div>
          </div>
      </form>
    </div>
  );
}