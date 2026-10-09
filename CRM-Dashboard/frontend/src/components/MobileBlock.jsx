// MobileBlock.jsx — Friendly card shown on phones / narrow screens (< 768px), where the app isn't available.
// Explains why and what to do instead: use a computer, or rotate a tablet.
import { Laptop, RotateCcw } from "lucide-react";
import logo from "../assets/logo.png";

const TIPS = [
  { Icon: Laptop,    title: "Use a laptop or desktop",       text: "Any modern browser works — Chrome, Edge or Firefox." },
  { Icon: RotateCcw, title: "On a tablet? Turn it sideways", text: "Landscape mode is wide enough to open the app." },
];

export default function MobileBlock() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-5 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl">
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />

        <div className="px-6 pb-7 pt-6 text-center">
          {/* Brand — same mark + wordmark as the Navbar */}
          <div className="flex items-center justify-center gap-2.5">
            <img src={logo} alt="" className="h-10" />
            <div className="flex flex-col items-start leading-none">
              <div className="text-[1.3rem] font-extrabold tracking-tight">
                <span className="text-blue-600">Insight</span><span className="text-amber-400">Desk</span>
              </div>
              <span className="mt-1.5 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-gray-400">Track Your Performance</span>
            </div>
          </div>

          {/* Hero icon */}
          <div className="relative mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-50">
            <Laptop className="h-10 w-10 text-indigo-600" strokeWidth={1.75} />
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-600">
              Desktop only
            </span>
          </div>

          <h1 className="mt-7 text-xl font-bold text-gray-900 [text-wrap:balance]">Open InsightDesk on a computer</h1>
          <p className="mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed text-gray-500">
            Attendance, task timers and reports need more room than a phone screen gives.
          </p>

          {/* What to do instead */}
          <ul className="mt-6 space-y-2.5 text-left">
            {TIPS.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  {Icon && <Icon className="h-4 w-4 text-indigo-600" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{title}</p>
                  <p className="mt-0.5 text-xs leading-snug text-gray-500">{text}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-[11px] text-gray-400">Need help? Contact your HR team.</p>
        </div>
      </div>
    </div>
  );
}
