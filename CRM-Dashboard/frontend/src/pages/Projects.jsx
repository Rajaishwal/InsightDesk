// Projects.jsx — Project list table for employees and HR (view, task drawer, team members).
// Same columns as before (ID, title, description, manager, status, view, tracklist, team), styled like the other
// dashboard sections: light card, soft header row, status chips, pill buttons. The first 4 rows show; the rest scroll
// inside the card under a pinned header row.
import { useState, useEffect } from "react";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { Eye, Search, Users2, ListChecks, X, CheckCircle2, Timer, Hourglass, FolderOpen, AlertCircle } from "lucide-react";
import ProjectModal from "../components/ProjectModal";
import ProjectTeamModal from "../components/ProjectTeamModal";
import ProjectTaskDrawer from "../components/ProjectTaskDrawer";
import PersonAvatar from "../components/PersonAvatar";
import api from "../services/axios";
import { useAuth } from "../context/AuthContext";
import { getCache, setCache } from "../utils/pageCache";
import { useCapToFirstN, capClass, capStyle } from "../hooks/useCapToFirstN";
import Tooltip from "../components/Tooltip";

const STATUS = {
  Ongoing:   { chip: "bg-blue-50 text-blue-700 ring-blue-200",          Icon: Timer },
  Completed: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: CheckCircle2 },
  Pending:   { chip: "bg-amber-50 text-amber-700 ring-amber-200",       Icon: Hourglass },
};
const COLUMNS = ["Project ID", "Title", "Description", "Project Manager", "Status", "Action", "Tracklist", "Team Members"];

const pill = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";

const Projects = () => {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState(getCache("projects") || []);
  const [loading, setLoading] = useState(!getCache("projects"));
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamModalTitle, setTeamModalTitle] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [tracklistProject, setTracklistProject] = useState(null);

  const handleTeamView = async (projectId, projectTitle) => {
    setTeamMembers([]);
    setTeamModalTitle(projectTitle || projectId);
    setShowTeamModal(true);
    try {
      const response = await api.get(`/projects/${projectId}/team`);
      if (response.data.success) {
        setTeamMembers(response.data.teamMembers || []);
      }
    } catch (err) {
      console.error("Error fetching team members:", err);
    }
  };

  // Fetch projects — instant render from cache, loading only on true first visit
  const fetchProjects = async () => {
    const cached = !!getCache("projects");
    try {
      if (!cached) setLoading(true);
      const endpoint = isEmployee ? "/projects/my-projects" : "/projects";
      const { data } = await api.get(endpoint);
      if (data.success) {
        setProjects(data.projects);
        setCache("projects", data.projects);   // persist for next navigation
        setError("");
      } else if (!cached) setError("Failed to load projects");
    } catch (err) {
      if (!cached) setError(!err?.response ? "Can't reach the server — make sure the backend is running." : err.response.data?.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  // Use user._id — not user object — so a new object reference doesn't re-trigger
  useEffect(() => {
    if (user?._id) fetchProjects();
  }, [user?._id]);

  // Silent background refresh when tasks or projects change
  useAutoRefresh(fetchProjects, ["crm:task:updated"]);

  const filteredProjects = projects.filter((project) => {
    const search = searchTerm.toLowerCase();
    return (
      (project.projectId?.toLowerCase() || "").includes(search) ||
      (project.title?.toLowerCase() || "").includes(search) ||
      (project.description?.toLowerCase() || "").includes(search) ||
      (project.manager?.toLowerCase() || "").includes(search) ||
      (project.status?.toLowerCase() || "").includes(search)
    );
  });

  // Show the first few rows; the rest scroll (re-measured when the list changes or the window resizes)
  const SHOW = 4;
  const [tableRef, tableMaxH] = useCapToFirstN(SHOW, [filteredProjects.map((p) => p.projectId).join(","), loading], "tbody tr");

  const handleView = (project) => {
    setSelectedProject(project);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isEmployee ? "Projects you're part of — open the tracklist to log and follow your work." : "Every active project — details, tracklist and team at a glance."}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 md:w-96">
          <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, description, or manager…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-w-0 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
          />
          {searchTerm && (
            <Tooltip text="Clear search"><button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search" className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100">
              <X className="h-3.5 w-3.5" />
            </button></Tooltip>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div ref={tableRef} className={`overflow-x-auto ${capClass(tableMaxH)}`} style={capStyle(tableMaxH)}>
          <table className="min-w-full">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c} className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="animate-pulse">
                    {COLUMNS.map((c, j) => (
                      <td key={c} className="px-5 py-4"><div className={`h-3.5 rounded bg-gray-100 ${j === 2 ? "w-64" : "w-16"}`} /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-5 py-12 text-center">
                    <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
                    <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
                    <button type="button" onClick={() => { setLoading(true); fetchProjects(); }} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
                  </td>
                </tr>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((project) => {
                  const st = STATUS[project.status] || STATUS.Pending;
                  return (
                    <tr key={project.projectId} className="transition hover:bg-gray-50/70">
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-gray-500">{project.projectId}</span>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-800">{project.title}</td>
                      <td className="px-5 py-4 text-sm text-gray-500">{project.description}</td>
                      <td className="px-5 py-4">
                        {project.manager ? (
                          <span className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-700">
                            <PersonAvatar name={project.manager} size={24} />{project.manager}
                          </span>
                        ) : <span className="text-sm text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${st.chip}`}>
                          <st.Icon className="h-3.5 w-3.5" /> {project.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Tooltip text="View project details"><button type="button" onClick={() => handleView(project)}
                          className={`${pill} border border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600`}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </button></Tooltip>
                      </td>
                      <td className="px-5 py-4">
                        <Tooltip text="Open the task tracklist"><button type="button" onClick={() => setTracklistProject(project)}
                          className={`${pill} bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-600 hover:text-white hover:ring-indigo-600`}>
                          <ListChecks className="h-3.5 w-3.5" /> Tasks
                        </button></Tooltip>
                      </td>
                      <td className="px-5 py-4">
                        <Tooltip text="View team members"><button type="button" onClick={() => handleTeamView(project.projectId, project.title)}
                          className={`${pill} border border-gray-200 bg-white text-gray-600 hover:border-indigo-200 hover:text-indigo-600`}>
                          <Users2 className="h-3.5 w-3.5" /> Show
                        </button></Tooltip>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><FolderOpen className="h-6 w-6 text-gray-300" /></div>
                    <p className="mt-3 text-sm font-medium text-gray-700">{projects.length ? "No matching projects found" : "No projects yet"}</p>
                    {searchTerm && <button type="button" onClick={() => setSearchTerm("")} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Clear search</button>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && !error && filteredProjects.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{filteredProjects.length}</span> of {projects.length} {projects.length === 1 ? "project" : "projects"}
            {tableMaxH && <span className="text-gray-400"> · scroll for {filteredProjects.length - SHOW} more</span>}
          </div>
        )}
      </div>

      {tracklistProject && (
        <ProjectTaskDrawer
          project={tracklistProject}
          onClose={() => setTracklistProject(null)}
          isManager={!isEmployee}
        />
      )}

      {showTeamModal && (
        <ProjectTeamModal
          teamMembers={teamMembers}
          projectTitle={teamModalTitle}
          onClose={() => setShowTeamModal(false)}
        />
      )}

      {showModal && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default Projects;
