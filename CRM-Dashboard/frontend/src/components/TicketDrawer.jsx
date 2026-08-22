// TicketDrawer.jsx — Slide-in panel showing full ticket thread + reply + status change
import { useState, useRef, useEffect } from "react";
import { X, Send, Clock, User, FileImage, FileText, File } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import FileUploader from "./FileUploader";

const attachIcon = (type = "") => {
  if (type.startsWith("image/")) return <FileImage size={12} className="text-indigo-400" />;
  if (type === "application/pdf") return <FileText size={12} className="text-red-400" />;
  return <File size={12} className="text-gray-400" />;
};

const STATUS_STYLE = {
  "Open":        "border-blue-400 text-blue-600",
  "In Progress": "border-amber-400 text-amber-600",
  "Resolved":    "border-emerald-400 text-emerald-600",
  "Closed":      "border-gray-400 text-gray-500",
};

const PRIORITY_STYLE = {
  Low:    "border-gray-300 text-gray-500",
  Medium: "border-amber-400 text-amber-600",
  High:   "border-red-400 text-red-600",
};

const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed"];

const fmt = (d) => new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function TicketDrawer({ ticket: initialTicket, onClose, onUpdate }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [ticket, setTicket]         = useState(initialTicket);
  const [reply, setReply]           = useState("");
  const [replyAttachments, setReplyAttachments] = useState([]);
  const [sending, setSending]       = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    setTicket(initialTicket);
  }, [initialTicket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.replies]);

  const handleReply = async () => {
    if (!reply.trim() && replyAttachments.length === 0) return;
    try {
      setSending(true);
      const res = await api.post(`/tickets/${ticket._id}/reply`, {
        message:     reply.trim(),
        attachments: replyAttachments,
      });
      setTicket(res.data.ticket);
      setReply("");
      setReplyAttachments([]);
      onUpdate?.(res.data.ticket);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      setStatusLoading(true);
      const res = await api.put(`/tickets/${ticket._id}/status`, { status });
      setTicket(res.data.ticket);
      onUpdate?.(res.data.ticket);
    } catch (err) {
      console.error(err);
    } finally {
      setStatusLoading(false);
    }
  };

  if (!ticket) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-gray-400">{ticket.ticketId}</span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_STYLE[ticket.status]}`}>
                {ticket.status}
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${PRIORITY_STYLE[ticket.priority]}`}>
                {ticket.priority}
              </span>
            </div>
            <h3 className="text-sm font-bold text-gray-800">{ticket.category}</h3>
            {ticket.problem && <p className="text-xs text-gray-400 mt-0.5">{ticket.problem}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
            <X size={18} />
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-[11px] text-gray-500">
          <span className="flex items-center gap-1"><User size={11} /> {ticket.userName} ({ticket.userEmployeeId})</span>
          <span className="flex items-center gap-1"><Clock size={11} /> {fmt(ticket.createdAt)}</span>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Description */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{ticket.description}</p>
            {ticket.attachments?.length > 0 && (
              <div className="mt-2 space-y-1">
                {ticket.attachments.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition truncate">
                    {attachIcon(f.type)}
                    <span className="truncate">{f.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Replies */}
          {ticket.replies.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Conversation</p>
              {ticket.replies.map((r, i) => {
                const isMe = r.authorId === user?._id || r.authorName === user?.name;
                const isAdminReply = r.authorRole === "admin";
                return (
                  <div key={i} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                    <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white
                      ${isAdminReply ? "bg-indigo-500" : "bg-emerald-500"}`}>
                      {r.authorName?.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                      <span className="text-[10px] text-gray-400 mb-1">
                        {r.authorName} {isAdminReply ? "· Support" : ""} · {fmt(r.createdAt)}
                      </span>
                      <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed
                        ${isMe
                          ? "bg-indigo-500 text-white rounded-tr-sm"
                          : "bg-gray-100 text-gray-700 rounded-tl-sm"}`}>
                        {r.message}
                        {r.attachments?.length > 0 && (
                          <div className={`mt-1.5 space-y-1 ${r.message ? "pt-1.5 border-t border-white/20" : ""}`}>
                            {r.attachments.map((f, ai) => (
                              <a key={ai} href={f.url} target="_blank" rel="noreferrer"
                                className={`flex items-center gap-1 text-[11px] truncate hover:underline
                                  ${isMe ? "text-indigo-100 hover:text-white" : "text-gray-500 hover:text-indigo-600"}`}>
                                {attachIcon(f.type)}
                                <span className="truncate">{f.name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}

          {ticket.replies.length === 0 && (
            <div className="text-center text-xs text-gray-400 py-4">No replies yet</div>
          )}
        </div>

        {/* Admin: status changer */}
        {isAdmin && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Change Status:</span>
            {ticket.status === "Closed" ? (
              <span className="text-[11px] text-gray-400 italic">This ticket is permanently closed.</span>
            ) : (
              STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={statusLoading || ticket.status === s}
                  className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition disabled:opacity-40
                    ${ticket.status === s
                      ? STATUS_STYLE[s] + " opacity-100"
                      : "border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600"}`}
                >
                  {s}
                </button>
              ))
            )}
          </div>
        )}

        {/* Reply box */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-2">
          <FileUploader
            attachments={replyAttachments}
            onChange={setReplyAttachments}
            maxFiles={3}
            disabled={sending}
          />
          <div className="flex gap-2">
            <textarea
              rows={2}
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
              placeholder="Write a reply… (Enter to send)"
              className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-indigo-400 focus:outline-none focus:border-transparent placeholder-gray-300"
            />
            <button
              onClick={handleReply}
              disabled={sending || (!reply.trim() && replyAttachments.length === 0)}
              className="self-end px-3 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-xl transition"
            >
              <Send size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}