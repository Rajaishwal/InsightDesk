import { useState, useEffect, useRef } from "react";
import { X, Camera, Loader2, ChevronRight, Check, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";

const DESIGNATIONS = [
  "Software Developer Engineer", "Frontend Developer", "Backend Developer",
  "Full Stack Developer", "UI/UX Designer", "QA Engineer", "DevOps Engineer",
  "Dot Net Developer", "React Developer", "Node.js Developer", "Data Analyst",
  "HR Manager", "HR Executive", "Marketing Executive", "Finance Analyst",
  "Project Manager", "Business Analyst", "Cloud Engineer", "Mobile Developer", "Scrum Master",
];
const DOMAINS = ["IT", "HR", "Finance", "Marketing", "Operations", "Design", "QA"];
const SHIFTS  = ["07:00 AM - 02:00 PM", "09:00 AM - 06:00 PM", "10:00 AM - 07:00 PM", "02:00 PM - 10:00 PM"];

export default function EditProfileModal({ onClose }) {
  const { user } = useAuth();
  const fileRef = useRef(null);

  const [tab, setTab] = useState("info");        // "info" | "address"
  const [editing, setEditing]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [saved, setSaved]         = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", employeeId: "",
    gender: "", designation: "", domain: "", shiftTiming: "",
    address: { street: "", city: "", state: "", zipCode: "", country: "" },
  });

  const locked = !!(user?.gender || user?.designation || user?.domain || user?.shiftTiming || user?.address?.city);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "", email: user.email || "", employeeId: user.employeeId || "",
      gender: user.gender || "", designation: user.designation || "",
      domain: user.domain || "", shiftTiming: user.shiftTiming || "",
      address: {
        street:  user.address?.street  || "",
        city:    user.address?.city    || "",
        state:   user.address?.state   || "",
        zipCode: user.address?.zipCode || "",
        country: user.address?.country || "",
      },
    });
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (["name", "email", "employeeId"].includes(name)) return;
    if (locked) {
      if (!["designation", "shiftTiming"].includes(name) && !name.startsWith("address.")) return;
    }
    if (name.startsWith("address.")) {
      const key = name.split(".")[1];
      setForm(p => ({ ...p, address: { ...p.address, [key]: value } }));
    } else {
      setForm(p => ({ ...p, [name]: value }));
    }
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setPhotoLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      const up = await api.post("http://localhost:5000/api/upload", fd);
      await api.put(`http://localhost:5000/api/users/${user._id}/profile`, { photo: up.data.fileUrl });
      window.location.reload();
    } catch (err) {
      alert(err.response?.data?.message || "Photo upload failed");
    } finally { setPhotoLoading(false); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { name, email, employeeId, ...rest } = form;
      await api.put(`http://localhost:5000/api/users/${user._id}/profile`, rest);
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditing(false); }, 1400);
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    } finally { setLoading(false); }
  };

  /* ── Field components ── */
  const isLocked = (name) => {
    if (["name", "email", "employeeId"].includes(name)) return true;
    if (locked && ["gender", "domain"].includes(name)) return true;
    if (!editing) return true;
    return false;
  };

  const Input = ({ label, name, type = "text", children }) => {
    const dis = isLocked(name);
    const val = name.startsWith("address.")
      ? form.address[name.split(".")[1]]
      : form[name];

    return (
      <div className="group/field relative">
        <label className="block text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-1.5">
          {label}
          {(name === "name" || name === "email" || name === "employeeId") && (
            <Lock className="inline w-2.5 h-2.5 ml-1 text-gray-300" />
          )}
        </label>
        {children ? (
          <select
            name={name} value={val} onChange={handleChange} disabled={dis}
            className={`w-full bg-transparent border-b-2 pb-1.5 text-sm font-medium outline-none transition-colors ${
              dis ? "border-gray-100 text-gray-400 cursor-not-allowed" : "border-gray-300 text-gray-800 focus:border-indigo-500"
            }`}
          >
            {children}
          </select>
        ) : (
          <input
            type={type} name={name} value={val} onChange={handleChange} disabled={dis}
            className={`w-full bg-transparent border-b-2 pb-1.5 text-sm font-medium outline-none transition-colors ${
              dis ? "border-gray-100 text-gray-400 cursor-not-allowed" : "border-gray-300 text-gray-800 focus:border-indigo-500"
            }`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[420px] mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Dark header band ── */}
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-6 pb-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-end gap-4">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white/20 bg-indigo-600">
                {user?.photo
                  ? <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl font-black text-white">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                }
                {photoLoading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-indigo-500 hover:bg-indigo-400 border-2 border-slate-800 flex items-center justify-center transition"
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </div>

            {/* Name + meta */}
            <div className="pb-0.5">
              <h2 className="text-white font-bold text-base leading-tight">{user?.name}</h2>
              <p className="text-indigo-300 text-xs font-medium mt-0.5">{user?.designation || user?.role}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-bold text-white/40 font-mono tracking-wider">{user?.employeeId}</span>
                {user?.domain && (
                  <span className="text-[10px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded font-semibold">{user.domain}</span>
                )}
              </div>
            </div>
          </div>

          {/* Tab bar — anchored to bottom of header, overlapping into white */}
          <div className="absolute bottom-0 left-0 right-0 flex border-t border-white/10">
            {[["info", "Profile"], ["address", "Address"]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 text-xs font-bold py-2.5 tracking-wide transition ${
                  tab === key
                    ? "bg-white text-gray-800 rounded-t-xl"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5">

          {/* Lock notice */}
          {locked && (
            <div className="flex items-center gap-2 text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
              <Lock className="w-3 h-3 flex-shrink-0" />
              After first save, only Designation, Shift Timing &amp; Address can be changed.
            </div>
          )}

          {tab === "info" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <div className="col-span-2"><Input label="Full Name"   name="name" /></div>
                <div className="col-span-2"><Input label="Email"       name="email" type="email" /></div>
                <Input label="Employee ID" name="employeeId" />
                <Input label="Gender" name="gender">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Input>
                <Input label="Designation" name="designation">
                  <option value="">Select</option>
                  {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </Input>
                <Input label="Domain" name="domain">
                  <option value="">Select</option>
                  {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                </Input>
                <div className="col-span-2">
                  <Input label="Shift Timing" name="shiftTiming">
                    <option value="">Select</option>
                    {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </Input>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <div className="col-span-2"><Input label="Street Address" name="address.street" /></div>
                <Input label="City"    name="address.city" />
                <Input label="State"   name="address.state" />
                <Input label="ZIP"     name="address.zipCode" />
                <Input label="Country" name="address.country" />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-5 flex items-center justify-between gap-3">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl transition disabled:opacity-60"
              >
                {loading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : saved
                  ? <Check className="w-3.5 h-3.5 text-green-400" />
                  : <ChevronRight className="w-3.5 h-3.5" />
                }
                {saved ? "Saved!" : loading ? "Saving…" : "Save Changes"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="ml-auto flex items-center gap-2 text-xs font-bold border-2 border-slate-800 text-slate-800 hover:bg-slate-800 hover:text-white px-5 py-2 rounded-xl transition"
            >
              Edit Profile <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}