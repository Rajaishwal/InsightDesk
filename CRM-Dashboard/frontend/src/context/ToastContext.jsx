import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const ICONS = {
  success: <CheckCircle2 className="w-4 h-4 flex-shrink-0" />,
  error:   <XCircle      className="w-4 h-4 flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 flex-shrink-0" />,
  info:    <Info          className="w-4 h-4 flex-shrink-0" />,
};

const STYLES = {
  success: "bg-emerald-50  border-emerald-200 text-emerald-800",
  error:   "bg-red-50      border-red-200     text-red-800",
  warning: "bg-amber-50    border-amber-200   text-amber-800",
  info:    "bg-indigo-50   border-indigo-200  text-indigo-800",
};

const ICON_COLOR = {
  success: "text-emerald-500",
  error:   "text-red-500",
  warning: "text-amber-500",
  info:    "text-indigo-500",
};

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) =>
    setToasts(t => t.filter(x => x.id !== id)), []);

  const toast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++_id;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  // Convenience aliases
  toast.success = (msg, dur) => toast(msg, "success", dur);
  toast.error   = (msg, dur) => toast(msg, "error",   dur);
  toast.warning = (msg, dur) => toast(msg, "warning", dur);
  toast.info    = (msg, dur) => toast(msg, "info",    dur);

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* ── Toast container ── */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none"
           style={{ maxWidth: "360px", width: "calc(100vw - 40px)" }}>
        {toasts.map(t => (
          <div key={t.id}
            className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-lg
              pointer-events-auto animate-slide-in
              ${STYLES[t.type] || STYLES.info}`}>
            <span className={ICON_COLOR[t.type] || ICON_COLOR.info}>
              {ICONS[t.type] || ICONS.info}
            </span>
            <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
            <button onClick={() => dismiss(t.id)}
              className="opacity-50 hover:opacity-100 transition mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}