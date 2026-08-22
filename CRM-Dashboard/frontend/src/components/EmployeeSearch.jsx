// EmployeeSearch.jsx — Two-column employee search: search bar left, full profile detail right
import { useState, useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";
import {
  Search, X, User, Mail, Briefcase, Clock, MapPin,
  Phone, Heart, Code, FileText, AlertCircle, Shield,
  Calendar, Droplet, ChevronRight, Users,
} from "lucide-react";
import axios from "../services/axios";

const initials = (name = "") =>
  name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

const Badge = ({ label, color = "indigo" }) => {
  const map = {
    indigo: "bg-indigo-100 text-indigo-700",
    purple: "bg-purple-100 text-purple-700",
    green:  "bg-green-100 text-green-700",
    red:    "bg-red-100 text-red-700",
    amber:  "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${map[color]}`}>
      {label}
    </span>
  );
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon size={14} className="text-indigo-500" />
    </div>
    <div>
      <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-sm text-gray-800 font-medium mt-0.5">{value || "—"}</p>
    </div>
  </div>
);

const Section = ({ icon: Icon, title, color = "text-indigo-600", children }) => (
  <div className="bg-gray-50 rounded-xl p-5">
    <h5 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">
      <Icon size={15} className={color} />
      {title}
    </h5>
    {children}
  </div>
);

export default function EmployeeSearch() {
  const toast = useToast();
  const [query, setQuery]               = useState("");
  const [suggestions, setSuggestions]   = useState([]);
  const [results, setResults]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [selected, setSelected]         = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDrop, setShowDrop]         = useState(false);
  const [searched, setSearched]         = useState(false);
  const wrapRef      = useRef(null);
  const fetchedRef   = useRef(null);
  const profileCache = useRef({});   // { [userId]: fullProfileData }

  // Live suggestions
  useEffect(() => {
    if (!query.trim()) { setSuggestions([]); setShowDrop(false); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(`/users/search?query=${encodeURIComponent(query)}`);
        setSuggestions(data || []);
        setShowDrop(true);
      } catch { setSuggestions([]); }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const fn = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // Fetch full profile whenever selection changes
  useEffect(() => {
    const id = selected?._id;
    if (!id || fetchedRef.current === id) return;
    fetchedRef.current = id;
    setDetailLoading(true);
    axios.get(`/users/${id}`)
      .then(({ data }) => {
        profileCache.current[data._id] = data;   // cache full profile
        setSelected(data);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selected?._id]);

  // Select an employee — serve cached full profile if available,
  // otherwise set partial data and let the effect fetch the full profile
  const selectEmployee = (r) => {
    const cached = profileCache.current[r._id];
    if (cached) {
      setSelected(cached);          // instant — no extra network request
    } else {
      fetchedRef.current = null;    // ensure the effect runs even if same _id
      setSelected(r);
    }
  };

  const doSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setShowDrop(false);
    setLoading(true);
    setSearched(true);
    try {
      const { data } = await axios.get(`/users/search?query=${encodeURIComponent(query)}`);
      setResults(data);
      // Auto-select if only one result
      if (data.length === 1) selectEmployee(data[0]);
    } catch { toast.error("Search failed"); }
    finally { setLoading(false); }
  };

  const pickSuggestion = (emp) => {
    setQuery(emp.name);
    setShowDrop(false);
    setResults([emp]);
    setSearched(true);
    selectEmployee(emp);
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setResults([]);
    setSearched(false);
    setSelected(null);
    fetchedRef.current = null;
  };

  const highlight = (text = "", q = "") => {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return text;
    return (
      <>
        {text.slice(0, i)}
        <mark className="bg-indigo-100 text-indigo-700 font-semibold rounded">
          {text.slice(i, i + q.length)}
        </mark>
        {text.slice(i + q.length)}
      </>
    );
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  const emp = selected;

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* Page header */}
      <div className="mb-7">
        <h2 className="text-xl font-bold text-gray-900">Employee Search</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Search by name, email, employee ID, designation, or domain
        </p>
      </div>

      {/* ── Two-column layout ─────────────────────────────────── */}
      <div className="flex gap-6 items-start">

        {/* ── LEFT: Search panel ─────────────────────────────── */}
        <div className="w-[360px] flex-shrink-0">

          {/* Search bar */}
          <form onSubmit={doSearch} ref={wrapRef} className="relative">
            <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm px-4 gap-3">
              <Search size={18} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDrop(true)}
                placeholder="Search employees…"
                className="flex-1 py-3 text-sm text-gray-700 outline-none bg-transparent"
              />
              {query && (
                <button type="button" onClick={clearSearch}>
                  <X size={15} className="text-gray-400 hover:text-red-500" />
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                title="Search"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition flex items-center justify-center flex-shrink-0"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Search size={15} />}
              </button>
            </div>

            {/* Dropdown suggestions */}
            {showDrop && suggestions.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                {suggestions.slice(0, 6).map((s) => (
                  <div
                    key={s._id}
                    onMouseDown={() => pickSuggestion(s)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                      {s.photo
                        ? <img src={s.photo} alt={s.name} className="w-full h-full object-cover" />
                        : initials(s.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{highlight(s.name, query)}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {highlight(s.email, query)}
                        {s.employeeId && <> · {highlight(s.employeeId, query)}</>}
                      </p>
                    </div>
                    <span className="text-xs text-indigo-500 font-medium flex-shrink-0">
                      {s.designation || s.role}
                    </span>
                    <ChevronRight size={14} className="text-gray-300" />
                  </div>
                ))}
              </div>
            )}

            {showDrop && query && suggestions.length === 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm text-gray-400">
                No suggestions
              </div>
            )}
          </form>

          {/* Results list */}
          {results.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2 px-1">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-1.5">
                {results.map((r) => {
                  const isActive = selected?._id === r._id;
                  return (
                    <div
                      key={r._id}
                      onClick={() => selectEmployee(r)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition border ${
                        isActive
                          ? "bg-indigo-50 border-indigo-200"
                          : "bg-white border-gray-100 hover:border-indigo-100 hover:bg-gray-50"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                        {r.photo
                          ? <img src={r.photo} alt={r.name} className="w-full h-full object-cover" />
                          : initials(r.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? "text-indigo-700" : "text-gray-800"}`}>
                          {r.name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {r.designation || r.role}
                          {r.employeeId ? ` · ${r.employeeId}` : ""}
                        </p>
                      </div>
                      {isActive && <ChevronRight size={15} className="text-indigo-400 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No results state */}
          {searched && !loading && results.length === 0 && (
            <div className="mt-10 text-center text-gray-400">
              <AlertCircle size={36} className="mx-auto mb-2 text-gray-300" />
              <p className="font-semibold text-gray-600 text-sm">No employees found</p>
              <p className="text-xs mt-0.5">Try a different name, email, or ID</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Detail panel ────────────────────────────── */}
        <div className="flex-1 min-w-0 sticky top-6">

          {emp ? (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">

              {/* Banner */}
              <div className="relative bg-gradient-to-br from-indigo-50 via-violet-50 to-blue-50 border-b border-indigo-100 overflow-hidden">
                <div
                  className="absolute inset-0 opacity-40"
                  style={{ backgroundImage: "radial-gradient(circle, #c7d2fe 1px, transparent 1px)", backgroundSize: "24px 24px" }}
                />

                {/* Photo + info + close */}
                <div className="relative flex items-center justify-between px-6 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl font-bold overflow-hidden flex-shrink-0">
                      {emp.photo
                        ? <img src={emp.photo} alt={emp.name} className="w-full h-full object-cover" />
                        : initials(emp.name)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 leading-tight">{emp.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {emp.designation || "No designation"}
                        {emp.domain ? ` · ${emp.domain}` : ""}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge
                          label={emp.role === "admin" ? "Admin" : "Employee"}
                          color={emp.role === "admin" ? "purple" : "indigo"}
                        />
                        <Badge
                          label={emp.profileCompleted ? "Profile Complete" : "Incomplete"}
                          color={emp.profileCompleted ? "green" : "red"}
                        />
                        {emp.bloodGroup && <Badge label={emp.bloodGroup} color="red" />}
                      </div>
                      {emp.bio && (
                        <p className="text-xs text-gray-400 italic mt-1.5 line-clamp-1 max-w-sm">{emp.bio}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => { setSelected(null); fetchedRef.current = null; }}
                    className="text-gray-400 hover:text-gray-700 transition self-start"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Stats bar */}
                <div className="relative mt-4 border-t border-indigo-100 flex divide-x divide-indigo-100">
                  {[
                    { label: "Employee ID",  value: emp.employeeId || "—" },
                    { label: "Shift",        value: emp.shiftTiming || "—" },
                    { label: "Experience",   value: emp.experience ? emp.experience.split(" ").slice(0, 2).join(" ") : "—" },
                    { label: "Member Since", value: formatDate(emp.createdAt) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex-1 px-4 py-2.5 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                      <p className="text-xs font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto p-6 space-y-4 max-h-[calc(100vh-300px)] relative">
                {detailLoading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {emp.bio && (
                  <Section icon={FileText} title="Bio / About" color="text-gray-500">
                    <p className="text-sm text-gray-700 leading-relaxed">{emp.bio}</p>
                  </Section>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Section icon={User} title="Basic Information">
                    <div className="grid grid-cols-1 gap-3">
                      <InfoRow icon={Mail}     label="Email"        value={emp.email} />
                      <InfoRow icon={Shield}   label="Gender"       value={emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : null} />
                      <InfoRow icon={Calendar} label="Date of Birth" value={formatDate(emp.dateOfBirth)} />
                      <InfoRow icon={Droplet}  label="Blood Group"  value={emp.bloodGroup} />
                    </div>
                  </Section>

                  <Section icon={Phone} title="Contact Information" color="text-green-600">
                    <div className="grid grid-cols-1 gap-3">
                      <InfoRow icon={Phone}  label="Phone"   value={emp.phone} />
                      <InfoRow icon={Mail}   label="Email"   value={emp.email} />
                      <InfoRow icon={MapPin} label="Address" value={
                        [emp.address?.street, emp.address?.city, emp.address?.state, emp.address?.zipCode, emp.address?.country]
                          .filter(Boolean).join(", ") || null
                      } />
                    </div>
                  </Section>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Section icon={Briefcase} title="Work Information" color="text-blue-600">
                    <div className="grid grid-cols-1 gap-3">
                      <InfoRow icon={Briefcase} label="Designation" value={emp.designation} />
                      <InfoRow icon={Briefcase} label="Domain"      value={emp.domain} />
                      <InfoRow icon={Clock}     label="Shift"       value={emp.shiftTiming} />
                    </div>
                  </Section>

                  <Section icon={Code} title="Professional Info" color="text-violet-600">
                    <div className="space-y-3">
                      <InfoRow icon={FileText} label="Experience" value={emp.experience} />
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mb-2">Skills</p>
                        {emp.skills?.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {emp.skills.map((s) => (
                              <span key={s} className="text-xs bg-indigo-100 text-indigo-700 font-medium px-2.5 py-0.5 rounded-full">
                                {s}
                              </span>
                            ))}
                          </div>
                        ) : <p className="text-sm text-gray-400">—</p>}
                      </div>
                    </div>
                  </Section>
                </div>

                {(emp.emergencyContact?.name || emp.emergencyContact?.phone) && (
                  <Section icon={Heart} title="Emergency Contact" color="text-red-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <InfoRow icon={User}  label="Name"         value={emp.emergencyContact.name} />
                      <InfoRow icon={Phone} label="Phone"        value={emp.emergencyContact.phone} />
                      <InfoRow icon={Heart} label="Relationship" value={emp.emergencyContact.relationship} />
                    </div>
                  </Section>
                )}
              </div>
            </div>

          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center text-center bg-white rounded-2xl border border-dashed border-gray-200 h-[500px]">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                <Users size={28} className="text-indigo-300" />
              </div>
              <p className="font-semibold text-gray-500 text-base">No employee selected</p>
              <p className="text-sm mt-1.5 text-gray-400 max-w-xs leading-relaxed">
                Search by name, email, or employee ID on the left — select a result to view their full profile here
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}