// ticketMeta.js — Shared look & rules for support tickets (Support page, Raise Ticket form, Ticket drawer).
import { CircleDot, Timer, CheckCircle2, Lock, Laptop, Users, Landmark, IndianRupee, CalendarDays, HelpCircle } from "lucide-react";

export const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
export const STATUS = {
  "Open":        { label: "Open",        tone: "blue",    chip: "bg-blue-50 text-blue-700 ring-blue-200",          dot: "bg-blue-500",    Icon: CircleDot },
  "In Progress": { label: "In progress", tone: "amber",   chip: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-400",   Icon: Timer },
  "Resolved":    { label: "Resolved",    tone: "emerald", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", Icon: CheckCircle2 },
  "Closed":      { label: "Closed",      tone: "slate",   chip: "bg-gray-100 text-gray-600 ring-gray-200",         dot: "bg-gray-400",    Icon: Lock },
};

export const PRIORITIES = ["Low", "Medium", "High"];
export const PRIORITY = {
  Low:    { chip: "bg-gray-100 text-gray-600",  dot: "bg-gray-400",  hint: "Whenever someone's free" },
  Medium: { chip: "bg-amber-50 text-amber-700", dot: "bg-amber-400", hint: "Within a working day" },
  High:   { chip: "bg-rose-50 text-rose-700",   dot: "bg-rose-500",  hint: "It's blocking my work" },
};

export const CATEGORIES = ["IT Support", "HR", "Finance", "Payroll", "Leave Related", "Other"];
export const CATEGORY_ICON = {
  "IT Support":    Laptop,
  "HR":            Users,
  "Finance":       Landmark,
  "Payroll":       IndianRupee,
  "Leave Related": CalendarDays,
  "Other":         HelpCircle,
};
export const PROBLEMS = {
  "IT Support":    ["Login / Access Issue", "Software Not Working", "Hardware Problem", "Network / VPN Issue", "Email Issue", "Other IT Problem"],
  "HR":            ["Offer Letter", "Experience Letter", "Policy Clarification", "Onboarding Issue", "Other HR Query"],
  "Finance":       ["Reimbursement", "Invoice Query", "Budget Approval", "Other Finance Query"],
  "Payroll":       ["Salary Not Received", "Wrong Deduction", "Bonus / Incentive", "Tax / Form 16", "Other Payroll Issue"],
  "Leave Related": ["Leave Balance Incorrect", "Leave Not Approved", "Leave Policy Query", "Other Leave Issue"],
  "Other":         ["General Query", "Suggestion", "Feedback", "Other"],
};

// Who spoke last — "support" (an admin) or "employee" (the ticket owner). No replies yet = the employee.
export const lastFrom = (t) => {
  const r = t.replies?.[t.replies.length - 1];
  return r?.authorRole === "admin" ? "support" : "employee";
};

export const fmtDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const fmtStamp = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
