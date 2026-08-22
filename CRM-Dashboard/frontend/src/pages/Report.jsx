// Report.jsx — Support page: role-based ticket system + FAQ
import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, ChevronDown, ChevronUp, Ticket } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import api from "../services/axios";
import RaiseTicket from "../components/RaiseTicket";
import TicketDrawer from "../components/TicketDrawer";

/* ── static FAQ data ── */
const FAQS = [
  { q: "How do I apply for leave?", a: "Go to Leave Management from the sidebar, click 'Request Leave', fill in the dates and type, then submit." },
  { q: "How do I check my attendance?", a: "Your attendance calendar is visible on the Employee Dashboard. Click 'Attendance' in the navbar to check in/out." },
  { q: "How do I change my password?", a: "Click 'Reset Password' on the Login page, enter your email and current password, then set a new one." },
  { q: "Who do I contact for payslip issues?", a: "Raise a ticket under the 'Payroll' category with priority High and describe the issue." },
  { q: "How long does ticket resolution take?", a: "Most tickets are resolved within 1–2 business days. High priority tickets are addressed within 4 hours." },
];

/* ── status/priority styles ── */
const STATUS_CHIP = {
  "Open":        "border-blue-400 text-blue-600",
  "In Progress": "border-amber-400 text-amber-600",
  "Resolved":    "border-emerald-400 text-emerald-600",
  "Closed":      "border-gray-300 text-gray-500",
};
const PRIORITY_CHIP = {
  Low:    "border-gray-300 text-gray-500",
  Medium: "border-amber-400 text-amber-600",
  High:   "border-red-400 text-red-600",
};

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

export default function Report() {
  const { user }   = useAuth();
  const { socket } = useSocket();
  const isAdmin    = user?.role === "admin";

  const [tickets, setTickets]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [toast, setToast]             = useState(null);

  // Admin filters
  const [filters, setFilters] = useState({ status: "all", priority: "all", category: "all" });

  // FAQ accordion
  const [openFaq, setOpenFaq] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTickets = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const endpoint = isAdmin ? "/tickets/all" : "/tickets/my";
      const params   = isAdmin ? filters : {};
      const res = await api.get(endpoint, { params });
      setTickets(res.data.tickets || []);
    } catch {
      if (!silent) showToast("error", "Failed to load tickets.");
    } finally {
      if (!silent) setLoading(false); else setRefreshing(false);
    }
  }, [isAdmin, filters]);

  useEffect(() => { if (user) fetchTickets(); }, [user, fetchTickets]);

  // Real-time socket events
  useEffect(() => {
    if (!socket) return;
    const onReply = ({ ticketRef }) => {
      showToast("success", `New reply on ${ticketRef}`);
      fetchTickets(true);
    };
    const onStatus = ({ ticketRef, status }) => {
      showToast("success", `Ticket ${ticketRef} marked ${status}`);
      fetchTickets(true);
    };
    const onNew = ({ ticketId, userName }) => {
      showToast("success", `New ticket from ${userName} (${ticketId})`);
      fetchTickets(true);
    };
    socket.on("ticket:reply",        onReply);
    socket.on("ticket:statusUpdate", onStatus);
    socket.on("ticket:new",          onNew);
    return () => {
      socket.off("ticket:reply",        onReply);
      socket.off("ticket:statusUpdate", onStatus);
      socket.off("ticket:new",          onNew);
    };
  }, [socket, fetchTickets]);

  const handleTicketUpdate = (updated) => {
    setTickets(prev => prev.map(t => t._id === updated._id ? updated : t));
    if (activeTicket?._id === updated._id) setActiveTicket(updated);
  };

  // Stats
  const open       = tickets.filter(t => t.status === "Open").length;
  const inProgress = tickets.filter(t => t.status === "In Progress").length;
  const resolved   = tickets.filter(t => t.status === "Resolved").length;
  const closed     = tickets.filter(t => t.status === "Closed").length;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Support Center</h1>
          <p className="text-xs text-gray-400 mt-0.5">{isAdmin ? "Manage all employee tickets" : "Track your support requests"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchTickets(true)} disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition">
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          {!isAdmin && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl shadow-sm transition">
              <Plus size={15} /> Raise Ticket
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Open",        value: open,       color: "text-blue-600",    border: "border-blue-400",    bg: "bg-blue-50" },
          { label: "In Progress", value: inProgress, color: "text-amber-600",   border: "border-amber-400",   bg: "bg-amber-50" },
          { label: "Resolved",    value: resolved,   color: "text-emerald-600", border: "border-emerald-400", bg: "bg-emerald-50" },
          { label: "Closed",      value: closed,     color: "text-gray-500",    border: "border-gray-300",    bg: "bg-gray-50" },
        ].map(({ label, value, color, border, bg }) => (
          <div key={label} className={`bg-white rounded-xl border ${border} shadow-sm p-4`}>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
            <p className={`text-3xl font-black mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Admin filters */}
      {isAdmin && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {[
            { key: "status",   options: ["all", "Open", "In Progress", "Resolved", "Closed"] },
            { key: "priority", options: ["all", "Low", "Medium", "High"] },
            { key: "category", options: ["all", "IT Support", "HR", "Finance", "Payroll", "Leave Related", "Other"] },
          ].map(({ key, options }) => (
            <select key={key} value={filters[key]}
              onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:ring-2 focus:ring-indigo-400 focus:outline-none bg-white">
              {options.map(o => (
                <option key={o} value={o}>{o === "all" ? `All ${key.charAt(0).toUpperCase() + key.slice(1)}` : o}</option>
              ))}
            </select>
          ))}
        </div>
      )}

      {/* Tickets table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">{isAdmin ? "All Tickets" : "My Tickets"}</h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <Ticket className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">{isAdmin ? "No tickets found" : "No tickets yet — raise one above"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Ticket ID", "Category", "Problem", isAdmin && "Employee", "Priority", "Status", "Raised", ""].filter(Boolean).map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tickets.map(t => (
                  <tr key={t._id} className="hover:bg-indigo-50/30 transition cursor-pointer" onClick={() => setActiveTicket(t)}>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-gray-500">{t.ticketId}</td>
                    <td className="px-4 py-3 text-gray-700">{t.category}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{t.problem || "—"}</td>
                    {isAdmin && <td className="px-4 py-3 text-gray-700 text-xs">{t.userName}<br/><span className="text-gray-400 font-mono">{t.userEmployeeId}</span></td>}
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${PRIORITY_CHIP[t.priority]}`}>{t.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_CHIP[t.status]}`}>{t.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmt(t.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-indigo-400 font-medium whitespace-nowrap">
                      {t.replies?.length > 0 && `${t.replies.length} repl${t.replies.length === 1 ? "y" : "ies"}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-sm font-bold text-gray-700 mb-4">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {FAQS.map((f, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition text-left"
              >
                {f.q}
                {openFaq === i ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />}
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-sm text-gray-500 bg-gray-50">{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <RaiseTicket
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={(ticket) => {
            showToast("success", `Ticket ${ticket.ticketId} submitted!`);
            fetchTickets(true);
          }}
        />
      )}

      {activeTicket && (
        <TicketDrawer
          ticket={activeTicket}
          onClose={() => setActiveTicket(null)}
          onUpdate={handleTicketUpdate}
        />
      )}
    </div>
  );
}