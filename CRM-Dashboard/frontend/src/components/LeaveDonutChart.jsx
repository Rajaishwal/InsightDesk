import { useMemo, useState } from "react";

const TYPES = [
  { key: "Planned Leave",         abbr: "PL",   yearly: 24, monthly: 2, color: "#6366f1", light: "#c7d2fe" },
  { key: "Wellness Leave",        abbr: "WL",   yearly: 12, monthly: 0, color: "#10b981", light: "#6ee7b7" },
  { key: "Polling Leave",         abbr: "PolL", yearly: 1,  monthly: 0, color: "#f59e0b", light: "#fde68a" },
  { key: "Unplanned Leave (LOP)", abbr: "LOP",  yearly: 12, monthly: 1, color: "#ef4444", light: "#fca5a5" },
];

export const LEAVE_TYPE_KEYS = TYPES.map(t => t.key);

const SIZE  = 180;
const THICK = 20;
const R     = (SIZE - THICK) / 2;   // 80  — outer ring edge = SIZE/2 = 90, inner = 70
const CX    = SIZE / 2;
const CY    = SIZE / 2;
const CIRC  = 2 * Math.PI * R;
const GAP   = -12; // badge overlaps the ring edge

const normalizeType = (lt) => ({
  "Sick Leave":      "Wellness Leave",
  "Casual Leave":    "Planned Leave",
  "Annual Leave":    "Planned Leave",
  "Maternity Leave": "Planned Leave",
  "Paternity Leave": "Planned Leave",
  "Emergency Leave": "Unplanned Leave (LOP)",
  "Other":           "Unplanned Leave (LOP)",
}[lt] || lt);

// Horizontal pill badge — one line: accent | LABEL   value
function Badge({ label, value, color, visible, delay, placement }) {
  // placement: "top" | "left" | "right"
  const base = {
    position: "absolute",
    opacity: visible ? 1 : 0,
    transition: `opacity 0.22s ease ${delay}ms, transform 0.22s ease ${delay}ms`,
    pointerEvents: "none",
    userSelect: "none",
    zIndex: 10,
  };

  const placementStyle = {
    top: {
      // bottom edge of badge touches ring top, centered horizontally
      bottom: SIZE + GAP,
      left: "50%",
      transform: `translateX(-50%) ${visible ? "translateY(0)" : "translateY(4px)"}`,
    },
    left: {
      // right edge of badge touches ring left, centered vertically
      right: SIZE + GAP,
      top: "50%",
      transform: `translateY(-50%) ${visible ? "translateX(0)" : "translateX(-4px)"}`,
    },
    right: {
      // left edge of badge touches ring right, centered vertically
      left: SIZE + GAP,
      top: "50%",
      transform: `translateY(-50%) ${visible ? "translateX(0)" : "translateX(4px)"}`,
    },
  }[placement];

  return (
    <div style={{ ...base, ...placementStyle }}>
      <div
        style={{
          background: "#fff",
          border: `1.5px solid ${color}28`,
          borderRadius: 8,
          boxShadow: "0 2px 12px rgba(0,0,0,0.09)",
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 10px",
          whiteSpace: "nowrap",
          minWidth: 110,
        }}
      >
        {/* vertical accent */}
        <div style={{ width: 2, height: 16, borderRadius: 4, backgroundColor: color, flexShrink: 0 }} />
        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9ca3af", flex: 1 }}>
          {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>
          {value}
        </span>
      </div>
    </div>
  );
}

function SingleDonut({ type, used, hovering, onEnter, onLeave }) {
  const dash = Math.min(used / type.yearly, 1) * CIRC;
  const monthsElapsed = new Date().getMonth() + 1;
  const available = type.monthly > 0
    ? Math.min(type.monthly * monthsElapsed, type.yearly)
    : type.yearly;
  const remaining = Math.max(0, available - used);

  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, cursor: "default" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Container = exactly SVG size; overflow visible lets badges spill out */}
      <div style={{ position: "relative", width: SIZE, height: SIZE, overflow: "visible" }}>

        {/* Donut SVG */}
        <svg
          width={SIZE} height={SIZE}
          style={{ transform: "rotate(-90deg)", transition: "opacity 0.3s", opacity: hovering ? 0.55 : 1 }}
        >
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={type.light} strokeWidth={THICK} />
          <circle
            cx={CX} cy={CY} r={R} fill="none"
            stroke={type.color} strokeWidth={THICK}
            strokeDasharray={`${dash} ${CIRC - dash}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.7s ease" }}
          />
        </svg>

        {/* Center text */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none", userSelect: "none",
        }}>
          <>
            <span style={{ fontSize: 22, fontWeight: 800, color: type.color, lineHeight: 1 }}>{available}</span>
            <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>available</span>
          </>
        </div>

        {/* TOP — Available */}
        <Badge label="Available" value={`${available} days`} color={type.color} visible={hovering} delay={0}   placement="top"   />
        {/* RIGHT — Remaining */}
        <Badge label="Remaining" value={`${remaining} days`} color={type.color} visible={hovering} delay={80}  placement="right" />
        {/* LEFT — Acquired */}
        <Badge label="Acquired"  value={`${used} days`}      color={type.color} visible={hovering} delay={160} placement="left"  />

      </div>

      {/* Type label */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
          {type.key.replace(" (LOP)", "")}
        </div>
        {type.key.includes("LOP") && (
          <div style={{ fontSize: 10, color: "#9ca3af" }}>(Loss of Pay)</div>
        )}
      </div>
    </div>
  );
}

export default function LeaveDonutChart({ leaves = [], year }) {
  const currentYear = year || new Date().getFullYear();
  const [hovered, setHovered] = useState(null);

  const usedMap = useMemo(() => {
    const m = {};
    TYPES.forEach(t => { m[t.key] = 0; });
    leaves.forEach(l => {
      if (new Date(l.startDate).getFullYear() !== currentYear) return;
      if (l.status === "Rejected") return;
      const key = normalizeType(l.leaveType);
      if (m[key] !== undefined) m[key] += l.totalDays || 0;
    });
    return m;
  }, [leaves, currentYear]);

  return (
    <div className="mx-6 mt-4">
      <div className="bg-white rounded-2xl shadow-lg p-6" style={{ overflow: "visible" }}>
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-700 uppercase tracking-wide">
            Leave Breakdown — {currentYear}
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 place-items-center" style={{ gap: "48px 80px" }}>
          {TYPES.map(type => (
            <SingleDonut
              key={type.key}
              type={type}
              used={usedMap[type.key]}
              hovering={hovered === type.key}
              onEnter={() => setHovered(type.key)}
              onLeave={() => setHovered(null)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}