// StatTile.jsx — Summary card in the dashboard stat-card style (coloured left edge, label, big number, icon).
// Pass onClick to make it a filter button (active = highlighted).
const TONES = {
  violet:  { bar: "border-l-violet-400",  iconBg: "bg-violet-50",  icon: "text-violet-600",  on: "ring-1 ring-violet-300 bg-violet-50/50" },
  blue:    { bar: "border-l-blue-400",    iconBg: "bg-blue-50",    icon: "text-blue-600",    on: "ring-1 ring-blue-300 bg-blue-50/50" },
  amber:   { bar: "border-l-amber-400",   iconBg: "bg-amber-50",   icon: "text-amber-600",   on: "ring-1 ring-amber-300 bg-amber-50/50" },
  emerald: { bar: "border-l-emerald-400", iconBg: "bg-emerald-50", icon: "text-emerald-600", on: "ring-1 ring-emerald-300 bg-emerald-50/50" },
  rose:    { bar: "border-l-rose-400",    iconBg: "bg-rose-50",    icon: "text-rose-600",    on: "ring-1 ring-rose-300 bg-rose-50/50" },
};

export default function StatTile({ label, value, sub, Icon, tone = "violet", active = false, onClick }) {
  const t = TONES[tone];
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button", onClick, "aria-pressed": active } : {})}
      className={`rounded-xl border border-l-4 border-gray-100 ${t.bar} bg-white p-4 text-left shadow-sm transition
        ${onClick ? "cursor-pointer hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300" : ""}
        ${active ? t.on : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
          <p className="mt-1 text-2xl font-black leading-none text-gray-800">{value}</p>
          <p className="mt-1.5 truncate text-[11px] text-gray-400" title={sub}>{sub}</p>
        </div>
        <div className={`ml-2 flex-shrink-0 rounded-xl p-2.5 ${t.iconBg}`}>
          {Icon && <Icon className={`h-5 w-5 ${t.icon}`} />}
        </div>
      </div>
    </Tag>
  );
}
