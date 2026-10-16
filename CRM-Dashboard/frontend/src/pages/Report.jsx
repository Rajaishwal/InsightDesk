// Report.jsx — Support: tickets (employees see their own, admins see everyone's) + quick answers.
// Status tiles filter the list; admins also filter by priority / category and see who's waiting on a reply.
// Clicking a ticket opens the conversation drawer. Live updates arrive over the socket.
import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw, Plus, Search, X, MessageSquare, ChevronDown, AlertCircle, LifeBuoy, Reply, Paperclip,
  CalendarDays, ReceiptIndianRupee, IndianRupee, Clock, KeyRound, Timer,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import api from "../services/axios";
import StatTile from "../components/StatTile";
import PersonAvatar from "../components/PersonAvatar";
import RaiseTicket from "../components/RaiseTicket";
import TicketDrawer from "../components/TicketDrawer";
import { useCapToFirstN, capClass, capStyle } from "../hooks/useCapToFirstN";
import { STATUS, STATUSES, PRIORITY, PRIORITIES, CATEGORIES, CATEGORY_ICON, lastFrom, fmtDate } from "../components/ticketMeta";
import Tooltip from "../components/Tooltip";

const FAQS = [
  { Icon: CalendarDays, q: "How do I apply for leave?", a: "Open Leave Management and click “Request leave”. Pick the type and dates (weekends aren't counted) and send it — HR approves or rejects it and you're notified." },
  { Icon: ReceiptIndianRupee, q: "Where is my payslip?", a: "Payslips & Salary lists every month. Pick a month and click “Download PDF”, then choose “Save as PDF” in the print dialog." },
  { Icon: IndianRupee, q: "My salary or a deduction looks wrong", a: "Raise a ticket under Payroll → “Wrong Deduction” (or “Salary Not Received”) and mention the month in the description." },
  { Icon: Clock, q: "How do I check in and take breaks?", a: "Use “Check In” in the top bar when you start — it runs your work timer. “Break” pauses it, and “Check Out” ends your day." },
  { Icon: KeyRound, q: "I can't log in / forgot my password", a: "Ask a colleague to raise a ticket for you under IT Support → “Login / Access Issue”, or contact an admin directly." },
  { Icon: Timer, q: "How fast are tickets answered?", a: "Most tickets are resolved within 1–2 working days; High priority ones are picked up within 4 hours. Replying to a resolved ticket reopens it — closed tickets are final." },
];

