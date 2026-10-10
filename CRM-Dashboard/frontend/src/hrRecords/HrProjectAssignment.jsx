// HrProjectAssignment.jsx — HR/Admin page: all projects with their manager, team, status and task progress.
// Summary tiles double as filters; search matches project text or picks a person to see only their projects.
import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Eye, Search, X, ListChecks, Lock, ChevronDown, Check, Plus, Briefcase, Activity,
  ClipboardCheck, CheckCircle2, RefreshCw, SearchX, AlertCircle,
} from "lucide-react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import Avatar from "../components/PersonAvatar";
import StatTile from "../components/StatTile";
import ProjectModal from "../components/ProjectModal";
import ProjectTaskDrawer from "../components/ProjectTaskDrawer";
import ProjectActivityFeed from "../components/ProjectActivityFeed";
import AddProject from "./AddProject";
import axios from "../services/axios";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";

// Overlapping avatars of the team (first 3, then +n)
function TeamStack({ members }) {
  if (!members.length) return <span className="text-xs text-gray-400">No team yet</span>;
  return (
    <div className="flex items-center gap-2" title={members.map((m) => m.name).join(", ")}>
      <div className="flex -space-x-2">
        {members.slice(0, 3).map((m) => <Avatar key={m.key} person={m.person} name={m.name} size={28} />)}
        {members.length > 3 && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 ring-2 ring-white">
            +{members.length - 3}
          </span>
        )}
      </div>
      <span className="whitespace-nowrap text-[11px] text-gray-400">{members.length} {members.length === 1 ? "member" : "members"}</span>
    </div>
  );
}

