import { useState, useEffect, useRef } from "react";
import { X, Search, Send, MessageSquare, Circle, Paperclip, FileText, Download, Pencil, Trash2, Check, CornerUpLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import api from "../services/axios";

// Avatar initials helper
const Avatar = ({ name, photo, size = "w-9 h-9" }) => {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        className={`${size} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const colors = [
    "bg-indigo-500","bg-blue-500","bg-green-500","bg-amber-500",
    "bg-pink-500","bg-purple-500","bg-teal-500","bg-rose-500",
  ];
  const color = colors[name?.charCodeAt(0) % colors.length] || "bg-gray-400";
  return (
    <div className={`${size} ${color} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
};


const ChatPanel = ({ onClose }) => {
  const { user } = useAuth();
  const { messages, sendMessage, editMessage, deleteMessage, markRead, loadHistory, isOnline, unreadFrom } =
    useSocket();

  const [conversations, setConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [activeChat, setActiveChat] = useState(null); // { _id, name, photo, ... }
  const [inputText, setInputText] = useState("");
  const [pendingFile, setPendingFile] = useState(null); // { file, previewUrl, fileName, fileType }
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // { _id, senderName, text, fileName, fileType }
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load recent conversations on open
  useEffect(() => {
    api.get("/messages/conversations").then((r) => setConversations(r.data)).catch(() => {});
  }, []);

  // Live-search employees
  useEffect(() => {
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?query=${encodeURIComponent(searchTerm)}`);
        setSearchResults(res.data.filter((u) => u._id !== user._id));
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm, user]);

  // When active chat changes, load history and mark read
  useEffect(() => {
    if (!activeChat) return;
    api.get(`/messages/${activeChat._id}`)
      .then((r) => {
        loadHistory(activeChat._id, r.data);
        markRead(activeChat._id);
        // Refresh conversation list to update unread badges
        api.get("/messages/conversations").then((cr) => setConversations(cr.data)).catch(() => {});
      })
      .catch(() => {});
    inputRef.current?.focus();
  }, [activeChat?._id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages[activeChat?._id]]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
    const fileType = imageExts.includes(ext) ? "image" : ext === "pdf" ? "pdf" : "file";
    const previewUrl = fileType === "image" ? URL.createObjectURL(file) : null;
    setPendingFile({ file, previewUrl, fileName: file.name, fileType });
    e.target.value = "";
  };

  const clearPendingFile = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && !pendingFile) return;
    if (!activeChat) return;

    const replyPayload = replyTo ? { messageId: replyTo._id, senderId: replyTo.senderId, senderName: replyTo.senderName, text: replyTo.text || "", fileName: replyTo.fileName, fileType: replyTo.fileType } : null;

    if (pendingFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", pendingFile.file);
        const res = await api.post("/messages/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        sendMessage(activeChat._id, text, {
          fileUrl: res.data.fileUrl,
          fileName: res.data.fileName,
          fileType: res.data.fileType,
        }, replyPayload);
        clearPendingFile();
      } catch (err) {
        console.error("File upload failed", err);
      } finally {
        setIsUploading(false);
      }
    } else {
      sendMessage(activeChat._id, text, null, replyPayload);
    }
    setInputText("");
    setReplyTo(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openChat = (person) => {
    setActiveChat(person);
    setSearchTerm("");
    setSearchResults([]);
    setReplyTo(null);
  };


  const activeMessages = messages[activeChat?._id] || [];

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // WhatsApp-style: today→time, yesterday→"Yesterday", this week→day name, older→date
  const formatConvTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  // Group messages by date
  const groupedMessages = activeMessages.reduce((acc, msg) => {
    const label = formatDate(msg.createdAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(msg);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[9999] flex items-stretch justify-end pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative flex w-[820px] max-w-full h-full bg-white shadow-2xl pointer-events-auto animate-slideInRight">

        {/* ── LEFT: Conversation list ── */}
        <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col bg-white">
          {/* Header */}
          <div className="px-4 pt-5 pb-3 bg-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xl font-bold text-gray-900">Chats</span>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Search */}
            <div className="flex items-center gap-2 bg-[#f0f2f5] rounded-full px-4 py-2">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-sm outline-none w-full text-gray-700 placeholder-gray-400"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List body */}
          <div className="flex-1 overflow-y-auto">
            {searchTerm ? (
              /* Search results */
              searchResults.length === 0 ? (
                <div className="text-center mt-10 px-4">
                  <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No employees found</p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-4 py-2">Results</p>
                  {searchResults.map((emp) => (
                    <button
                      key={emp._id}
                      onClick={() => openChat(emp)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f0f2f5] transition text-left ${
                        activeChat?._id === emp._id ? "bg-[#f0f2f5]" : ""
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar name={emp.name} photo={emp.photo} size="w-12 h-12" />
                        {isOnline(emp._id) && (
                          <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-gray-900 truncate">{emp.name}</p>
                        <p className="text-[13px] text-gray-400 truncate mt-0.5">{emp.designation || emp.role}</p>
                      </div>
                    </button>
                  ))}
                </>
              )
            ) : (
              /* Recent conversations */
              conversations.length === 0 ? (
                <div className="text-center mt-16 px-6">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">No chats yet</p>
                  <p className="text-xs text-gray-400 mt-1">Search for an employee to start chatting.</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const unread = unreadFrom[conv.userId] ?? conv.unread ?? 0;
                  const isActive = activeChat?._id === conv.userId;
                  const isMine = conv.lastSenderId === user._id;
                  return (
                    <button
                      key={conv.userId}
                      onClick={() => openChat({ _id: conv.userId, name: conv.name, photo: conv.photo, designation: conv.designation, employeeId: conv.employeeId })}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition text-left border-b border-gray-100 ${
                        isActive ? "bg-[#f0f2f5]" : "hover:bg-[#f9f9f9]"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <Avatar name={conv.name} photo={conv.photo} size="w-12 h-12" />
                        {isOnline(conv.userId) && (
                          <span className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: name + time */}
                        <div className="flex items-baseline justify-between gap-1">
                          <p className={`text-[15px] truncate ${unread > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                            {conv.name}
                          </p>
                          <span className={`text-[11px] flex-shrink-0 ${unread > 0 ? "text-green-600 font-semibold" : "text-gray-400"}`}>
                            {formatConvTime(conv.lastMessageTime)}
                          </span>
                        </div>

                        {/* Row 2: last message + unread badge */}
                        <div className="flex items-center justify-between mt-0.5 gap-1">
                          <p className={`text-[13px] truncate flex items-center gap-1 leading-tight ${unread > 0 ? "text-gray-700" : "text-gray-400"}`}>
                            {/* Delivery ticks for my messages */}
                            {isMine && !conv.lastFileType && (
                              <span className="text-[11px] text-gray-400 flex-shrink-0">✓✓</span>
                            )}
                            {conv.lastFileType ? (
                              <>
                                <Paperclip className="w-3 h-3 flex-shrink-0 text-gray-400" />
                                <span className="text-gray-400">{conv.lastFileName || "File"}</span>
                              </>
                            ) : (
                              <span className={unread > 0 ? "font-medium" : ""}>
                                {isMine ? <span className="text-gray-400">You: </span> : null}{conv.lastMessage}
                              </span>
                            )}
                          </p>
                          {unread > 0 && (
                            <span className="flex-shrink-0 bg-green-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* ── RIGHT: Chat thread ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeChat ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-white shadow-sm flex-shrink-0">
                <div className="relative">
                  <Avatar name={activeChat.name} photo={activeChat.photo} size="w-10 h-10" />
                  {isOnline(activeChat._id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{activeChat.name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Circle className={`w-2 h-2 fill-current ${isOnline(activeChat._id) ? "text-green-400" : "text-gray-300"}`} />
                    {isOnline(activeChat._id) ? "Online" : "Offline"}
                    {activeChat.designation && ` · ${activeChat.designation}`}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-gray-50">
                {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
                  <div key={dateLabel}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 bg-gray-50 px-2">{dateLabel}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <div className="space-y-2">
                      {msgs.map((msg, i) => {
                        const isMe = msg.senderId === user._id || msg.senderId?._id === user._id;
                        const isEditing = editingId === msg._id;
                        return (
                          <div key={msg._id || i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                            {!isMe && (
                              <Avatar name={activeChat.name} photo={activeChat.photo} size="w-7 h-7 mr-2 mt-1" />
                            )}
                            <div className="max-w-[68%] group">

                              {/* ── Inline edit mode ── */}
                              {isEditing ? (
                                <div className="flex flex-col gap-1.5">
                                  <textarea
                                    autoFocus
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        if (editText.trim()) {
                                          editMessage(msg._id, activeChat._id, editText.trim());
                                          setEditingId(null);
                                        }
                                      }
                                      if (e.key === "Escape") setEditingId(null);
                                    }}
                                    className="text-sm bg-white text-gray-800 border-2 border-indigo-400 rounded-xl px-3 py-2 outline-none resize-none w-full min-w-[180px] leading-5"
                                    rows={2}
                                  />
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="text-[10px] text-gray-500 hover:text-gray-700 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (editText.trim()) {
                                          editMessage(msg._id, activeChat._id, editText.trim());
                                          setEditingId(null);
                                        }
                                      }}
                                      className="text-[10px] text-white px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition flex items-center gap-1"
                                    >
                                      <Check className="w-2.5 h-2.5" /> Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>

                                  {/* ── Message bubble ── */}
                                  <div className={`rounded-2xl overflow-hidden ${isMe ? "rounded-br-sm" : "rounded-bl-sm"} ${
                                    msg.fileType === "image" ? "shadow-sm" :
                                    msg.fileType ? (isMe ? "bg-indigo-600 text-white" : "bg-white text-gray-800 shadow-sm border border-gray-100") :
                                    (isMe ? "bg-indigo-600 text-white" : "bg-white text-gray-800 shadow-sm border border-gray-100")
                                  }`}>

                                    {/* Reply quote */}
                                    {msg.replyTo?.senderName && (
                                      <div className={`mx-2 mt-2 px-3 py-2 rounded-lg border-l-4 ${isMe ? "bg-indigo-500 border-indigo-300" : "bg-gray-50 border-indigo-400"}`}>
                                        <p className={`text-[11px] font-semibold mb-0.5 ${isMe ? "text-indigo-200" : "text-indigo-600"}`}>
                                          {msg.replyTo.senderName}
                                        </p>
                                        <p className={`text-[11px] truncate ${isMe ? "text-indigo-200" : "text-gray-500"}`}>
                                          {msg.replyTo.fileType ? (
                                            <span className="flex items-center gap-1"><Paperclip className="w-2.5 h-2.5" />{msg.replyTo.fileName || "File"}</span>
                                          ) : (
                                            msg.replyTo.text || ""
                                          )}
                                        </p>
                                      </div>
                                    )}

                                    {/* Content */}
                                    {msg.fileType === "image" ? (
                                      <>
                                        <img
                                          src={msg.fileUrl}
                                          alt={msg.fileName || "image"}
                                          className="max-w-[220px] max-h-[200px] w-full object-cover cursor-pointer hover:opacity-90 transition"
                                          onClick={() => window.open(msg.fileUrl, "_blank")}
                                        />
                                        {msg.text && (
                                          <div className={`px-3 py-2 text-sm break-words ${isMe ? "bg-indigo-600 text-white" : "bg-white text-gray-800"}`}>
                                            {msg.text}
                                          </div>
                                        )}
                                      </>
                                    ) : msg.fileType ? (
                                      <div className="px-4 py-3">
                                        <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5">
                                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? "bg-indigo-500" : "bg-indigo-50"}`}>
                                            <FileText className={`w-4 h-4 ${isMe ? "text-white" : "text-indigo-500"}`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold truncate">{msg.fileName || "File"}</p>
                                            <p className={`text-[10px] mt-0.5 ${isMe ? "text-indigo-200" : "text-gray-400"}`}>
                                              {msg.fileType?.toUpperCase()} · Tap to open
                                            </p>
                                          </div>
                                          <Download className={`w-4 h-4 flex-shrink-0 ${isMe ? "text-indigo-200" : "text-gray-400"}`} />
                                        </a>
                                        {msg.text && <p className="text-sm mt-2 break-words">{msg.text}</p>}
                                      </div>
                                    ) : (
                                      <div className="px-4 py-2.5 text-sm leading-relaxed break-words">
                                        {msg.text}
                                      </div>
                                    )}
                                  </div>

                                  {/* ── Timestamp + hover actions ── */}
                                  <div className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                    {/* Actions — left of timestamp for mine, right for theirs */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                      {/* Reply — everyone */}
                                      <button
                                        onClick={() => setReplyTo({ _id: msg._id, senderId: msg.senderId, senderName: isMe ? "You" : activeChat.name, text: msg.text, fileName: msg.fileName, fileType: msg.fileType })}
                                        title="Reply"
                                        className="p-1 rounded-full text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition"
                                      >
                                        <CornerUpLeft className="w-3.5 h-3.5" />
                                      </button>
                                      {/* Edit — only mine, only within 60 min */}
                                      {isMe && !msg.fileType && (Date.now() - new Date(msg.createdAt).getTime() < 60 * 60 * 1000) && (
                                        <button
                                          onClick={() => { setEditingId(msg._id); setEditText(msg.text); }}
                                          title="Edit (available for 60 min)"
                                          className="p-1 rounded-full text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                      {isMe && (
                                        <button
                                          onClick={() => deleteMessage(msg._id, activeChat._id)}
                                          title="Delete"
                                          className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    <p className={`text-[10px] text-gray-400 ${isMe ? "text-right" : "text-left"}`}>
                                      {msg.edited && <span className="mr-1 text-gray-300">edited ·</span>}
                                      {formatTime(msg.createdAt)}
                                      {isMe && <span className="ml-1">{msg.read ? "✓✓" : "✓"}</span>}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {activeMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center pt-16">
                    <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-3">
                      <MessageSquare className="w-7 h-7 text-indigo-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-500">Start a conversation</p>
                    <p className="text-xs text-gray-400 mt-1">Say hi to {activeChat.name}!</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex-shrink-0 bg-white border-t border-gray-100">
                {/* Reply preview bar */}
                {replyTo && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                    <div className="w-0.5 h-10 bg-indigo-500 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-indigo-600">{replyTo.senderName}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {replyTo.fileType ? (
                          <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{replyTo.fileName || "File"}</span>
                        ) : replyTo.text}
                      </p>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-500 transition flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* File preview bar */}
                {pendingFile && (
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border-b border-indigo-100">
                    {pendingFile.fileType === "image" ? (
                      <img
                        src={pendingFile.previewUrl}
                        alt="preview"
                        className="h-12 w-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-indigo-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{pendingFile.fileName}</p>
                      <p className="text-[10px] text-indigo-400 capitalize mt-0.5">{pendingFile.fileType} ready to send</p>
                    </div>
                    <button
                      onClick={clearPendingFile}
                      className="text-gray-400 hover:text-red-500 transition flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="px-4 py-3">
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 px-4 py-2 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-200 transition">
                    {/* Paperclip */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex-shrink-0 text-gray-400 hover:text-indigo-500 transition disabled:opacity-40 mb-0.5"
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    <textarea
                      ref={inputRef}
                      rows={1}
                      value={inputText}
                      onChange={(e) => {
                        setInputText(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={pendingFile ? "Add a caption... (optional)" : `Message ${activeChat.name}...`}
                      className="flex-1 bg-transparent outline-none resize-none text-sm text-gray-800 placeholder-gray-400 leading-5 py-1 max-h-24"
                    />
                    <button
                      onClick={handleSend}
                      disabled={(!inputText.trim() && !pendingFile) || isUploading}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition mb-0.5"
                    >
                      {isUploading ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 ml-1">Enter to send · Shift+Enter for new line</p>
                </div>
              </div>
            </>
          ) : (
            /* No chat selected */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 bg-gray-50">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-9 h-9 text-indigo-300" />
              </div>
              <p className="font-semibold text-gray-600 text-base">Your Messages</p>
              <p className="text-sm text-gray-400 mt-1 max-w-xs">
                Select a conversation or search for an employee to start chatting in real time.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default ChatPanel;