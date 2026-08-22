// ChatNotificationPopup.jsx — Bottom-right WhatsApp-style popup when a new chat message arrives
import { useSocket } from "../context/SocketContext";
import { X, Image, File } from "lucide-react";

/* Decides icon for non-text messages */
function AttachmentLabel({ fileType }) {
  if (!fileType) return null;
  if (fileType.startsWith("image/")) return <span className="flex items-center gap-1 text-emerald-200"><Image className="w-3 h-3" /> Photo</span>;
  return <span className="flex items-center gap-1 text-emerald-200"><File className="w-3 h-3" /> File</span>;
}

export default function ChatNotificationPopup() {
  const { chatNotifs, dismissChatNotif } = useSocket() || {};

  if (!chatNotifs?.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9998] flex flex-col-reverse gap-2.5 pointer-events-none"
         style={{ maxWidth: "320px", width: "calc(100vw - 40px)" }}>
      {chatNotifs.map((n) => (
        <div key={n.id}
          className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-xl animate-chat-pop bg-white"
          style={{ border: "1px solid #25D366" }}>

          {/* Avatar */}
          <div className="flex-shrink-0 relative">
            {n.senderPhoto
              ? <img src={n.senderPhoto} alt={n.senderName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/20" />
              : <div className="w-10 h-10 rounded-full bg-[#128C7E] flex items-center justify-center text-base font-black text-white border-2 border-white/20">
                  {n.senderName?.[0]?.toUpperCase() || "?"}
                </div>
            }
            {/* Glass online dot */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white online-glow-dot" />
          </div>

          {/* Body */}
          <div className="flex-1 min-w-0">
            {/* Sender name + emp id */}
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[13px] font-bold text-gray-900 leading-none truncate">{n.senderName}</p>
              {n.senderEmpId && (
                <span className="flex-shrink-0 text-[10px] font-bold text-[#075E54] bg-[#25D366]/15 px-1.5 py-0.5 rounded-full font-mono">
                  {n.senderEmpId}
                </span>
              )}
            </div>
            {/* Message preview */}
            <p className="text-[12px] text-gray-500 leading-snug line-clamp-2">
              {n.text || <AttachmentLabel fileType={n.fileType} />}
            </p>
          </div>

          {/* Close */}
          <button onClick={() => dismissChatNotif(n.id)}
            className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 transition mt-0.5 text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}