// Tasks done out of total, a segmented bar (done / active / pending) and what's still open
function TaskProgress({ stats }) {
  if (!stats?.total) return <span className="text-xs text-gray-400">No tasks yet</span>;
  const { total, completed, ongoing, pending } = stats;
  const pct = (n) => (n / total) * 100;
  return (
    <div className="w-40">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-gray-700">
          {completed}/{total} <span className="font-normal text-gray-400">tasks done</span>
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-gray-500">{Math.round(pct(completed))}%</span>
      </div>
      <div className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-gray-100">
        {completed > 0 && <div className="rounded-full bg-emerald-500" style={{ width: `${pct(completed)}%` }} />}
        {ongoing > 0 && <div className="rounded-full bg-indigo-400" style={{ width: `${pct(ongoing)}%` }} />}
        {pending > 0 && <div className="rounded-full bg-amber-300" style={{ width: `${pct(pending)}%` }} />}
      </div>
      {(ongoing > 0 || pending > 0) && (
        <div className="mt-1 flex gap-2.5 text-[10px] text-gray-400">
          {ongoing > 0 && <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-indigo-400" />{ongoing} active</span>}
          {pending > 0 && <span className="inline-flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full bg-amber-300" />{pending} pending</span>}
        </div>
      )}
    </div>
  );
}

// Table placeholder rows while the first load runs
function SkeletonRows() {
  return Array.from({ length: 4 }, (_, i) => (
    <tr key={i} className="animate-pulse">
      <td className="px-5 py-4"><div className="h-3.5 w-44 rounded bg-gray-100" /><div className="mt-2 h-3 w-64 rounded bg-gray-100" /></td>
      <td className="px-4 py-4"><div className="h-7 w-24 rounded-full bg-gray-100" /></td>
      <td className="px-4 py-4"><div className="h-7 w-20 rounded-full bg-gray-100" /></td>
      <td className="px-4 py-4"><div className="h-6 w-24 rounded-full bg-gray-100" /></td>
      <td className="px-4 py-4"><div className="h-2 w-40 rounded-full bg-gray-100" /></td>
      <td className="px-5 py-4"><div className="ml-auto h-7 w-24 rounded-full bg-gray-100" /></td>
    </tr>
  ));
}

const STATUS_META = {
  Pending:   { dot: "bg-amber-400",   text: "text-amber-600",   pill: "border-amber-300 bg-amber-50 text-amber-700",       note: "Not started yet" },
  Ongoing:   { dot: "bg-blue-500",    text: "text-blue-600",    pill: "border-blue-300 bg-blue-50 text-blue-700",          note: "Work in progress" },
  Completed: { dot: "bg-emerald-500", text: "text-emerald-600", pill: "border-emerald-300 bg-emerald-50 text-emerald-700", note: "Close and lock the project" },
};
const MENU_W = 216;
const MENU_H = 200; // approx — used to open upward near the bottom of the screen

// One row in the status menu
function StatusOption({ status, selected, disabled, note, onPick, children }) {
  const m = STATUS_META[status];
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => onPick(status)}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition focus:outline-none
        ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-50 focus-visible:bg-gray-50"}
        ${selected ? "bg-gray-50" : ""}`}
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${disabled ? "bg-gray-300" : m.dot}`} />
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] font-semibold leading-tight ${disabled ? "text-gray-400" : selected ? m.text : "text-gray-800"}`}>{status}</span>
        <span className="block text-[10.5px] leading-snug text-gray-400">{note ?? m.note}</span>
        {children}
      </span>
      {selected && <Check className={`h-3.5 w-3.5 flex-shrink-0 ${m.text}`} />}
      {status === "Completed" && <Lock className={`h-3 w-3 flex-shrink-0 ${disabled ? "text-gray-300" : "text-emerald-500"}`} />}
    </button>
  );
}

// Project status: "Completed" unlocks only once the team has completed every task in the tracklist,
// and once a project is marked Completed its status is locked (the server enforces both rules too).
function ProjectStatusCell({ project, stats, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState(null);
  const btnRef  = useRef(null);
  const menuRef = useRef(null);

  // Close on outside click, Esc, scroll or resize; focus the current option when it opens
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector('[aria-selected="true"]')?.focus();
    const close = () => setOpen(false);
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => { if (e.key === "Escape") { close(); btnRef.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (project.status === "Completed") {
    return (
      <span
        title="Completed projects are locked"
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_META.Completed.pill}`}
      >
        <Lock className="h-3 w-3" /> Completed
      </span>
    );
  }

  const meta    = STATUS_META[project.status] || STATUS_META.Pending;
  const total   = stats?.total || 0;
  const done    = stats?.completed || 0;
  const allDone = total > 0 && done === total;

  const toggle = () => {
    if (open) return setOpen(false);
    // The menu floats in a portal (the table's scroll box would clip it); open upward if there's no room below
    const r  = btnRef.current.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < MENU_H + 12;
    setPos({
      left:   Math.max(8, Math.min(r.left, window.innerWidth - MENU_W - 8)),
      top:    up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
    });
    setOpen(true);
  };

  const pick = (status) => {
    setOpen(false);
    if (status !== project.status) onChange(project, status);
  };

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition cursor-pointer
          hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${meta.pill}`}
        style={{ minWidth: 104 }}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {project.status}
        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {allDone && <p className="mt-1 text-[10px] font-semibold text-emerald-600">All tasks done · ready to complete</p>}

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={`Status of ${project.title}`}
          className="animate-dialog-in fixed z-[60] rounded-xl border border-gray-100 bg-white p-1 shadow-lg shadow-gray-900/10"
          style={{ width: MENU_W, left: pos.left, top: pos.top, bottom: pos.bottom }}
        >
          <p className="px-2 pb-0.5 pt-1 text-[9px] font-bold uppercase tracking-widest text-gray-400">Set status</p>
          <StatusOption status="Pending" selected={project.status === "Pending"} onPick={pick} />
          <StatusOption status="Ongoing" selected={project.status === "Ongoing"} onPick={pick} />
          <div className="mx-2 my-0.5 h-px bg-gray-100" />
          <StatusOption
            status="Completed"
            selected={false}
            disabled={!allDone}
            onPick={pick}
            note={allDone ? undefined : total === 0 ? "No tasks yet — nothing to complete" : `${total - done} of ${total} tasks still open`}
          >
            {!allDone && total > 0 && (
              <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-gray-100">
                <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${Math.round((done / total) * 100)}%` }} />
              </span>
            )}
          </StatusOption>
        </div>,
        document.body
      )}
    </div>
  );
}

// Summary tiles / filters. "Ready" = every task done, waiting for HR/admin to mark it Completed.
const FILTERS = {
  all:       { label: "All projects",      test: () => true },
  active:    { label: "In progress",       test: (p) => p.status !== "Completed" },
  ready:     { label: "Ready to complete", test: (p) => p.ready },
  completed: { label: "Completed",         test: (p) => p.status === "Completed" },
};

