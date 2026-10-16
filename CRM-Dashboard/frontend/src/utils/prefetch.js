// prefetch.js — Background page-data prefetch; called from Sidebar on mount.
// Warms pageCache for all navigable pages so every first click is instant.
// Every call is fire-and-forget: all errors are swallowed silently.
import api from "../services/axios";
import { getCache, setCache } from "./pageCache";

/* ─── shared by both roles ─── */
async function prefetchPayslips(user) {
  if (getCache("payslips") || !user?.employeeId) return;
  try {
    const r = await api.get("/salary/me");
    setCache("payslips", r.data || []);
  } catch { /* silent */ }
}

/* ─── admin / HR pages ─── */
async function prefetchAdminDashboard() {
  if (getCache("admin-stats")) return;
  try {
    const r = await api.get("/users/admin-stats");
    setCache("admin-stats", r.data);
  } catch { /* silent */ }
}

async function prefetchSalaries() {
  if (getCache("salaries")) return;
  try {
    const r = await api.get("/salary");
    setCache("salaries", r.data);
  } catch { /* silent */ }
}

/* ─── employee pages ─── */
async function prefetchEmployeeDashboard() {
  if (getCache("emp-dashboard")) return;
  try {
    const r = await api.get("/users/employee-dashboard");
    setCache("emp-dashboard", r.data);
  } catch { /* silent */ }
}

async function prefetchProjects(user) {
  if (getCache("projects")) return;
  try {
    const isEmployee = user?.role === "employee";
    const endpoint = isEmployee ? "/projects/my-projects" : "/projects";
    const r = await api.get(endpoint);
    if (r.data.success) setCache("projects", r.data.projects);
  } catch { /* silent */ }
}

async function prefetchLeaves() {
  if (getCache("leaves")) return;
  try {
    const r = await api.get("/leaves/my-leaves", { params: { limit: 500 } });
    setCache("leaves", r.data.leaves || []);
  } catch { /* silent */ }
}

/* ─── main export ─── */
export async function prefetchAll(user) {
  if (!user) return;

  if (user.role === "admin" || user.role === "HR") {
    // Admin: prefetch all admin pages in parallel
    await Promise.all([
      prefetchAdminDashboard(),
      user.role === "admin" && prefetchSalaries(), // the salary list is admin-only
      prefetchPayslips(user),
    ]);
  } else {
    // Employee: prefetch all employee pages in parallel
    await Promise.all([
      prefetchEmployeeDashboard(),
      prefetchProjects(user),
      prefetchLeaves(),
      prefetchPayslips(user),
    ]);
  }
}