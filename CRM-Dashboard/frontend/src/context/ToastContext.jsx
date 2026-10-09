// ToastContext.jsx — App-wide toast notifications (top-right, white card, tone icon tile, countdown bar)
import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const TONES = {
  success: { Icon: CheckCircle2,  label: "Success", tile: "bg-emerald-50 text-emerald-500", text: "text-emerald-600", bar: "bg-emerald-400" },
  error:   { Icon: XCircle,       label: "Error",   tile: "bg-red-50 text-red-500",         text: "text-red-500",     bar: "bg-red-400" },
  warning: { Icon: AlertTriangle, label: "Warning", tile: "bg-amber-50 text-amber-500",     text: "text-amber-600",   bar: "bg-amber-400" },
  info:    { Icon: Info,          label: "Info",    tile: "bg-indigo-50 text-indigo-500",   text: "text-indigo-600",  bar: "bg-indigo-400" },
};

const MAX_VISIBLE = 4;
// ChatNotificationPopup portals into this element so chat pop-ups share the toasts' top-right column
export const CHAT_NOTIF_SLOT_ID = "notification-chat-slot";
let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  // Play the exit animation, then remove
  const dismiss = useCallback((id) => {
    setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x));
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 200);
  }, []);

  const toast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++_id;
    setToasts(t => [...t.slice(-(MAX_VISIBLE - 1)), { id, message, type, duration }]);
    return id;
  }, []);

  // Convenience aliases
  toast.success = (msg, dur) => toast(msg, "success", dur);
  toast.error   = (msg, dur) => toast(msg, "error",   dur);
  toast.warning = (msg, dur) => toast(msg, "warning", dur);
  toast.info    = (msg, dur) => toast(msg, "info",    dur);

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* ── Top-right notification stack: chat pop-ups (portal slot, newest on top) above toasts — one column, never overlapping ── */}
      <div className="fixed top-5 right-5 z-[100000] flex flex-col gap-2.5 pointer-events-none"
           style={{ maxWidth: "360px", width: "calc(100vw - 40px)" }}>
        <div id={CHAT_NOTIF_SLOT_ID} className="flex flex-col-reverse gap-2.5 empty:hidden" />
        {toasts.map(t => {
          const tone = TONES[t.type] || TONES.info;
          const { Icon } = tone;
          return (
            <div key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              className={`group relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg pointer-events-auto
                ${t.leaving ? "animate-toast-out" : "animate-slide-in"}`}>
              <div className="flex items-start gap-3 px-4 py-3">
                <div className={`flex-shrink-0 rounded-lg p-1.5 ${tone.tile}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${tone.text}`}>{tone.label}</p>
                  <p className="mt-0.5 text-[13px] font-medium leading-snug text-gray-700 break-words">{t.message}</p>
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="Dismiss"
                  className="-mr-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-gray-300 transition hover:bg-gray-100 hover:text-gray-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Countdown bar — pauses on hover; the toast closes when it runs out */}
              {!t.leaving && (
                <div
                  className={`toast-progress absolute bottom-0 left-0 h-0.5 w-full opacity-70 group-hover:[animation-play-state:paused] ${tone.bar}`}
                  style={{ animationDuration: `${t.duration}ms` }}
                  onAnimationEnd={() => dismiss(t.id)}
                />
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
