// RaiseTicket.jsx — "Raise a ticket" form: pick a category (then the problem), how urgent it is, describe it,
// attach files. Category / problem / priority are radio groups — ← → ↑ ↓ move between the choices.
import { useEffect, useState } from "react";
import { X, LifeBuoy, Loader2, AlertCircle } from "lucide-react";
import api from "../services/axios";
import FileUploader from "./FileUploader";
import { CATEGORIES, CATEGORY_ICON, PROBLEMS, PRIORITIES, PRIORITY } from "./ticketMeta";
import Tooltip from "./Tooltip";

const EMPTY = { category: "", problem: "", priority: "Low", description: "" };
const MAX = 1000;

// Arrow keys inside a radio group: move to the next / previous choice and pick it
const radioKeys = (list, value, pick) => (e) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!step || !list.length) return;
  e.preventDefault();
  // Start from the focused choice (nothing may be picked yet), else the picked one
  const i = list.indexOf(e.target.closest("[data-value]")?.dataset.value ?? value);
  const next = list[(i + step + list.length) % list.length];
  pick(next);
  e.currentTarget.querySelector(`[data-value="${CSS.escape(next)}"]`)?.focus();
};

function Label({ children, hint }) {
  return (
    <p className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
      <span>{children}</span>
      {hint && <span className="font-medium normal-case tracking-normal text-gray-400">{hint}</span>}
    </p>
  );
}

export default function RaiseTicket({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isOpen) { setForm(EMPTY); setAttachments([]); setErr(""); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setErr(""); };
  const pickCategory = (c) => set({ category: c, problem: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) return setErr("Choose what the ticket is about.");
    if (!form.description.trim()) return setErr("Describe the problem so the support team can help.");
    try {
      setSubmitting(true);
      const res = await api.post("/tickets", { ...form, description: form.description.trim(), attachments });
      onSubmit?.(res.data.ticket);
      onClose();
    } catch (error) {
      setErr(!error?.response ? "Can't reach the server — make sure the backend is running." : error.response.data?.message || "Couldn't raise the ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  const problems = PROBLEMS[form.category] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={handleSubmit} className="animate-dialog-in flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="h-1 flex-shrink-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />
        <div className="flex items-start gap-3 px-6 pt-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50"><LifeBuoy className="h-5 w-5 text-indigo-600" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900">Raise a ticket</h2>
            <p className="text-sm text-gray-500">Tell the support team what's wrong — you can chat with them on the ticket.</p>
          </div>
          <Tooltip text="Close"><button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-4 w-4" /></button></Tooltip>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Category */}
          <div>
            <Label>What's it about?</Label>
            <div role="radiogroup" aria-label="Category" onKeyDown={radioKeys(CATEGORIES, form.category, pickCategory)} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CATEGORIES.map((c, i) => {
                const Icon = CATEGORY_ICON[c];
                const on = form.category === c;
                return (
                  <button key={c} type="button" role="radio" aria-checked={on} data-value={c} onClick={() => pickCategory(c)}
                    tabIndex={on || (!form.category && i === 0) ? 0 : -1}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300
                      ${on ? "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-400" : "bg-gray-50 text-gray-600 ring-gray-100 hover:bg-gray-100"}`}>
                    <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${on ? "bg-white text-indigo-600" : "bg-white text-gray-400"}`}>
                      {Icon && <Icon className="h-4 w-4" />}
                    </span>
                    <span className="truncate">{c}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Problem */}
          {form.category && (
            <div>
              <Label hint="optional">Problem</Label>
              <div role="radiogroup" aria-label="Problem" onKeyDown={radioKeys(problems, form.problem, (p) => set({ problem: p }))} className="flex flex-wrap gap-1.5">
                {problems.map((p, i) => {
                  const on = form.problem === p;
                  return (
                    <button key={p} type="button" role="radio" aria-checked={on} data-value={p} onClick={() => set({ problem: on ? "" : p })}
                      tabIndex={on || (!form.problem && i === 0) ? 0 : -1}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300
                        ${on ? "bg-gray-800 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-300"}`}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Priority */}
          <div>
            <Label>How urgent?</Label>
            <div role="radiogroup" aria-label="Priority" onKeyDown={radioKeys(PRIORITIES, form.priority, (p) => set({ priority: p }))} className="grid grid-cols-3 gap-2">
              {PRIORITIES.map((p) => {
                const on = form.priority === p;
                return (
                  <button key={p} type="button" role="radio" aria-checked={on} data-value={p} onClick={() => set({ priority: p })} tabIndex={on ? 0 : -1}
                    className={`rounded-xl px-3 py-2 text-left ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300
                      ${on ? "bg-white ring-2 ring-gray-800" : "bg-gray-50 ring-gray-100 hover:bg-gray-100"}`}>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800"><span className={`h-2 w-2 rounded-full ${PRIORITY[p].dot}`} />{p}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-gray-500">{PRIORITY[p].hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label hint={`${form.description.length}/${MAX}`}>Describe it</Label>
            <textarea rows={4} maxLength={MAX} value={form.description} onChange={(e) => set({ description: e.target.value })}
              placeholder="What happened, when, and anything you've already tried…"
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50" />
          </div>

          {/* Attachments */}
          <div>
            <Label hint="screenshots or documents">Attachments</Label>
            <FileUploader attachments={attachments} onChange={setAttachments} disabled={submitting} />
          </div>

          {err && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> <span>{err}</span>
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Raise ticket
          </button>
        </div>
      </form>
    </div>
  );
}
