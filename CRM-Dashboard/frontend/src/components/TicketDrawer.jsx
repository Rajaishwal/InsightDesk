// TicketDrawer.jsx — Slide-in ticket: header, status track (admins click a step to move it), the conversation
// (the original description is the first message) and the reply box. Closed tickets are read-only.
import { useEffect, useRef, useState } from "react";
import { X, Send, FileImage, FileText, File, Loader2, Lock, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import api from "../services/axios";
import FileUploader from "./FileUploader";
import PersonAvatar from "./PersonAvatar";
import { STATUS, STATUSES, PRIORITY, CATEGORY_ICON, fmtStamp } from "./ticketMeta";
import Tooltip from "./Tooltip";
import HoverTip from "./Tooltip";

const attachIcon = (type = "") => {
  if (type.startsWith("image/")) return <FileImage className="h-3.5 w-3.5 flex-shrink-0" />;
  if (type === "application/pdf") return <FileText className="h-3.5 w-3.5 flex-shrink-0" />;
  return <File className="h-3.5 w-3.5 flex-shrink-0" />;
};

function Attachments({ files, mine }) {
  if (!files?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {files.map((f, i) => (
        <a key={i} href={f.url} target="_blank" rel="noreferrer"
          className={`inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition
            ${mine ? "bg-white/15 text-white hover:bg-white/25" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-indigo-600"}`}>
          {attachIcon(f.type)} <span className="truncate">{f.name}</span>
        </a>
      ))}
    </div>
  );
}

function Message({ who, photo, role, time, text, files, mine }) {
  return (
    <div className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
      <PersonAvatar person={{ name: who, photo }} size={30} />
      <div className={`flex max-w-[82%] flex-col ${mine ? "items-end" : "items-start"}`}>
        <p className="mb-1 flex items-center gap-1.5 text-[10.5px] text-gray-400">
          <span className="font-semibold text-gray-600">{mine ? "You" : who}</span>
          {role === "admin" && <span className="rounded bg-indigo-50 px-1 py-px text-[9px] font-bold uppercase tracking-wider text-indigo-600">Support</span>}
          <span>{fmtStamp(time)}</span>
        </p>
        <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
          ${mine ? "rounded-tr-md bg-indigo-600 text-white" : "rounded-tl-md bg-gray-100 text-gray-800"}`}>
          {text || <span className="italic opacity-70">Attachment</span>}
          <Attachments files={files} mine={mine} />
        </div>
      </div>
    </div>
  );
}

export default function TicketDrawer({ ticket: initialTicket, onClose, onUpdate, photos = {} }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role === "admin";

  const [ticket, setTicket]   = useState(initialTicket);
  const [reply, setReply]     = useState("");
  const [files, setFiles]     = useState([]);
  const [sending, setSending] = useState(false);
  const [moving, setMoving]   = useState(false);
  const busyConfirm = useRef(false);
  const bottomRef = useRef(null);

  useEffect(() => { setTicket(initialTicket); }, [initialTicket]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [ticket?.replies?.length]);

  // Esc closes the drawer (but not while a confirm dialog is open on top of it)
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busyConfirm.current) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!ticket) return null;

  const closed = ticket.status === "Closed";
  const st = STATUS[ticket.status] || STATUS.Open;
  const pr = PRIORITY[ticket.priority] || PRIORITY.Low;
  const CatIcon = CATEGORY_ICON[ticket.category];
  const ownerMine = String(ticket.userId) === String(user?._id);
  const step = STATUSES.indexOf(ticket.status);

  const send = async () => {
    if (sending || (!reply.trim() && files.length === 0)) return;
    try {
      setSending(true);
      const res = await api.post(`/tickets/${ticket._id}/reply`, { message: reply.trim(), attachments: files });
      setTicket(res.data.ticket);
      setReply("");
      setFiles([]);
      onUpdate?.(res.data.ticket);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't send the reply.");
    } finally {
      setSending(false);
    }
  };

  const move = async (status) => {
    if (!isAdmin || closed || status === ticket.status) return;
    if (status === "Closed") {
      busyConfirm.current = true;
      const ok = await confirm({
        tone: "danger",
        title: `Close ${ticket.ticketId}?`,
        message: "Closed tickets are final — nobody can reply or change the status afterwards.",
        confirmText: "Close ticket",
      });
      setTimeout(() => { busyConfirm.current = false; }, 0);
      if (!ok) return;
    }
    try {
      setMoving(true);
      const res = await api.put(`/tickets/${ticket._id}/status`, { status });
      setTicket(res.data.ticket);
      onUpdate?.(res.data.ticket);
      toast.success(`${ticket.ticketId} marked ${STATUS[status].label.toLowerCase()}.`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Couldn't change the status.");
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/40 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="animate-slideInRight flex h-full w-full max-w-lg flex-col bg-white shadow-2xl" aria-label={`Ticket ${ticket.ticketId}`}>
        <div className="border-b border-gray-100 px-6 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-gray-500">{ticket.ticketId}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${st.chip}`}><st.Icon className="h-3 w-3" />{st.label}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pr.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${pr.dot}`} />{ticket.priority} priority</span>
            </div>
            <HoverTip text="Close"><button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"><X className="h-5 w-5" /></button></HoverTip>
          </div>
          <h2 className="mt-2.5 text-lg font-bold leading-snug text-gray-900">{ticket.problem || ticket.category}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
            {CatIcon && <CatIcon className="h-3.5 w-3.5 text-gray-400" />}{ticket.category}
            <span className="text-gray-300">·</span> raised {fmtStamp(ticket.createdAt)}
            {isAdmin && <><span className="text-gray-300">·</span> by <span className="font-semibold text-gray-700">{ticket.userName}</span> <span className="font-mono text-gray-400">{ticket.userEmployeeId}</span></>}
          </p>

          <div className="mt-4">
            <div className="grid grid-cols-4 gap-1.5">
              {STATUSES.map((s, i) => {
                const reached = i <= step;
                const current = i === step;
                const clickable = isAdmin && !closed && !current && !moving;
                const meta = STATUS[s];
                return (
                  <Tooltip key={s} text={clickable ? `Mark as ${meta.label.toLowerCase()}` : undefined}><button type="button" onClick={() => move(s)} disabled={!clickable}
                    className={`group text-left focus:outline-none ${clickable ? "cursor-pointer" : "cursor-default"}`}>
                    <span className={`block h-1.5 rounded-full transition ${reached ? meta.dot : "bg-gray-100"} ${clickable ? "group-hover:opacity-70" : ""}`} />
                    <span className={`mt-1.5 flex items-center gap-1 text-[11px] font-semibold ${current ? "text-gray-900" : reached ? "text-gray-500" : "text-gray-300"} ${clickable ? "group-hover:text-indigo-600 group-focus-visible:text-indigo-600" : ""}`}>
                      {current && moving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}{meta.label}
                    </span>
                  </button></Tooltip>
                );
              })}
            </div>
            {isAdmin && !closed && <p className="mt-1.5 text-[10.5px] text-gray-400">Click a step to move the ticket. Closing is final.</p>}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/40 px-6 py-5">
          <Message who={ticket.userName} photo={photos[String(ticket.userId)] || (ownerMine ? user?.photo : undefined)} role="employee"
            time={ticket.createdAt} text={ticket.description} files={ticket.attachments} mine={ownerMine} />
          {ticket.replies?.map((r, i) => {
            const mine = String(r.authorId) === String(user?._id);
            return (
              <Message key={r._id || i} who={r.authorName} photo={photos[String(r.authorId)] || (mine ? user?.photo : undefined)} role={r.authorRole}
                time={r.createdAt} text={r.message} files={r.attachments} mine={mine} />
            );
          })}
          {!ticket.replies?.length && (
            <p className="py-2 text-center text-xs text-gray-400">{isAdmin ? "No replies yet — answer below." : "No replies yet — the support team will answer here."}</p>
          )}
          <div ref={bottomRef} />
        </div>

        {closed ? (
          <div className="flex items-center gap-2 border-t border-gray-100 px-6 py-4 text-sm text-gray-500">
            <Lock className="h-4 w-4 text-gray-400" />
            {isAdmin ? "This ticket is closed — no more replies." : "This ticket is closed. Raise a new ticket if you still need help."}
          </div>
        ) : (
          <div className="space-y-2 border-t border-gray-100 px-6 py-4">
            {!isAdmin && ticket.status === "Resolved" && (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-600"><RotateCcw className="h-3 w-3" /> Replying will reopen this ticket.</p>
            )}
            <FileUploader attachments={files} onChange={setFiles} maxFiles={3} disabled={sending} />
            <div className="flex items-end gap-2">
              <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Write a reply…  (Enter to send, Shift+Enter for a new line)"
                className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50" />
              <button type="button" onClick={send} disabled={sending || (!reply.trim() && files.length === 0)} aria-label="Send reply"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-800 text-white transition hover:bg-gray-900 disabled:opacity-40">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
