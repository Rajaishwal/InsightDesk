// leaveTypes.js — The four leave types with their yearly / monthly accrual rules and colours, plus normalizeType()
// for older leave-type names. Shared by the leave donut chart, Leave Management and the Employee Report.

export const LEAVE_TYPES = [
  { key: "Planned Leave",         abbr: "PL",   yearly: 24, monthly: 2, color: "#6366f1", light: "#c7d2fe" },
  { key: "Wellness Leave",        abbr: "WL",   yearly: 12, monthly: 0, color: "#10b981", light: "#6ee7b7" },
  { key: "Polling Leave",         abbr: "PolL", yearly: 1,  monthly: 0, color: "#f59e0b", light: "#fde68a" },
  { key: "Unplanned Leave (LOP)", abbr: "LOP",  yearly: 12, monthly: 1, color: "#ef4444", light: "#fca5a5" },
];

export const LEAVE_TYPE_KEYS = LEAVE_TYPES.map((t) => t.key);

// Older requests used other names — count them under today's four types
export const normalizeType = (lt) => ({
  "Sick Leave":      "Wellness Leave",
  "Casual Leave":    "Planned Leave",
  "Annual Leave":    "Planned Leave",
  "Maternity Leave": "Planned Leave",
  "Paternity Leave": "Planned Leave",
  "Emergency Leave": "Unplanned Leave (LOP)",
  "Other":           "Unplanned Leave (LOP)",
}[lt] || lt);
