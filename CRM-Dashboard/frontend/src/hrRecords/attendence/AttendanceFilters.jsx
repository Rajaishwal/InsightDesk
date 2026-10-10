// AttendanceFilters.jsx — Toolbar for the HR attendance table: employee picker, quick date ranges,
// from/to dates and rows per page. Dates are India-time calendar days ("YYYY-MM-DD"), like the records.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Check, Users } from "lucide-react";
import PersonAvatar from "../../components/PersonAvatar";

const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const addDays = (key, n) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const PRESETS = [
  { id: "today", label: "Today",       range: (t) => [t, t] },
  { id: "week",  label: "Last 7 days", range: (t) => [addDays(t, -6), t] },
  { id: "month", label: "This month",  range: (t) => [`${t.slice(0, 8)}01`, t] },
  { id: "all",   label: "All time",    range: () => ["", ""] },
];

const inputCls =
  "rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 outline-none transition " +
  "focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50";

// Employee picker — avatar list with a search box
function PersonPicker({ people, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const selected = people.find((p) => p._id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (id) => { onChange(id); setOpen(false); setQ(""); };
  const shown = people.filter((p) => p.name?.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-50"
      >
        {selected ? (
          <PersonAvatar person={selected} size={26} />
        ) : (
          <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gray-100">
            <Users className="h-3.5 w-3.5 text-gray-500" />
          </span>
        )}
        <span className="max-w-[10rem] truncate">{selected ? selected.name : "All employees"}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-dialog-in absolute left-0 z-40 mt-2 w-64 rounded-xl border border-gray-100 bg-white p-1 shadow-lg shadow-gray-900/10">
          <div className="flex items-center gap-2 border-b border-gray-100 px-2.5 pb-2 pt-1.5">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find an employee…"
              className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
          <div role="listbox" className="max-h-64 overflow-y-auto py-1 [scrollbar-width:thin]">
            {!q && (
              <button type="button" role="option" aria-selected={!value} onClick={() => pick("")}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-gray-50 ${!value ? "bg-gray-50" : ""}`}>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100"><Users className="h-3.5 w-3.5 text-gray-500" /></span>
                <span className="flex-1 font-medium text-gray-800">All employees</span>
                {!value && <Check className="h-3.5 w-3.5 text-indigo-600" />}
              </button>
            )}
            {shown.map((p) => (
              <button key={p._id} type="button" role="option" aria-selected={p._id === value} onClick={() => pick(p._id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-gray-50 ${p._id === value ? "bg-gray-50" : ""}`}>
                <PersonAvatar person={p} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800">{p.name}</span>
                  <span className="block truncate text-[11px] text-gray-400">{[p.employeeId, p.designation].filter(Boolean).join(" · ") || p.role}</span>
                </span>
                {p._id === value && <Check className="h-3.5 w-3.5 text-indigo-600" />}
              </button>
            ))}
            {shown.length === 0 && <p className="px-3 py-3 text-center text-xs text-gray-400">No one matches “{q}”</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const AttendanceFilters = ({ filters, setFilters, people }) => {
  const set = (patch) => setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  const today = istToday();
  const activePreset = PRESETS.find((p) => {
    const [s, e] = p.range(today);
    return s === filters.startDate && e === filters.endDate;
  })?.id;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <PersonPicker people={people} value={filters.userId} onChange={(userId) => set({ userId })} />

      <span className="hidden h-6 w-px bg-gray-100 sm:block" />

      {/* Quick ranges */}
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { const [startDate, endDate] = p.range(today); set({ startDate, endDate }); }}
            aria-pressed={activePreset === p.id}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition
              ${activePreset === p.id ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      <div className="flex items-center gap-1.5">
        <input type="date" aria-label="From date" value={filters.startDate} max={filters.endDate || undefined}
          onChange={(e) => set({ startDate: e.target.value })} className={inputCls} />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" aria-label="To date" value={filters.endDate} min={filters.startDate || undefined}
          onChange={(e) => set({ endDate: e.target.value })} className={inputCls} />
      </div>

      {/* Rows per page */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rows</span>
        <div className="inline-flex rounded-full bg-gray-100 p-0.5">
          {[10, 20, 50].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => set({ limit: n })}
              aria-pressed={Number(filters.limit) === n}
              className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition
                ${Number(filters.limit) === n ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AttendanceFilters;
