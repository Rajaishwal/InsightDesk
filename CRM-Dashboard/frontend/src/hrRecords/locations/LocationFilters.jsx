// LocationFilters.jsx — Search (name, email, employee ID) and sort for the HR locations view.
import { Search, X } from "lucide-react";

const SORTS = [
  { id: "lastUpdated", label: "Latest" },
  { id: "name",        label: "Name" },
];

const LocationFilters = ({ filters, setFilters }) => (
  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
    <div className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
      <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
      <input
        type="text"
        placeholder="Search by name, email or employee ID…"
        value={filters.searchTerm}
        onChange={(e) => setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))}
        className="w-full min-w-0 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
      />
      {filters.searchTerm && (
        <button type="button" onClick={() => setFilters((prev) => ({ ...prev, searchTerm: "" }))} aria-label="Clear search"
          className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>

    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sort</span>
      <div className="inline-flex rounded-full bg-gray-100 p-0.5">
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={filters.sortBy === s.id}
            onClick={() => setFilters((prev) => ({ ...prev, sortBy: s.id }))}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition
              ${filters.sortBy === s.id ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default LocationFilters;
