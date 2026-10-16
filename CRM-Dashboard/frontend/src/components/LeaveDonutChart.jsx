import { useMemo, useState } from "react";
import { LEAVE_TYPES as TYPES, normalizeType } from "../utils/leaveTypes";

const SIZE  = 140;
const THICK = 15;
const R     = (SIZE - THICK) / 2;   // 62.5 — outer ring edge = SIZE/2 = 70, inner = 55
const CX    = SIZE / 2;
const CY    = SIZE / 2;
const CIRC  = 2 * Math.PI * R;
const GAP   = -10; // badge overlaps the ring edge

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
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, cursor: "default" }}
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
            <span style={{ fontSize: 20, fontWeight: 800, color: type.color, lineHeight: 1 }}>{available}</span>
            <span style={{ fontSize: 9.5, color: "#9ca3af", marginTop: 3, letterSpacing: "0.04em" }}>available</span>
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
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
          {type.key.replace(" (LOP)", "")}
        </div>
        {type.key.includes("LOP") && (
          <div style={{ fontSize: 10, color: "#9ca3af" }}>(Loss of Pay)</div>
        )}
      </div>
    </div>
  );
}

export default function LeaveDonutChart({ leaves = [], year, className = "mx-6 mt-4" }) {
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
    <div className={className}>
      <div className="bg-white rounded-2xl shadow-lg px-6 pb-6 pt-5" style={{ overflow: "visible" }}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-gray-900">
              Leave <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">breakdown</span>
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">Hover a ring to see available, remaining and used days</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold tabular-nums text-indigo-600 ring-1 ring-indigo-100">{currentYear}</span>
        </div>

        {/* items-start keeps every ring on the same line (Unplanned has an extra "(Loss of Pay)" line) */}
        <div className="grid grid-cols-2 md:grid-cols-4 items-start justify-items-center" style={{ gap: "40px 48px" }}>
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