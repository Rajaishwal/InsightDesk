// MeterRing.jsx — Small progress ring shared by the ring-tile cards (Employee Report, Admin Dashboard).
// Meter rule: fill = the share, track = a lighter step of the same hue. Put the centre label in `children`.
export default function MeterRing({ pct, fill, track, label, children }) {
  const size = 52, stroke = 5, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const share = Math.max(0, Math.min(1, pct || 0));
  return (
    <div className="relative h-[52px] w-[52px] flex-shrink-0" role="img" aria-label={label}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {share > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={fill} strokeWidth={stroke}
            strokeDasharray={`${share * c} ${c}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.7s ease" }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">{children}</div>
    </div>
  );
}
