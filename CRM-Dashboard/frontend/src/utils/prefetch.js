// prefetch.js — Background page-data prefetch; called from Sidebar on mount.
// Warms pageCache for all navigable pages so every first click is instant.
// Every call is fire-and-forget: all errors are swallowed silently.
import api from "../services/axios";
import { getCache, setCache } from "./pageCache";

/* ─── shared by both roles ─── */
async function prefetchPayslips(user) {
  if (getCache("payslips") || !user?.employeeId) return;
  try {
    const r = await api.get(`/salary/user/${user.employeeId}`);
    const sorted = (r.data || []).sort(
      (a, b) =>
        new Date(b.paymentDate || b.createdAt) -
        new Date(a.paymentDate || a.createdAt)
    );
    setCache("payslips", sorted);
    if (sorted.length > 0) setCache("payslips-latest", sorted[0]);
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

async function prefetchStaffWorkload() {
  if (getCache("workload-global")) return;
  try {
    const [summary, attGraph, statusSummary] = await Promise.all([
      api.get("/dashboard/summary"),
      api.get("/dashboard/attendance-count-graph"),
      api.get("/dashboard/project-status-summary"),
    ]);
    setCache("workload-global", {
      totalEmployees:      summary.data.totalEmployees,
      presentToday:        summary.data.presentToday || 0,
      totalProjects:       summary.data.totalProjects,
      attendanceRate:      summary.data.attendanceRate,
      projectProgress:     summary.data.projectProgress,
      topPerformer:        summary.data.topPerformer,
      attendanceGraph:     attGraph.data,
      projectStatusSummary: statusSummary.data,
    });
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
    const r = await api.get("/leaves/my-leaves");
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
      prefetchSalaries(),
      prefetchStaffWorkload(),
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