const HrProjectAssignment = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [projects, setProjects] = useState([]);
  const [taskStats, setTaskStats] = useState({});
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [person, setPerson] = useState(null);           // picked from the search suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [viewProject, setViewProject] = useState(null);
  const [showProjectAdd, setShowProjectAdd] = useState(false);
  const [tracklistProject, setTracklistProject] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
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

  // Projects (incl. ones with no team yet), task counts per project, and people for names/photos
  const fetchData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [projectsRes, statsRes, usersRes] = await Promise.all([
        axios.get("/projects", { params: { limit: 500 } }),
        axios.get("/project-tasks/stats/all"),
        axios.get("/users").catch(() => ({ data: [] })), // only for names & photos — the page works without it
      ]);
      setProjects(projectsRes.data.projects || []);
      setTaskStats(statsRes.data || {});
      setPeople(Array.isArray(usersRes.data) ? usersRes.data : []);
    } catch (err) {
      setError(!err?.response ? "Can't reach the server — make sure the backend is running." : "Couldn't load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  // Task progress changes elsewhere (tracklist, other users) → refresh quietly
  useAutoRefresh(() => fetchData({ silent: true }), ["crm:task:updated"]);

  const changeStatus = async (project, newStatus) => {
    if (newStatus === "Completed") {
      const ok = await confirm({
        title: "Mark project as completed?",
        message: `${project.title} (${project.projectId}) will be closed. Its status is locked after this and no new tasks can be added.`,
        confirmText: "Mark completed",
        tone: "success",
      });
      if (!ok) return;
    }
    try {
      await axios.put(`http://localhost:5000/api/projects/${project.projectId}`, { status: newStatus });
      if (newStatus === "Completed") toast.success(`${project.title} marked as completed.`);
      fetchData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  // Enrich projects: manager & team as people, and whether every task is done
  const rows = useMemo(() => {
    const byEmpId = {}, byEmail = {};
    people.forEach((u) => {
      if (u.employeeId) byEmpId[u.employeeId] = u;
      if (u.email) byEmail[u.email.toLowerCase()] = u;
    });
    const rank = (p) => (p.ready ? 0 : p.status !== "Completed" ? 1 : 2); // needs sign-off → in progress → completed
    return projects
      .map((p) => {
        const s = taskStats[p.projectId];
        const members = (p.teamMembers || []).map((m) => {
          const who = byEmpId[m.empId] || byEmail[(m.empEmail || "").toLowerCase()];
          return { key: m._id || m.empId, person: who, name: who?.name || m.empId };
        });
        return {
          ...p,
          ready: p.status !== "Completed" && s?.total > 0 && s.completed === s.total,
          managerPerson: byEmail[(p.email || "").toLowerCase()] || people.find((u) => u.name === p.manager),
          members,
        };
      })
      .sort((a, b) => rank(a) - rank(b) || a.projectId.localeCompare(b.projectId, undefined, { numeric: true }));
  }, [projects, taskStats, people]);

  const involves = (row, who) => row.managerPerson?._id === who._id || row.members.some((m) => m.person?._id === who._id);

  const q = searchTerm.trim().toLowerCase();
  const visible = rows
    .filter((r) => FILTERS[filter].test(r))
    .filter((r) => !person || involves(r, person))
    .filter((r) => !q || [r.projectId, r.title, r.description, r.manager, r.status, ...r.members.map((m) => m.name)]
      .some((v) => (v || "").toLowerCase().includes(q)));

  // People whose name matches the search and who are on at least one project
  const suggestions = q
    ? people
        .filter((u) => u.name?.toLowerCase().includes(q) && u._id !== person?._id)
        .map((u) => ({ u, count: rows.filter((r) => involves(r, u)).length }))
        .filter((x) => x.count > 0)
        .slice(0, 6)
    : [];

  const counts = Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, rows.filter(f.test).length]));
  const totalTasks = rows.reduce((n, r) => n + (taskStats[r.projectId]?.total || 0), 0); // listed projects only
  const filtersActive = filter !== "all" || !!person || !!q;
  const clearFilters = () => { setFilter("all"); setPerson(null); setSearchTerm(""); };

  const pickPerson = (u) => { setPerson(u); setSearchTerm(""); setShowSuggestions(false); };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* ── Header: title, search, new project ── */}
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Projects</h1>
          <p className="mt-1 text-sm text-gray-500">Follow each project's tasks and close it once the team has finished.</p>
        </div>

        <div className="flex w-full items-center gap-3 md:w-auto">
          <div className="relative w-full md:w-80" ref={wrapperRef}>
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
              <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
              {person && (
                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-0.5 pr-1.5 text-xs font-semibold text-indigo-700">
                  <Avatar person={person} size={20} />
                  {person.name.split(" ")[0]}
                  <button type="button" onClick={() => setPerson(null)} aria-label={`Stop filtering by ${person.name}`} className="rounded-full p-0.5 hover:bg-indigo-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              <input
                type="text"
                placeholder={person ? "Search their projects…" : "Search projects or people…"}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full min-w-0 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search" className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* People suggestions — pick one to see only their projects */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="animate-dialog-in absolute right-0 z-50 mt-2 w-full overflow-hidden rounded-xl border border-gray-100 bg-white p-1 shadow-lg shadow-gray-900/10">
                <p className="px-2.5 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400">People</p>
                {suggestions.map(({ u, count }) => (
                  <button
                    key={u._id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickPerson(u); }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-gray-50"
                  >
                    <Avatar person={u} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-800">{highlightMatch(u.name, searchTerm)}</span>
                      <span className="block truncate text-[11px] text-gray-400">{u.designation || u.role}</span>
                    </span>
                    <span className="flex-shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                      {count} {count === 1 ? "project" : "projects"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowProjectAdd(true)}
            className="inline-flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-gray-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900"
          >
            <Plus className="h-4 w-4" /> New project
          </button>
        </div>
      </div>

      {/* ── Summary tiles (click to filter) ── */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile tone="violet" Icon={Briefcase} label="All projects" value={loading ? "—" : counts.all}
          sub={`${totalTasks} tasks across all projects`} active={filter === "all"} onClick={() => setFilter("all")} />
        <StatTile tone="blue" Icon={Activity} label="In progress" value={loading ? "—" : counts.active}
          sub="the team is still working" active={filter === "active"} onClick={() => setFilter(filter === "active" ? "all" : "active")} />
        <StatTile tone="amber" Icon={ClipboardCheck} label="Ready to complete" value={loading ? "—" : counts.ready}
          sub={counts.ready ? "every task done · needs your sign-off" : "nothing waiting for sign-off"}
          active={filter === "ready"} onClick={() => setFilter(filter === "ready" ? "all" : "ready")} />
        <StatTile tone="emerald" Icon={CheckCircle2} label="Completed" value={loading ? "—" : counts.completed}
          sub="closed and locked" active={filter === "completed"} onClick={() => setFilter(filter === "completed" ? "all" : "completed")} />
      </div>

      {/* ── Projects table ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-800">{FILTERS[filter].label}</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">{loading ? "…" : visible.length}</span>
            {person && <span className="truncate text-xs text-gray-400">· with {person.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>
            )}
            <button type="button" onClick={() => fetchData({ silent: true })} title="Refresh" aria-label="Refresh"
              className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead className="bg-gray-50/80">
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <th className="px-5 py-3">Project</th>
                <th className="px-4 py-3">Manager</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Task progress</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <SkeletonRows />
              ) : error ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
                    <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
                    <button type="button" onClick={() => fetchData()} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
                      <SearchX className="h-6 w-6 text-gray-300" />
                    </div>
                    {rows.length === 0 ? (
                      <>
                        <p className="mt-3 text-sm font-medium text-gray-700">No projects yet</p>
                        <button type="button" onClick={() => setShowProjectAdd(true)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Create the first project</button>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 text-sm font-medium text-gray-700">No projects match</p>
                        <p className="mt-0.5 text-xs text-gray-400">Try another search, or clear the filters.</p>
                        <button type="button" onClick={clearFilters} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                visible.map((p) => (
                  <tr key={p._id} className="transition hover:bg-gray-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-500">{p.projectId}</span>
                        <span className="text-sm font-semibold text-gray-800">{p.title}</span>
                      </div>
                      {p.description && (
                        <p className="mt-1 max-w-md text-xs leading-relaxed text-gray-500 line-clamp-2" title={p.description}>{p.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar person={p.managerPerson} name={p.manager} size={28} />
                        <span className="whitespace-nowrap text-sm text-gray-700">{p.manager || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4"><TeamStack members={p.members} /></td>
                    <td className="px-4 py-4">
                      <ProjectStatusCell project={p} stats={taskStats[p.projectId]} onChange={changeStatus} />
                    </td>
                    <td className="px-4 py-4"><TaskProgress stats={taskStats[p.projectId]} /></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTracklistProject(p)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-600 hover:text-white"
                          title="Open the task tracklist"
                        >
                          <ListChecks className="h-3.5 w-3.5" /> Tasks
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewProject(p)}
                          className="cursor-pointer rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-indigo-600"
                          title="View project details"
                          aria-label={`View ${p.title}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity Feed */}
      <ProjectActivityFeed />

      {showProjectAdd && (
        <AddProject
          onClose={() => setShowProjectAdd(false)}
          onSave={(created) => { toast.success(`${created?.title || "Project"} created.`); fetchData({ silent: true }); }}
        />
      )}

      {/* Tracklist drawer */}
      {tracklistProject && (
        <ProjectTaskDrawer
          project={tracklistProject}
          onClose={() => setTracklistProject(null)}
          isManager={true}
        />
      )}

      {/* Project details */}
      {viewProject && (
        <ProjectModal
          project={viewProject}
          onClose={() => setViewProject(null)}
          isHrView={true}
        />
      )}
    </div>
  );
};

export default HrProjectAssignment;