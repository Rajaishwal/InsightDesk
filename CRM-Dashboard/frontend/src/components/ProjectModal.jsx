// ProjectModal.jsx — "Project details" pop-up: ID + status, title, description, manager (with email),
// skills and tools as chips, team size. Footer: Close + Contact manager (Gmail compose) — or, for HR, Team members.
// Esc or a click outside closes it.
import { useEffect, useState } from "react";
import { X, FolderKanban, Mail, Users2, CheckCircle2, Timer, Hourglass, Sparkles, Wrench, CalendarDays } from "lucide-react";
import ProjectTeamModal from "./ProjectTeamModal";
import PersonAvatar from "./PersonAvatar";

const STATUS = {
  Ongoing:   { chip: "bg-blue-50 text-blue-700 ring-blue-200",          Icon: Timer },
  Completed: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: CheckCircle2 },
  Pending:   { chip: "bg-amber-50 text-amber-700 ring-amber-200",       Icon: Hourglass },
};

// Skills / tools are stored as a list, but older projects keep them as one comma-separated string — split either way
const toList = (v) => [...new Set((Array.isArray(v) ? v : [v]).flatMap((s) => String(s ?? "").split(",")).map((s) => s.trim().replace(/\.$/, "")).filter(Boolean))];

function Section({ Icon, label, children }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {Icon && <Icon className="h-3.5 w-3.5" />}{label}
      </p>
      {children}
    </div>
  );
}

const ProjectModal = ({ project, onClose, isHrView = false }) => {
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  // Esc closes (the team list on top closes first)
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !showTeamModal) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showTeamModal]);

  if (!project) return null;

  const st = STATUS[project.status] || STATUS.Pending;
  const skills = toList(project.skills ?? project.Skill);
  const tools = toList(project.tools ?? project.tool);
  const teamCount = project.teamMembers?.length || 0;
  const started = project.createdAt ? new Date(project.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;

  const handleTeamView = () => {
    setTeamMembers(project.teamMembers || []);
    setShowTeamModal(true);
  };

  const handleContact = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      project.email
    )}&su=${encodeURIComponent(
      `Regarding Project: ${project.title}`
    )}&body=${encodeURIComponent(
      `Hello ${project.manager},\n\nI would like to discuss about the project.`
    )}`;
    window.open(gmailUrl, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Project ${project.projectId}`}
        className="animate-dialog-in flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="h-1 flex-shrink-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50">
            <FolderKanban className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-gray-500">{project.projectId}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${st.chip}`}>
                <st.Icon className="h-3 w-3" /> {project.status}
              </span>
            </div>
            <h2 className="mt-1.5 text-lg font-bold leading-snug text-gray-900">{project.title}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
              {started && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-gray-400" /> Started {started}</span>}
              {teamCount > 0 && <span className="inline-flex items-center gap-1"><Users2 className="h-3.5 w-3.5 text-gray-400" /> {teamCount} {teamCount === 1 ? "member" : "members"}</span>}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="-mr-1 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
          <Section label="Description">
            <p className="text-sm leading-relaxed text-gray-700">{project.description || <span className="text-gray-400">No description.</span>}</p>
          </Section>

          <Section label="Project manager">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3.5 py-3 ring-1 ring-gray-100">
              <PersonAvatar name={project.manager} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800">{project.manager || "—"}</p>
                {project.email && (
                  <a href={`mailto:${project.email}`} className="truncate text-xs text-indigo-600 hover:underline">{project.email}</a>
                )}
              </div>
            </div>
          </Section>

          <Section Icon={Sparkles} label="Skills">
            {skills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => <span key={s} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">{s}</span>)}
              </div>
            ) : <p className="text-sm text-gray-400">None listed.</p>}
          </Section>

          <Section Icon={Wrench} label="Tools">
            {tools.length ? (
              <div className="flex flex-wrap gap-1.5">
                {tools.map((t) => <span key={t} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200">{t}</span>)}
              </div>
            ) : <p className="text-sm text-gray-400">None listed.</p>}
          </Section>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">
            Close
          </button>
          {isHrView ? (
            <button type="button" onClick={handleTeamView}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-900">
              <Users2 className="h-4 w-4" /> Team members
            </button>
          ) : (
            <button type="button" onClick={handleContact} disabled={!project.email}
              title={project.email ? `Email ${project.manager}` : "No email for this manager"}
              className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:opacity-50">
              <Mail className="h-4 w-4" /> Contact manager
            </button>
          )}
        </div>
      </div>

      {showTeamModal && (
        <ProjectTeamModal
          teamMembers={teamMembers}
          onClose={() => setShowTeamModal(false)}
        />
      )}
    </div>
  );
};

export default ProjectModal;
