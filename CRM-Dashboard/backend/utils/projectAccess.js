// projectAccess.js — Who may see or work on a project: admins always; employees only when they manage it or are on its
// team (the same rule /projects/my-projects uses to list "my" projects).

export const isOnProject = (user, project) => {
  if (!user || !project) return false;
  if (user.role === 'admin') return true;
  const email = String(user.email || '').toLowerCase();
  const empId = String(user.employeeId || '').toUpperCase();
  return project.email === email
    || (project.teamMembers || []).some(m => m.empEmail === email || String(m.empId).toUpperCase() === empId);
};

export const NOT_ON_PROJECT = "You're not on this project's team.";
