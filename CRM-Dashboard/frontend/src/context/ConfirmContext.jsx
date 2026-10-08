// ConfirmContext.jsx — App-wide confirm dialog (replaces window.confirm), styled like the Attendance modal.
// Usage: const confirm = useConfirm();
//        if (!(await confirm({ title: "Delete task?", message: "...", confirmText: "Delete", tone: "danger" }))) return;
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

const ConfirmContext = createContext(null);

const TONES = {
  danger:  { Icon: AlertTriangle, tile: "bg-red-50 text-red-500",         btn: "border-red-300 text-red-500 hover:bg-red-50" },
  success: { Icon: CheckCircle2,  tile: "bg-emerald-50 text-emerald-500", btn: "border-emerald-400 text-emerald-600 hover:bg-emerald-50" },
  primary: { Icon: HelpCircle,    tile: "bg-indigo-50 text-indigo-500",   btn: "border-indigo-300 text-indigo-600 hover:bg-indigo-50" },
};

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { title, message, details, confirmText, cancelText, tone, resolve }
  const cancelRef  = useRef(null);
  const confirmRef = useRef(null);

  const confirm = useCallback((options = {}) =>
    new Promise(resolve => setDialog({ tone: "primary", confirmText: "Confirm", cancelText: "Cancel", ...options, resolve })), []);

  const close = useCallback((result) => {
    setDialog(d => { d?.resolve(result); return null; });
  }, []);

  // Escape cancels; focus the safe choice for destructive actions
  useEffect(() => {
    if (!dialog) return;
    (dialog.tone === "danger" ? cancelRef : confirmRef).current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, close]);

  const tone = TONES[dialog?.tone] || TONES.primary;
  const { Icon } = tone;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {dialog && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(false); }}
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message"
            className="w-[400px] max-w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl animate-dialog-in">
            <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />

            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${tone.tile}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id="confirm-title" className="text-base font-bold text-gray-900">{dialog.title}</h2>
                  {dialog.message && (
                    <p id="confirm-message" className="mt-1 text-sm leading-relaxed text-gray-500 break-words">{dialog.message}</p>
                  )}
                </div>
              </div>

              {dialog.details && <div className="mt-4">{dialog.details}</div>}

              <div className="mt-6 flex gap-3">
                <button ref={cancelRef} onClick={() => close(false)}
                  className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 transition hover:bg-gray-50">
                  {dialog.cancelText}
                </button>
                <button ref={confirmRef} onClick={() => close(true)}
                  className={`flex-1 rounded-full border px-4 py-2 text-sm font-semibold transition ${tone.btn}`}>
                  {dialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
