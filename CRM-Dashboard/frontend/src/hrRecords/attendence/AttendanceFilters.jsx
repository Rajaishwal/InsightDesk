// AttendanceFilters.jsx — Toolbar for the HR attendance table: employee picker, quick date ranges,
// from/to dates and rows per page. Dates are India-time calendar days ("YYYY-MM-DD"), like the records.
import PersonPicker from "../../components/PersonPicker";

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
