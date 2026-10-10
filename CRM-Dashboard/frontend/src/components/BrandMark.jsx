// BrandMark.jsx — The InsightDesk logo drawn in SVG on an app-icon tile, with its intro animation:
// the tile pops in, the blue "I" rises, then the amber "D" arc draws itself (keyframes: login-* in index.css).
// variant "glass" → frosted-glass tile for navy backgrounds (login brand panel)
// variant "navy"  → solid navy tile for white backgrounds (splash screen)
import { useId } from "react";

const TILE = {
  glass: "bg-gradient-to-br from-white/20 to-white/[0.04] ring-1 ring-white/20 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_24px_48px_-12px_rgba(0,0,0,0.6)]",
  navy:  "bg-gradient-to-br from-[#26377a] to-[#0f1b3d] ring-1 ring-[#0f1b3d]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_24px_48px_-14px_rgba(15,27,61,0.55)]",
};

export default function BrandMark({ size = 112, variant = "glass" }) {
  const glowId = `brand-glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const mark = Math.round(size * 0.75);
  return (
    <div
      className={`login-pop relative flex items-center justify-center overflow-hidden ${TILE[variant]}`}
      style={{ width: size, height: size, borderRadius: Math.round(size / 4) }}
    >
      {/* Light catching the top edge of the glass */}
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      <svg viewBox="0 0 512 512" width={mark} height={mark} className="overflow-visible">
        <defs>
          {/* Each shape glows in its own colour */}
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="16" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g filter={`url(#${glowId})`}>
          <g className="login-mark-i" fill="#3b82f6">
            <rect x="96" y="80" width="132" height="58" rx="12" />
            <rect x="168" y="80" width="60" height="352" rx="10" />
            <rect x="96" y="374" width="132" height="58" rx="12" />
          </g>
          <path className="login-mark-d" d="M240 112 A144 144 0 0 1 240 400" fill="none" stroke="#fbbf24" strokeWidth="64" />
        </g>
      </svg>
    </div>
  );
}
