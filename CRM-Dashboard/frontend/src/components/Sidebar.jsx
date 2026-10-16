// Sidebar.jsx — Left navigation sidebar with role-based menu links.
// "Payslips & Salary" shows a count of paid salaries you still need to confirm you received (refreshes live).
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { prefetchAll } from "../utils/prefetch";
import api from "../services/axios";
import {
  LayoutDashboard, Users, FolderOpen,
  CalendarCheck2, BarChart,
  IndianRupeeIcon, User2Icon, FolderCheck,
  UserRoundCogIcon,
} from "lucide-react";
import Tooltip from "./Tooltip";

const Sidebar = () => {
  const { user } = useAuth();

  // Warm pageCache for all navigable pages the moment the user logs in.
  useEffect(() => {
    if (user?._id) prefetchAll(user);
  }, [user?._id]);

  // Paid salaries of mine that I haven't confirmed (or reported) yet
  const [toConfirm, setToConfirm] = useState(0);
  useEffect(() => {
    if (!user?.employeeId) return;
    const load = () => api.get("/salary/me")
      .then((r) => setToConfirm((r.data || []).filter((s) => s.status === "Paid" && !s.receipt?.status).length))
      .catch(() => {});
    load();
    const onUpdate = (e) => { if (!e.detail?.employeeId || e.detail.employeeId === user.employeeId) load(); };
    window.addEventListener("crm:salary:updated", onUpdate);
    return () => window.removeEventListener("crm:salary:updated", onUpdate);
  }, [user?.employeeId]);

  const userProfileImage = user?.photo || null;
  const userName = user?.name || "User";

  // Sidebar menus based on role
  const adminLinks = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/profile", label: "Profile", icon: User2Icon },
    { to: "/hr", label: "Employee Record", icon: Users },
    { to: "/hrproject", label: "Employee Project", icon: FolderCheck },
    { to: "/salary", label: "Employee Salary", icon: UserRoundCogIcon },
    { to: "/payslip", label: "Payslips & Salary", icon: IndianRupeeIcon },
    { to: "/support", label: "Support", icon: BarChart },
  ];

  const employeeLinks = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/profile", label: "Profile", icon: User2Icon },
    { to: "/projects", label: "Project", icon: FolderOpen },
    { to: "/timesheet", label: "Leave Management", icon: CalendarCheck2 },
    { to: "/payslip", label: "Payslips & Salary", icon: IndianRupeeIcon },
    { to: "/support", label: "Support", icon: BarChart },
  ];

  const links = user?.role === "admin" ? adminLinks : employeeLinks;

  return (
    <div>
      {user ? (
        <aside className="w-64 bg-indigo-600 h-full py-4 pl-4 flex flex-col">
          <ul className="space-y-1 w-full">

            {/* User Info Card */}
            <li className="flex items-center gap-3 mb-5 bg-white p-3 mr-3 rounded-2xl">
              {userProfileImage ? (
                <img
                  src={userProfileImage}
                  alt={userName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-lg">
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-indigo-700 font-semibold text-sm">
                Hi, {user.name || "User"}
              </span>
            </li>

            {/* Menu Links — sliding pill via Framer Motion layoutId */}
            {links.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 pl-4 pr-4 py-2.5 rounded-l-full text-[15px] font-medium transition-colors
                    ${isActive
                      ? "text-indigo-700 font-semibold"
                      : "text-white/80 hover:text-white"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Sliding white pill — animates position between items */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-pill"
                          className="absolute inset-0 bg-white rounded-l-full shadow-sm"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}

                      {/* Hover background for inactive items */}
                      {!isActive && (
                        <span className="absolute inset-0 rounded-l-full bg-white/0 hover:bg-white/15 transition-colors duration-150" />
                      )}

                      {/* Icon + label sit above the animated background */}
                      <Icon size={20} className="relative z-10 shrink-0" />
                      <span className="relative z-10">{label}</span>
                      {to === "/payslip" && toConfirm > 0 && (
                        <Tooltip text={`${toConfirm} paid ${toConfirm === 1 ? "salary" : "salaries"} to confirm`}><span
                          className="relative z-10 ml-auto mr-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-white shadow-sm">
                          {toConfirm}
                        </span></Tooltip>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
};

export default Sidebar;