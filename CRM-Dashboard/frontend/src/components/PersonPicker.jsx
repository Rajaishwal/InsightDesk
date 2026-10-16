// PersonPicker.jsx — "All employees" / one-employee picker: a pill button opening an avatar list with a search box.
// `people` = users ({ _id, name, photo, employeeId, designation, role }); `value` = selected _id or "".
// allowAll=false hides the "All employees" row (when exactly one person must be chosen); `placeholder` is the empty label;
// `disabled` locks the choice; `full` stretches the button to the container width.
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Check, Users } from "lucide-react";
import PersonAvatar from "./PersonAvatar";
import { useListNav } from "../hooks/useListNav";

export default function PersonPicker({ people, value, onChange, allowAll = true, placeholder = "All employees", disabled = false, full = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const selected = people.find((p) => p._id === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const pick = (id) => { onChange(id); setOpen(false); setQ(""); };
  // Match the name, Employee ID or designation
  const term = q.trim().toLowerCase();
  const shown = people.filter((p) => [p.name, p.employeeId, p.designation].some((v) => v?.toLowerCase().includes(term)));

  // ↓ / ↑ / Enter / Esc from the search box. Rows: "All employees" (when not searching), then the people.
  const showAll = allowAll && !q;
  const ids = [...(showAll ? [""] : []), ...shown.map((p) => p._id)];
  const nav = useListNav({
    count: ids.length,
    open,
    onSelect: (i) => pick(ids[i]),
    onClose: () => setOpen(false),
  });
  const offset = showAll ? 1 : 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-sm font-medium text-gray-700 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-50
          ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-gray-50"} ${full ? "w-full" : ""}`}
      >
        {selected ? (
          <PersonAvatar person={selected} size={26} />
        ) : (
          <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gray-100">
            <Users className="h-3.5 w-3.5 text-gray-500" />
          </span>
        )}
        <span className={`truncate ${full ? "flex-1 text-left" : "max-w-[10rem]"} ${selected ? "" : "text-gray-500"}`}>{selected ? selected.name : placeholder}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`animate-dialog-in absolute left-0 z-40 mt-2 ${full ? "w-full" : "w-64"} rounded-xl border border-gray-100 bg-white p-1 shadow-lg shadow-gray-900/10`}>
          <div className="flex items-center gap-2 border-b border-gray-100 px-2.5 pb-2 pt-1.5">
            <Search className="h-3.5 w-3.5 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={nav.onKeyDown}
              placeholder="Find by name or ID…"
              className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
          <div role="listbox" ref={nav.listRef} className="max-h-64 overflow-y-auto py-1 [scrollbar-width:thin]">
            {showAll && (
              <button type="button" role="option" aria-selected={!value} onClick={() => pick("")} {...nav.itemProps(0)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${nav.active === 0 ? "bg-indigo-50" : !value ? "bg-gray-50" : ""}`}>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100"><Users className="h-3.5 w-3.5 text-gray-500" /></span>
                <span className="flex-1 font-medium text-gray-800">All employees</span>
                {!value && <Check className="h-3.5 w-3.5 text-indigo-600" />}
              </button>
            )}
            {shown.map((p, i) => (
              <button key={p._id} type="button" role="option" aria-selected={p._id === value} onClick={() => pick(p._id)} {...nav.itemProps(i + offset)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition ${nav.active === i + offset ? "bg-indigo-50" : p._id === value ? "bg-gray-50" : ""}`}>
                <PersonAvatar person={p} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-800">{p.name}</span>
                  <span className="block truncate text-[11px] text-gray-400">{[p.employeeId, p.designation].filter(Boolean).join(" · ") || p.role}</span>
                </span>
                {p._id === value && <Check className="h-3.5 w-3.5 text-indigo-600" />}
              </button>
            ))}
            {shown.length === 0 && (
              <p className="px-3 py-3 text-center text-xs text-gray-400">{people.length ? `No one matches “${q}”` : "No employees to choose from"}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
