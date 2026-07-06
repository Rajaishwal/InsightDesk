import { useState, useEffect } from "react";
import { Eye, Search, Users2 } from "lucide-react";
import PrjModle from "../components/PrjModle";
import PrjTeamModle from "../components/PrjTeamModle";
import api from "../services/axios";
import { useAuth } from "../context/AuthContext";

const Projects = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamModalTitle, setTeamModalTitle] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);

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

  // Fetch projects — employees use my-projects, HR/admin use all projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const isEmployee = user?.role === "employee";
        const endpoint = isEmployee ? "/projects/my-projects" : "/projects";
        const response = await api.get(endpoint);
        if (response.data.success) {
          setProjects(response.data.projects);
        } else {
          setError("Failed to load projects");
        }
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError(err.response?.data?.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchProjects();
  }, [user]);

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


  const handleView = (project) => {
    setSelectedProject(project);
    setShowModal(true);
  };

  return (
    <div className="bg-gray-50 p-6 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* Header + Search */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">
            Projects
          </h1>

          <div className="relative w-full md:w-1/3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search by title, description, or manager..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300  shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto shadow">
          <table className="min-w-full border-gray-200 overflow-hidden">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="py-3 px-6 text-left text-sm font-semibold">
                  Project ID
                </th>
                <th className="py-3 px-6 text-left text-sm font-semibold">
                  Title
                </th>
                <th className="py-3 px-6 text-left text-sm font-semibold">
                  Description
                </th>
                <th className="py-3 px-6 text-left text-sm font-semibold">
                  Project Manager
                </th>
                <th className="py-3 px-6 text-left text-sm font-semibold">
                  Status
                </th>
                <th className="py-3 px-6 text-left text-sm font-semibold">
                  Action
                </th>
                <th className="py-3 px-6 text-left text-sm font-semibold">
                  Team Members
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="py-6 text-center text-gray-500 text-sm"
                  >
                    Loading projects...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan="6"
                    className="py-6 text-center text-red-500 text-sm"
                  >
                    {error}
                  </td>
                </tr>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <tr
                    key={project.projectId}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="py-3 px-6 text-sm text-gray-700 font-medium">
                      {project.projectId}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-700">
                      {project.title}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-600">
                      {project.description}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-700">
                      {project.manager}
                    </td>
                    <td className="py-3 px-6 text-sm">
                      <span
                        className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${
                          project.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : project.status === "Ongoing"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                        style={{ minWidth: 100 }}
                      >
                        {project.status}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm">
                      <button
                        onClick={() => handleView(project)}
                        className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg shadow-sm hover:bg-gray-800 hover:text-white cursor-pointer transition-all duration-200 ease-in-out transform hover:scale-105"
                        title="View Project Details"
                      >
                        <Eye className="w-5 h-5" />
                        <span className="font-medium">View</span>
                      </button>
                      <div className="mt-2"></div>
                    </td>
                    <td className="py-3 px-6 text-sm">
                      <button
                        onClick={() => handleTeamView(project.projectId, project.title)}
                        className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg shadow-sm hover:bg-gray-800 hover:text-white cursor-pointer transition-all duration-200 ease-in-out transform hover:scale-105"
                        title="View Team Members"
                      >
                        <Users2 className="w-5 h-5" />
                        <span className="font-medium">Show</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="7"
                    className="py-6 text-center text-gray-500 text-sm"
                  >
                    No matching projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {showTeamModal && (
          <PrjTeamModle
            teamMembers={teamMembers}
            projectTitle={teamModalTitle}
            onClose={() => setShowTeamModal(false)}
          />
        )}

        {/* Modal */}
        {showModal && (
          <PrjModle
            project={selectedProject}
            onClose={() => setShowModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Projects;
