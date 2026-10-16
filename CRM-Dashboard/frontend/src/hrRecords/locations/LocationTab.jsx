// LocationTab.jsx — HR view of each tracked employee's current location: one full-width bar per employee with
// status (active / on break / offline), address, how fresh it is, and a Maps link.
import { useState, useEffect } from "react";
import {
  MapPin, MapPinOff, Clock, ExternalLink, RefreshCw, Trash2,
  Users, Navigation, Coffee, Moon, AlertTriangle,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import api from "../../services/axios";
import LocationFilters from "./LocationFilters";
import StatTile from "../../components/StatTile";
import PersonAvatar from "../../components/PersonAvatar";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import Tooltip from "../../components/Tooltip";

const TZ = "Asia/Kolkata";
const STALE_MINS = 35; // the tracker saves at least every 30 min while someone is checked in

const ago = (d) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.floor(s / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
};
const fullTime = (d) =>
  new Date(d).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

// Long reverse-geocoded address → a readable street line + area line
const splitAddress = (loc) => {
  const parts = (loc?.address || "").split(",").map((p) => p.trim()).filter(Boolean);
  const area = [loc?.city, loc?.state].filter(Boolean).join(", ");
  if (!parts.length) return { street: area || "Address unavailable", area: "", full: area };
  return { street: parts.slice(0, 2).join(", "), area: area || parts.slice(2, 4).join(", "), full: loc.address };
};

const STATUS = {
  active:  { label: "Active",   chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  break:   { label: "On break", chip: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500" },
  offline: { label: "Offline",  chip: "bg-gray-50 text-gray-500 ring-gray-200",          dot: "bg-gray-300" },
};
const statusOf = (emp) => (emp.attendanceStatus !== "checked-in" ? "offline" : emp.onBreak ? "break" : "active");

const FILTERS = {
  all:     { label: "All tracked employees", test: () => true },
  in:      { label: "Checked in",            test: (e) => statusOf(e) !== "offline" },
  break:   { label: "On break",              test: (e) => statusOf(e) === "break" },
  offline: { label: "Offline",               test: (e) => statusOf(e) === "offline" },
};

const EDGE = { active: "border-l-emerald-400", break: "border-l-amber-400", offline: "border-l-gray-300" };

// One employee as a full-width horizontal bar: who · current location · last update · Maps
function LocationRow({ emp }) {
  const s = statusOf(emp);
  const st = STATUS[s];
  const cur = emp.currentLocation;
  const loc = emp.latestLocationData;
  const lat = loc?.coordinates?.latitude ?? cur?.latitude;
  const lng = loc?.coordinates?.longitude ?? cur?.longitude;
  const updated = cur?.lastUpdated || emp.lastLocationUpdate;
  const minsSince = updated ? (Date.now() - new Date(updated).getTime()) / 60000 : null;
  const stale = s !== "offline" && minsSince != null && minsSince > STALE_MINS;
  const addr = splitAddress(loc);

  return (
    <div className={`overflow-hidden rounded-2xl border border-l-4 border-gray-100 ${EDGE[s]} bg-white shadow-sm transition hover:shadow-md`}>
      <div className="flex flex-col gap-4 px-5 py-4 lg:grid lg:grid-cols-[minmax(200px,1fr)_minmax(260px,1.5fr)_minmax(180px,0.9fr)_auto] lg:items-center lg:gap-6">
        {/* Who */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex-shrink-0">
            <PersonAvatar person={emp} size={42} />
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${st.dot}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-gray-900">{emp.name}</p>
              <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${st.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot} ${s === "active" ? "animate-pulse" : ""}`} />
                {st.label}
              </span>
            </div>
            <p className="truncate text-[11px] text-gray-400">{[emp.employeeId, emp.designation || emp.email].filter(Boolean).join(" · ")}</p>
          </div>
        </div>

        {/* Where */}
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50">
            <MapPin className="h-3.5 w-3.5 text-indigo-500" />
          </span>
          <div className="min-w-0">
            <Tooltip text={addr.full || undefined}><p className="truncate text-sm font-medium text-gray-800">{addr.street}</p></Tooltip>
            <p className="truncate text-xs text-gray-500">
              {addr.area}
              {lat != null && (
                <span className="font-mono text-[10.5px] text-gray-400">
                  {addr.area ? " · " : ""}{Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
                  {loc?.accuracy ? ` · ±${Math.round(loc.accuracy)} m` : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* When */}
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${stale ? "bg-amber-50" : "bg-gray-50"}`}>
            {stale ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <Clock className="h-3.5 w-3.5 text-gray-400" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-gray-700">
              {updated ? <>Updated <Tooltip text={fullTime(updated)}><span className="font-semibold">{ago(updated)}</span></Tooltip></> : "Never updated"}
            </p>
            <Tooltip text={stale ? "Checked in, but no location update — their tab may be closed or location turned off" : undefined}><p className={`truncate text-[11px] ${stale ? "text-amber-600" : "text-gray-400"}`}>
              {stale ? "Tab closed or location off?" : s === "offline" ? "last known location" : updated ? fullTime(updated) : ""}
            </p></Tooltip>
          </div>
        </div>

        {/* Action */}
        <div className="flex items-center lg:justify-end">
          {lat != null && (
            <a href={mapsLink(lat, lng)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-600 hover:text-white">
              <Navigation className="h-3.5 w-3.5" /> Open in Maps <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return Array.from({ length: 3 }, (_, i) => (
    <div key={i} className="flex animate-pulse items-center gap-6 rounded-2xl border border-l-4 border-gray-100 border-l-gray-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex w-56 items-center gap-3"><div className="h-10 w-10 rounded-full bg-gray-100" /><div className="h-3.5 w-28 rounded bg-gray-100" /></div>
      <div className="h-3.5 flex-1 rounded bg-gray-100" />
      <div className="h-3.5 w-36 rounded bg-gray-100" />
      <div className="h-7 w-28 rounded-full bg-gray-100" />
    </div>
  ));
}

const LocationTab = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ searchTerm: "", sortBy: "lastUpdated" });
  const [view, setView] = useState("all");

  const fetchLocations = async ({ silent = false } = {}) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const { data } = await api.get("/location/all-employees");
      if (!data.success) throw new Error(data.message);
      setEmployees(data.employees || []);
      setError(null);
    } catch (err) {
      const msg = !err?.response && err?.request ? "Can't reach the server — make sure the backend is running."
        : err?.response?.status === 403 ? "You don't have permission to view employee locations."
        : "Couldn't load employee locations.";
      // Keep showing the last good data on a failed background refresh
      if (!silent || !employees.length) setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load, then refresh quietly every 30s and whenever someone checks in / out / takes a break
  useEffect(() => {
    fetchLocations();
    const id = setInterval(() => fetchLocations({ silent: true }), 30000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresh(() => fetchLocations({ silent: true }), ["crm:attendance:updated"]);

  const clearInactive = async () => {
    const ok = await confirm({
      title: "Clear location data of offline employees?",
      message: "This deletes the saved location of everyone who isn't checked in right now, so they drop off this list. Checked-in employees aren't affected. This can't be undone.",
      confirmText: "Clear data",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const { data } = await api.delete("/location/clear-inactive");
      if (!data.success) throw new Error(data.message);
      toast.success(`Cleared ${data.deletedCount} location records from ${data.clearedUsers} ${data.clearedUsers === 1 ? "employee" : "employees"}.`);
      fetchLocations({ silent: true });
    } catch (err) {
      toast.error("Couldn't clear location data: " + (err?.response?.data?.message || err.message));
    }
  };

  const counts = Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, employees.filter(f.test).length]));
  const term = filters.searchTerm.trim().toLowerCase();
  const visible = employees
    .filter(FILTERS[view].test)
    .filter((e) => !term || [e.name, e.email, e.employeeId].some((v) => (v || "").toLowerCase().includes(term)))
    .sort((a, b) =>
      filters.sortBy === "name"
        ? (a.name || "").localeCompare(b.name || "")
        : new Date(b.currentLocation?.lastUpdated || 0) - new Date(a.currentLocation?.lastUpdated || 0)
    );
  const pick = (k) => setView((v) => (v === k && k !== "all" ? "all" : k));

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Employee locations</h2>
          <p className="mt-0.5 text-sm text-gray-500">Where each employee was last seen while checked in · updates every 30 seconds.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => fetchLocations({ silent: true })} disabled={refreshing}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={clearInactive} disabled={loading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:opacity-60">
            <Trash2 className="h-3.5 w-3.5" /> Clear offline data
          </button>
        </div>
      </div>

      {/* Summary tiles (click to filter) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile tone="violet" Icon={Users} label="Tracked" value={loading ? "—" : counts.all}
          sub="employees with a saved location" active={view === "all"} onClick={() => pick("all")} />
        <StatTile tone="emerald" Icon={Navigation} label="Checked in" value={loading ? "—" : counts.in}
          sub="location being tracked now" active={view === "in"} onClick={() => pick("in")} />
        <StatTile tone="amber" Icon={Coffee} label="On break" value={loading ? "—" : counts.break}
          sub="checked in, on a break" active={view === "break"} onClick={() => pick("break")} />
        <StatTile tone="slate" Icon={Moon} label="Offline" value={loading ? "—" : counts.offline}
          sub="showing last known location" active={view === "offline"} onClick={() => pick("offline")} />
      </div>

      <LocationFilters filters={filters} setFilters={setFilters} />

      {/* Cards */}
      {error && !employees.length ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center shadow-sm">
          <MapPinOff className="mx-auto h-8 w-8 text-red-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
          <button type="button" onClick={() => fetchLocations()} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
        </div>
      ) : loading ? (
        <div className="space-y-3"><SkeletonRows /></div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-5 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
            <MapPinOff className="h-6 w-6 text-gray-300" />
          </div>
          {employees.length === 0 ? (
            <>
              <p className="mt-3 text-sm font-medium text-gray-700">No locations yet</p>
              <p className="mt-0.5 text-xs text-gray-400">Employees appear here once they check in with location access allowed.</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-medium text-gray-700">No one matches</p>
              <button type="button" onClick={() => { setView("all"); setFilters((f) => ({ ...f, searchTerm: "" })); }}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Show everyone</button>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            {FILTERS[view].label} · <span className="font-semibold text-gray-600">{visible.length}</span>
          </p>
          <div className="space-y-3">
            {visible.map((emp) => (
              <LocationRow key={emp._id} emp={emp} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LocationTab;