export default function Report() {
  const { user }   = useAuth();
  const { socket } = useSocket();
  const toast      = useToast();
  const isAdmin    = user?.role === "admin";

  const [tickets, setTickets]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showRaise, setShowRaise]   = useState(false);
  const [activeId, setActiveId]     = useState(null);
  const [photos, setPhotos]         = useState({});
  const [status, setStatus]         = useState("active"); // "active" = Open + In progress
  const [priority, setPriority]     = useState("all");
  const [category, setCategory]     = useState("all");
  const [search, setSearch]         = useState("");
  const [openFaq, setOpenFaq]       = useState(null);

  const fetchTickets = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      const res = await api.get(isAdmin ? "/tickets/all" : "/tickets/my");
      setTickets(res.data.tickets || []);
      setError("");
    } catch (err) {
      if (!silent) setError(!err?.response ? "Can't reach the server — make sure the backend is running." : "Couldn't load tickets.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { if (user) fetchTickets(); }, [user, fetchTickets]);

  // Photos for avatars (admins see everyone)
  useEffect(() => {
    if (!isAdmin) return;
    api.get("/users").then((r) => setPhotos(Object.fromEntries((r.data || []).filter((u) => u.photo).map((u) => [String(u._id), u.photo])))).catch(() => {});
  }, [isAdmin]);

  // Live updates
  useEffect(() => {
    if (!socket) return;
    const onReply  = ({ ticketRef }) => { toast.info(`New reply on ${ticketRef}`); fetchTickets(true); };
    const onStatus = ({ ticketRef, status: s }) => { toast.info(`${ticketRef} is now ${(STATUS[s]?.label || s).toLowerCase()}`); fetchTickets(true); };
    const onNew    = ({ ticketId, userName }) => { if (!isAdmin) return; toast.info(`New ticket from ${userName} (${ticketId})`); fetchTickets(true); };
    socket.on("ticket:reply", onReply);
    socket.on("ticket:statusUpdate", onStatus);
    socket.on("ticket:new", onNew);
    return () => {
      socket.off("ticket:reply", onReply);
      socket.off("ticket:statusUpdate", onStatus);
      socket.off("ticket:new", onNew);
    };
  }, [socket, fetchTickets, toast, isAdmin]);

  const onTicketUpdate = (updated) => setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));

  const count = (s) => tickets.filter((t) => t.status === s).length;
  // Admin: open tickets where the employee spoke last. Employee: support answered and it's not closed.
  const waiting = (t) => (isAdmin
    ? (t.status === "Open" || t.status === "In Progress") && lastFrom(t) === "employee"
    : t.status !== "Closed" && lastFrom(t) === "support");
  const waitingCount = tickets.filter(waiting).length;

  const q = search.trim().toLowerCase();
  const visible = tickets
    .filter((t) => status === "all" || (status === "active" ? t.status === "Open" || t.status === "In Progress" : status === "waiting" ? waiting(t) : t.status === status))
    .filter((t) => priority === "all" || t.priority === priority)
    .filter((t) => category === "all" || t.category === category)
    .filter((t) => !q || [t.ticketId, t.problem, t.category, t.description, t.userName, t.userEmployeeId].some((v) => (v || "").toLowerCase().includes(q)))
    // waiting first, then High → Low, then newest
    .sort((a, b) => (waiting(b) - waiting(a)) || (PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority)) || (new Date(b.createdAt) - new Date(a.createdAt)));

  const active = tickets.find((t) => t._id === activeId);

  // The list shows the first few tickets; the rest scroll inside the card (re-measured when the list changes)
  const SHOW = 4;
  const [listRef, listMaxH] = useCapToFirstN(SHOW, [visible.map((t) => t._id).join(","), loading]);
  const toggle = (s) => setStatus((cur) => (cur === s ? "all" : s));
  const filtered = status !== "all" || priority !== "all" || category !== "all" || q;
  const clearFilters = () => { setStatus("all"); setPriority("all"); setCategory("all"); setSearch(""); };
  const byCategory = CATEGORIES.map((c) => [c, tickets.filter((t) => t.category === c).length]).filter(([, n]) => n > 0);
  const listTitle = { all: "All tickets", active: "Open & in progress", waiting: isAdmin ? "Waiting for your reply" : "Support replied" }[status] || `${STATUS[status]?.label} tickets`;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isAdmin ? "Every employee ticket — reply, then move it through to resolved." : "Raise a ticket and chat with the support team about it."}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <div className="flex w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 md:w-72">
            <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAdmin ? "Search ID, problem or employee…" : "Search your tickets…"}
              className="w-full min-w-0 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
            {search && <Tooltip text="Clear search"><button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100"><X className="h-3.5 w-3.5" /></button></Tooltip>}
          </div>
          <Tooltip text="Refresh"><button type="button" onClick={() => fetchTickets(true)} disabled={refreshing} aria-label="Refresh"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:text-indigo-600 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button></Tooltip>
          {!isAdmin && (
            <button type="button" onClick={() => setShowRaise(true)}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-gray-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900">
              <Plus className="h-4 w-4" /> Raise ticket
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATUSES.map((s) => {
          const meta = STATUS[s];
          const n = count(s);
          const sub = {
            "Open": n ? "waiting to be picked up" : "nothing new",
            "In Progress": n ? "being worked on" : "nothing in progress",
            "Resolved": n ? (isAdmin ? "employee can still reply" : "reply to reopen") : "none yet",
            "Closed": "final — read only",
          }[s];
          return (
            <StatTile key={s} tone={meta.tone} Icon={meta.Icon} label={meta.label} value={loading ? "—" : n} sub={sub}
              active={status === s} onClick={() => toggle(s)} />
          );
        })}
      </div>

      {!loading && waitingCount > 0 && status !== "waiting" && (
        <button type="button" onClick={() => setStatus("waiting")}
          className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-left text-sm transition hover:bg-indigo-50">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm"><Reply className="h-4 w-4" /></span>
          <span className="flex-1 text-gray-700">
            <span className="font-semibold text-gray-900">{waitingCount} {waitingCount === 1 ? "ticket" : "tickets"}</span>{" "}
            {isAdmin ? "waiting for your reply" : "with a new answer from support"}
          </span>
          <span className="text-xs font-semibold text-indigo-600">Show</span>
        </button>
      )}

      <div className={`grid items-start gap-5 ${isAdmin && byCategory.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-bold text-gray-900">{listTitle} <span className="font-medium text-gray-400">· {visible.length}</span></h2>
            <div className="flex flex-wrap items-center gap-1.5">
              {[["active", "Active"], ["all", "All"]].map(([k, label]) => (
                <button key={k} type="button" onClick={() => setStatus(k)} aria-pressed={status === k}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${status === k ? "bg-gray-800 text-white" : "bg-gray-50 text-gray-500 ring-1 ring-gray-200 hover:text-gray-700"}`}>
                  {label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-gray-200" />
              {PRIORITIES.map((p) => (
                <button key={p} type="button" onClick={() => setPriority((cur) => (cur === p ? "all" : p))} aria-pressed={priority === p}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${priority === p ? `${PRIORITY[p].chip} ring-1 ring-current` : "bg-gray-50 text-gray-500 ring-1 ring-gray-200 hover:text-gray-700"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY[p].dot}`} />{p}
                </button>
              ))}
            </div>
          </div>
          {category !== "all" && (
            <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-2 text-xs text-gray-600">
              Category: <span className="font-semibold">{category}</span>
              <button type="button" onClick={() => setCategory("all")} className="ml-auto font-semibold text-indigo-600 hover:underline">Clear</button>
            </div>
          )}

          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                  <div className="h-10 w-10 rounded-xl bg-gray-100" />
                  <div className="flex-1 space-y-2"><div className="h-3.5 w-48 rounded bg-gray-100" /><div className="h-3 w-72 rounded bg-gray-100" /></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-5 py-12 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
              <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
              <button type="button" onClick={() => { setLoading(true); fetchTickets(); }} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><LifeBuoy className="h-6 w-6 text-gray-300" /></div>
              <p className="mt-3 text-sm font-medium text-gray-700">
                {!tickets.length ? (isAdmin ? "No tickets yet" : "You haven't raised any tickets") : status === "active" && !q && priority === "all" && category === "all" ? "Nothing open — all caught up" : "No tickets match"}
              </p>
              {!tickets.length && !isAdmin ? (
                <button type="button" onClick={() => setShowRaise(true)} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Raise your first ticket</button>
              ) : filtered && tickets.length > 0 ? (
                <button type="button" onClick={clearFilters} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Show all tickets</button>
              ) : null}
            </div>
          ) : (
            <ul ref={listRef} className={`divide-y divide-gray-50 ${capClass(listMaxH)}`} style={capStyle(listMaxH)}>
              {visible.map((t) => {
                const st = STATUS[t.status] || STATUS.Open;
                const pr = PRIORITY[t.priority] || PRIORITY.Low;
                const CatIcon = CATEGORY_ICON[t.category];
                const wait = waiting(t);
                const replies = t.replies?.length || 0;
                const files = (t.attachments?.length || 0) + (t.replies || []).reduce((n, r) => n + (r.attachments?.length || 0), 0);
                return (
                  <li key={t._id}>
                    <button type="button" onClick={() => setActiveId(t._id)}
                      className={`flex w-full items-start gap-3.5 px-5 py-3.5 text-left transition hover:bg-gray-50/80 focus:outline-none focus-visible:bg-indigo-50/50 ${t.status === "Closed" ? "opacity-70" : ""}`}>
                      <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 ring-1 ring-gray-100">
                        {CatIcon && <CatIcon className="h-[18px] w-[18px]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-sm font-semibold text-gray-900">{t.problem || t.category}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-[10.5px] font-semibold ${pr.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${pr.dot}`} />{t.priority}</span>
                          {wait && (
                            <span className="rounded-full bg-indigo-600 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-white">
                              {isAdmin ? "Needs reply" : "Support replied"}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-gray-500">{t.description}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-gray-400">
                          <span className="font-mono font-semibold text-gray-500">{t.ticketId}</span>
                          <span>{t.category}</span>
                          {isAdmin && (
                            <span className="inline-flex items-center gap-1.5 text-gray-500">
                              <PersonAvatar person={{ name: t.userName, photo: photos[String(t.userId)] }} size={16} />{t.userName}
                            </span>
                          )}
                          <span>{fmtDate(t.createdAt)}</span>
                          {replies > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{replies}</span>}
                          {files > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{files}</span>}
                        </span>
                      </span>
                      <span className={`inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${st.chip}`}>
                        <st.Icon className="h-3.5 w-3.5" />{st.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!loading && !error && listMaxH && (
            <p className="border-t border-gray-100 py-2 text-center text-[10px] font-semibold text-gray-400">
              Scroll for {visible.length - SHOW} more
            </p>
          )}
        </div>

        {/* Side column (admins): tickets per category */}
        {isAdmin && byCategory.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900">By category</h2>
            <p className="text-[11px] text-gray-400">All tickets · click to filter</p>
            <div className="mt-3 space-y-1">
              {byCategory.map(([c, n]) => {
                const Icon = CATEGORY_ICON[c];
                const max = Math.max(...byCategory.map(([, v]) => v));
                return (
                  <button key={c} type="button" onClick={() => setCategory((cur) => (cur === c ? "all" : c))} aria-pressed={category === c}
                    className={`w-full rounded-lg px-2 py-1.5 text-left transition ${category === c ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
                    <span className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                      {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}{c}<span className="ml-auto tabular-nums text-gray-500">{n}</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-indigo-400" style={{ width: `${(n / max) * 100}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick answers — a row of cards under the tickets; each opens on its own */}
      <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-gray-900">Quick answers</h2>
          <p className="text-[11px] text-gray-400">Check here before raising a ticket</p>
        </div>
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {FAQS.map((f, i) => {
            const open = openFaq === i;
            return (
              <div key={f.q} className={`rounded-xl ring-1 transition ${open ? "bg-indigo-50/40 ring-indigo-100" : "bg-gray-50/60 ring-gray-100 hover:ring-gray-200"}`}>
                <button type="button" onClick={() => setOpenFaq(open ? null : i)} aria-expanded={open}
                  className="flex w-full items-center gap-3 px-3.5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded-xl">
                  <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${open ? "bg-indigo-600 text-white" : "bg-white text-gray-500 ring-1 ring-gray-100"}`}>
                    <f.Icon className="h-4 w-4" />
                  </span>
                  <span className={`min-w-0 flex-1 text-[13px] font-semibold ${open ? "text-indigo-900" : "text-gray-700"}`}>{f.q}</span>
                  <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} />
                </button>
                {open && <p className="px-3.5 pb-3.5 pl-[3.75rem] text-xs leading-relaxed text-gray-600">{f.a}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {showRaise && (
        <RaiseTicket
          isOpen={showRaise}
          onClose={() => setShowRaise(false)}
          onSubmit={(ticket) => {
            toast.success(`Ticket ${ticket.ticketId} raised — support will reply here.`);
            setStatus("active");
            fetchTickets(true);
          }}
        />
      )}

      {active && (
        <TicketDrawer ticket={active} photos={photos} onClose={() => setActiveId(null)} onUpdate={onTicketUpdate} />
      )}
    </div>
  );
}
