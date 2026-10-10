// BrandOrbit.jsx — The animated InsightDesk mark with feature icons riding two counter-rotating orbits.
// Default: glass cards for a navy background (login brand panel).
// onLight: solid navy cards and navy orbit lines for a white background (splash screen).
import { Clock, Timer, CalendarDays, MessagesSquare } from "lucide-react";
import BrandMark from "./BrandMark";

// angle in degrees (0 = right, clockwise)
const OUTER_ICONS = [
  { Icon: Clock,          angle: -50, delay: "1.4s", tone: "text-amber-300" },
  { Icon: CalendarDays,   angle: 130, delay: "1.6s", tone: "text-sky-300" },
];
const INNER_ICONS = [
  { Icon: Timer,          angle: 205, delay: "1.5s", tone: "text-sky-300" },
  { Icon: MessagesSquare, angle: 25,  delay: "1.7s", tone: "text-amber-300" },
];
const OUTER_DOTS = [{ angle: 200, size: "h-2.5 w-2.5", tone: "warm" }, { angle: 45, size: "h-2 w-2", tone: "cool" }];
const INNER_DOTS = [{ angle: 115, size: "h-1.5 w-1.5", tone: "soft" }, { angle: -60, size: "h-2 w-2", tone: "cool" }];

const THEME = {
  navyBg: {
    tile:  "glass",
    outer: "border-dashed border-white/15",
    inner: "border-white/10",
    chip:  "bg-white/10 ring-1 ring-white/15 backdrop-blur-sm",
    dot:   { warm: "bg-amber-400", cool: "bg-blue-400", soft: "bg-white/70" },
    glow:  "from-blue-500/50 to-amber-400/40",
  },
  whiteBg: {
    tile:  "navy",
    outer: "border-dashed border-[#0f1b3d]/20",
    inner: "border-[#0f1b3d]/10",
    chip:  "bg-gradient-to-br from-[#26377a] to-[#0f1b3d] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_10px_20px_-8px_rgba(15,27,61,0.55)]",
    dot:   { warm: "bg-amber-400", cool: "bg-blue-500", soft: "bg-slate-400" },
    glow:  "from-blue-400/30 to-amber-300/35",
  },
};

// Places a child on an orbit of radius r at the given angle
const orbitPos = (angle, r) => ({ transform: `rotate(${angle}deg) translateX(${r}px) rotate(${-angle}deg)` });

function OrbitIcon({ Icon, angle, delay, tone, r, t }) {
  return (
    <div className="absolute left-1/2 top-1/2 -ml-5 -mt-5 h-10 w-10" style={orbitPos(angle, r)}>
      <div className="login-upright h-full w-full">
        <div className={`login-pop flex h-full w-full items-center justify-center rounded-xl ${t.chip}`} style={{ animationDelay: delay }}>
          {Icon && <Icon className={`h-[18px] w-[18px] ${tone}`} />}
        </div>
      </div>
    </div>
  );
}

function OrbitDot({ angle, size, tone, r, t }) {
  return (
    <div className="absolute left-1/2 top-1/2 h-0 w-0" style={orbitPos(angle, r)}>
      <span className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${size} ${t.dot[tone]}`} />
    </div>
  );
}

export default function BrandOrbit({ onLight = false, className = "" }) {
  const t = THEME[onLight ? "whiteBg" : "navyBg"];
  return (
    <div aria-hidden className={`relative h-[340px] w-[340px] flex-shrink-0 ${className}`}>
      {/* Outer orbit (r = 160) */}
      <div className={`login-orbit absolute inset-[10px] rounded-full border ${t.outer}`} style={{ "--dur": "60s" }}>
        {OUTER_DOTS.map((d) => <OrbitDot key={d.angle} {...d} r={160} t={t} />)}
        {OUTER_ICONS.map((c) => <OrbitIcon key={c.angle} {...c} r={160} t={t} />)}
      </div>
      {/* Inner orbit (r = 108) */}
      <div className={`login-orbit-rev absolute inset-[62px] rounded-full border ${t.inner}`} style={{ "--dur": "45s" }}>
        {INNER_DOTS.map((d) => <OrbitDot key={d.angle} {...d} r={108} t={t} />)}
        {INNER_ICONS.map((c) => <OrbitIcon key={c.angle} {...c} r={108} t={t} />)}
      </div>

      {/* Centre: glowing app-icon tile with the animated mark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`login-glow absolute h-44 w-44 rounded-full bg-gradient-to-br blur-3xl ${t.glow}`} />
        <div className="login-float relative">
          <BrandMark size={112} variant={t.tile} />
        </div>
      </div>
    </div>
  );
}
