// PaySlips.jsx — "Payslips & Salary": your own monthly payslips (read-only — salaries are added by an admin).
// Summary tiles, the selected payslip laid out like a real slip (earnings / deductions / net pay in words),
// and the full history beside it (↑ ↓ moves between months). "Download" opens the print dialog → Save as PDF.
// Once payroll marks a salary Paid, you confirm it reached you: "Yes, received" locks the record for good;
// "Not received" opens a Payroll support ticket. Updates arrive live ("crm:salary:updated").
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet, CheckCircle2, Hourglass, XCircle, Receipt, Download, AlertCircle, ReceiptIndianRupee, CalendarDays, Info,
  CheckCheck, AlertTriangle, Loader2, Lock, BadgeCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import api from "../services/axios";
import { getCache, setCache } from "../utils/pageCache";
import StatTile from "../components/StatTile";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EARNINGS = [
  { key: "housing",          label: "House rent allowance (HRA)" },
  { key: "medical",          label: "Medical allowance" },
  { key: "performanceBonus", label: "Performance bonus" },
];
const DEDUCTIONS = [
  { key: "providentFund",   label: "Provident fund (PF)" },
  { key: "incomeTax",       label: "Income tax" },
  { key: "healthInsurance", label: "Employee state insurance (ESI)" },
];
const STATUS = {
  Paid:    { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", Icon: CheckCircle2 },
  Pending: { chip: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-400",   Icon: Hourglass },
  Failed:  { chip: "bg-rose-50 text-rose-700 ring-rose-200",          dot: "bg-rose-500",    Icon: XCircle },
};

const num = (v) => Number(v) || 0;
const inr = (n) => `₹${num(n).toLocaleString("en-IN", { minimumFractionDigits: num(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
// When it was paid (older records have no payment date — fall back to when it was marked paid)
const paidOn = (p) => p.paymentDate || p.processedAt || p.updatedAt;
const sumObj = (o) => Object.values(o || {}).reduce((n, v) => n + num(v), 0);
const periodKey = (s) => s.year * 100 + MONTHS.indexOf(s.month);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

// Indian-style amount in words (lakh / crore), e.g. 185625 → "One Lakh Eighty Five Thousand Six Hundred Twenty Five Rupees only"
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
  "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const three = (n) => [Math.floor(n / 100) ? `${ONES[Math.floor(n / 100)]} Hundred` : "", n % 100 ? two(n % 100) : ""].filter(Boolean).join(" ");
function inWords(amount) {
  const total = Math.round(num(amount) * 100);
  let r = Math.floor(total / 100);
  const paise = total % 100;
  if (!r && !paise) return "Zero Rupees only";
  const parts = [];
  const crore = Math.floor(r / 1e7); r %= 1e7;
  const lakh = Math.floor(r / 1e5); r %= 1e5;
  const thousand = Math.floor(r / 1000); r %= 1000;
  if (crore) parts.push(`${crore > 999 ? crore.toLocaleString("en-IN") : three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (r) parts.push(three(r));
  const rupees = parts.length ? `${parts.join(" ")} Rupees` : "";
  return `${[rupees, paise ? `${two(paise)} Paise` : ""].filter(Boolean).join(" and ")} only`;
}

// Print one payslip on its own (the browser's print dialog has "Save as PDF")
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function printPayslip(p, user) {
  const rows = (list, values) => list.map((x) => `<tr><td>${esc(x.label)}</td><td class="n">${esc(inr(values?.[x.key]))}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(p.month)} ${esc(p.year)} — ${esc(p.userName)}</title>
<style>
  *{box-sizing:border-box} body{font:13px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111827;margin:0;padding:40px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111827;padding-bottom:16px}
  .brand{font-size:22px;font-weight:800;color:#1e3a8a}.brand span{color:#f59e0b}.muted{color:#6b7280}
  h1{font-size:16px;margin:0;text-align:right} .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}
  .meta div{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 10px}.meta b{display:block;font-size:13px}
  .meta small{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:20px} table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding:6px 0}
  td{padding:6px 0;border-bottom:1px solid #f3f4f6}.n{text-align:right;font-variant-numeric:tabular-nums}
  tr.t td{font-weight:700;border-top:1px solid #e5e7eb;border-bottom:0}
  .net{margin-top:24px;display:flex;justify-content:space-between;align-items:center;background:#111827;color:#fff;border-radius:10px;padding:14px 18px}
  .net b{font-size:22px}.words{margin-top:8px}.foot{margin-top:40px;font-size:11px;color:#9ca3af;text-align:center}
</style></head><body>
<div class="top"><div><div class="brand">Insight<span>Desk</span></div><div class="muted">Track your performance</div></div>
<div><h1>Payslip — ${esc(p.month)} ${esc(p.year)}</h1><div class="muted" style="text-align:right">Status: ${esc(p.status || "Pending")}</div></div></div>
<div class="meta">
  <div><small>Employee</small><b>${esc(p.userName)}</b></div>
  <div><small>Employee ID</small><b>${esc(p.userId)}</b></div>
  <div><small>Designation</small><b>${esc(user?.designation || "—")}</b></div>
  <div><small>${p.status === "Paid" ? "Paid on" : "Added on"}</small><b>${esc(fmtDate(p.status === "Paid" ? paidOn(p) : p.createdAt))}</b></div>
</div>
<div class="cols">
  <table><tr><th>Earnings</th><th class="n">Amount</th></tr>
    <tr><td>Basic pay</td><td class="n">${esc(inr(p.basicPay))}</td></tr>${rows(EARNINGS, p.allowances)}
    <tr class="t"><td>Total earnings</td><td class="n">${esc(inr(num(p.basicPay) + sumObj(p.allowances)))}</td></tr></table>
  <table><tr><th>Deductions</th><th class="n">Amount</th></tr>${rows(DEDUCTIONS, p.deductions)}
    <tr class="t"><td>Total deductions</td><td class="n">${esc(inr(sumObj(p.deductions)))}</td></tr></table>
</div>
<div class="net"><span>Net pay</span><b>${esc(inr(p.netPay))}</b></div>
<div class="words muted">${esc(inWords(p.netPay))}</div>
<div class="foot">This is a computer-generated payslip from InsightDesk and needs no signature.</div>
</body></html>`;

  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}

function StatusChip({ status }) {
  const st = STATUS[status] || STATUS.Pending;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${st.chip}`}>
      {st.Icon && <st.Icon className="h-3.5 w-3.5" />} {status || "Pending"}
    </span>
  );
}

function Line({ label, value, sign, strong }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 text-sm ${strong ? "border-t border-gray-100 font-semibold text-gray-900" : "text-gray-600"}`}>
      <span>{label}</span>
      <span className={`tabular-nums ${strong ? "" : "text-gray-800"}`}>{sign}{inr(value)}</span>
    </div>
  );
}

// Paid and not yet confirmed / reported by the employee
const awaitingConfirm = (s) => s.status === "Paid" && !s.receipt?.status;

// "Did the money arrive?" — under the payslip header
function ReceiptPanel({ p, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => { setReporting(false); setNote(""); }, [p._id]);

  const send = async (received) => {
    setBusy(received ? "yes" : "no");
    try {
      const { data } = await api.patch(`/salary/${p._id}/receipt`, { received, note: received ? "" : note });
      onChanged(data);
      if (received) toast.success(`Thanks — payroll can see you received your ${p.month} salary.`);
      else toast.success(`Reported to payroll — ticket ${data.receipt?.ticketId} is open on the Support page.`);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Couldn't save that — please try again.");
    } finally {
      setBusy("");
    }
  };
  const yes = async () => {
    const ok = await confirm({
      tone: "success",
      title: `Confirm you received ${inr(p.netPay)}?`,
      message: `Your ${p.month} ${p.year} salary will be marked as received. After that it's locked — payroll can't change or delete it.`,
      confirmText: "Yes, I received it",
      cancelText: "Not yet",
    });
    if (ok) send(true);
  };

  const shell = "flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-6 py-3 text-sm";
  if (p.status === "Pending") {
    return <div className={`${shell} border-gray-100 bg-gray-50 text-gray-500`}><Hourglass className="h-4 w-4 text-gray-400" /> Once payroll marks this salary as paid, you'll be asked to confirm you received it.</div>;
  }
  if (p.status === "Failed") {
    return <div className={`${shell} border-rose-100 bg-rose-50 text-rose-700`}><XCircle className="h-4 w-4" /> This payment failed — payroll will send it again.</div>;
  }
  const r = p.receipt?.status;
  if (r === "Received") {
    return (
      <div className={`${shell} border-emerald-100 bg-emerald-50 text-emerald-800`}>
        <BadgeCheck className="h-4 w-4 text-emerald-600" />
        <span>You confirmed receiving this salary on <b>{fmtDate(p.receipt.at)}</b>.</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600"><Lock className="h-3.5 w-3.5" /> Locked</span>
      </div>
    );
  }
  if (r === "Not received") {
    return (
      <div className={`${shell} border-rose-100 bg-rose-50 text-rose-800`}>
        <AlertTriangle className="h-4 w-4 text-rose-600" />
        <span className="min-w-0 flex-1">
          You reported this as not received on {fmtDate(p.receipt.at)}
          {p.receipt.ticketId && <> · <Link to="/support" className="font-semibold underline underline-offset-2">ticket {p.receipt.ticketId}</Link></>}
        </span>
        <button type="button" onClick={yes} disabled={!!busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50 disabled:opacity-60">
          {busy === "yes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />} It has arrived
        </button>
      </div>
    );
  }
  return (
    <div className="border-b border-indigo-100 bg-indigo-50/70 px-6 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm"><CheckCheck className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 text-gray-700">
          <b className="text-gray-900">Did you receive {inr(p.netPay)}?</b> Payroll marked your {p.month} salary as paid on {fmtDate(paidOn(p))}.
        </span>
        {!reporting && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setReporting(true)} disabled={!!busy}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:opacity-60">Not received</button>
            <button type="button" onClick={yes} disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
              {busy === "yes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />} Yes, received
            </button>
          </div>
        )}
      </div>
      {reporting && (
        <div className="mt-3 space-y-2">
          <textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} autoFocus
            placeholder="Anything payroll should know? e.g. which account you checked (optional)"
            className="w-full resize-none rounded-xl border border-rose-100 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-300 focus:border-rose-300 focus:ring-4 focus:ring-rose-50" />
          <div className="flex items-center justify-end gap-2">
            <span className="mr-auto text-[11px] text-gray-500">This opens a High-priority Payroll ticket so payroll can look into it.</span>
            <button type="button" onClick={() => setReporting(false)} disabled={!!busy} className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-white">Cancel</button>
            <button type="button" onClick={() => send(false)} disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60">
              {busy === "no" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Report to payroll
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// The selected payslip, laid out like the printed one
function Slip({ p, user, onChanged }) {
  const earnings = num(p.basicPay) + sumObj(p.allowances);
  const deductions = sumObj(p.deductions);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Top band */}
      <div className="relative overflow-hidden bg-gray-900 px-6 py-5 text-white">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Payslip</p>
            <h2 className="mt-0.5 text-xl font-bold">{p.month} {p.year}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
              <StatusChip status={p.status} />
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {p.status === "Paid" ? `Paid on ${fmtDate(paidOn(p))}` : `Added on ${fmtDate(p.createdAt)}`}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Net pay</p>
            <p className="mt-0.5 text-3xl font-bold tabular-nums">{inr(p.netPay)}</p>
            <button type="button" onClick={() => printPayslip(p, user)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">
              <Download className="h-3.5 w-3.5" /> Download PDF
            </button>
          </div>
        </div>
      </div>

      <ReceiptPanel p={p} onChanged={onChanged} />

      {/* Who */}
      <div className="grid grid-cols-2 gap-px border-b border-gray-100 bg-gray-100 sm:grid-cols-3">
        {[["Employee", p.userName], ["Employee ID", p.userId], ["Designation", user?.designation || "—"]].map(([k, v]) => (
          <div key={k} className="bg-white px-6 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{k}</p>
            <p className="truncate text-sm font-semibold text-gray-800">{v}</p>
          </div>
        ))}
      </div>

      {/* Earnings / deductions */}
      <div className="grid gap-x-8 px-6 py-4 md:grid-cols-2">
        <div>
          <p className="pb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">Earnings</p>
          <Line label="Basic pay" value={p.basicPay} />
          {EARNINGS.map((e) => <Line key={e.key} label={e.label} value={p.allowances?.[e.key]} />)}
          <Line label="Total earnings" value={earnings} strong />
        </div>
        <div className="mt-4 md:mt-0">
          <p className="pb-1 text-[10px] font-bold uppercase tracking-widest text-rose-700">Deductions</p>
          {DEDUCTIONS.map((d) => <Line key={d.key} label={d.label} value={p.deductions?.[d.key]} sign="− " />)}
          <div className="py-2 text-sm">&nbsp;</div>
          <Line label="Total deductions" value={deductions} sign="− " strong />
        </div>
      </div>

      {/* Net pay */}
      <div className="mx-6 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50/60 px-4 py-3 ring-1 ring-indigo-100">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Net pay <span className="font-normal text-gray-500">= earnings − deductions</span></p>
          <p className="text-xs italic text-gray-500">{inWords(p.netPay)}</p>
        </div>
        <p className="text-lg font-bold tabular-nums text-indigo-700">{inr(p.netPay)}</p>
      </div>
    </div>
  );
}

const PaySlips = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [slips, setSlips]       = useState(getCache("payslips") || []);
  const [loading, setLoading]   = useState(!getCache("payslips"));
  const [error, setError]       = useState("");
  const [selected, setSelected] = useState(null);
  const listRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/salary/me");
      setSlips(Array.isArray(data) ? data : []);
      setCache("payslips", data);
      setError("");
    } catch (err) {
      if (!getCache("payslips")) setError(!err?.response ? "Can't reach the server — make sure the backend is running." : err.response.data?.error || "Couldn't load your payslips.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Live: payroll marked one of my salaries paid (or changed it) → reload, and nudge if there's something to confirm
  const slipsRef = useRef(slips);
  useEffect(() => { slipsRef.current = slips; }, [slips]);
  useEffect(() => {
    const onUpdate = async (e) => {
      if (e.detail?.local || (e.detail?.employeeId && e.detail.employeeId !== user?.employeeId)) return;
      const before = Object.fromEntries(slipsRef.current.map((s) => [s._id, s]));
      try {
        const { data } = await api.get("/salary/me");
        const list = Array.isArray(data) ? data : [];
        setSlips(list);
        setCache("payslips", list);
        const newlyPaid = list.find((s) => awaitingConfirm(s) && (!before[s._id] || !awaitingConfirm(before[s._id])));
        if (newlyPaid) toast.info(`Your ${newlyPaid.month} salary was marked paid — please confirm you received it.`);
      } catch { /* the next update or a reload will catch up */ }
    };
    window.addEventListener("crm:salary:updated", onUpdate);
    return () => window.removeEventListener("crm:salary:updated", onUpdate);
  }, [user?.employeeId, toast]);

  // After I confirm / report: swap the record in place and let the sidebar badge recount
  const onChanged = (updated) => {
    setSlips((prev) => {
      const next = prev.map((s) => (s._id === updated._id ? updated : s));
      setCache("payslips", next);
      return next;
    });
    window.dispatchEvent(new CustomEvent("crm:salary:updated", { detail: { id: updated._id, employeeId: updated.userId, local: true } }));
  };

  const sorted = useMemo(() => [...slips].sort((a, b) => periodKey(b) - periodKey(a)), [slips]);
  // Open on a payslip waiting for my confirmation, if there is one
  const current = sorted.find((s) => s._id === selected) || sorted.find(awaitingConfirm) || sorted[0];
  const toConfirm = sorted.filter(awaitingConfirm).length;
  const latest = sorted[0];
  const year = new Date().getFullYear();
  const paidThisYear = sorted.filter((s) => s.status === "Paid" && s.year === year);
  const pending = sorted.filter((s) => s.status === "Pending").length;
  const failed = sorted.filter((s) => s.status === "Failed").length;

  // ↑ ↓ in the history list move to the next / previous month
  const onListKey = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = sorted.findIndex((s) => s._id === current?._id);
    const next = (i + (e.key === "ArrowDown" ? 1 : -1) + sorted.length) % sorted.length;
    setSelected(sorted[next]._id);
    listRef.current?.querySelector(`[data-slip="${sorted[next]._id}"]`)?.focus();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Payslips & Salary</h1>
        <p className="mt-1 text-sm text-gray-500">Your monthly payslips. Salaries are added by an admin — contact HR if something looks wrong.</p>
      </div>

      {/* Tiles */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile tone="violet" Icon={Wallet} label="Latest net pay" value={loading ? "—" : latest ? inr(latest.netPay) : "₹0"}
          sub={latest ? `${latest.month} ${latest.year}` : "no payslips yet"} />
        <StatTile tone="emerald" Icon={CheckCircle2} label={`Received in ${year}`} value={loading ? "—" : inr(paidThisYear.reduce((n, s) => n + num(s.netPay), 0))}
          sub={`${paidThisYear.length} paid ${paidThisYear.length === 1 ? "payslip" : "payslips"}`} />
        <StatTile tone="amber" Icon={Hourglass} label="To confirm" value={loading ? "—" : toConfirm}
          sub={toConfirm ? "paid — tell payroll you got it" : failed ? `${failed} failed — contact HR` : pending ? `${pending} waiting to be paid` : "all caught up"} />
        <StatTile tone="blue" Icon={Receipt} label="Payslips" value={loading ? "—" : sorted.length}
          sub={sorted.length ? `since ${sorted[sorted.length - 1].month.slice(0, 3)} ${sorted[sorted.length - 1].year}` : "none yet"} />
      </div>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm" />
          <div className="h-96 animate-pulse rounded-2xl bg-white shadow-sm" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
          <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
          <button type="button" onClick={() => { setLoading(true); load(); }} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
        </div>
      ) : !current ? (
        <div className="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><ReceiptIndianRupee className="h-6 w-6 text-gray-300" /></div>
          <p className="mt-3 text-sm font-semibold text-gray-700">No payslips yet</p>
          <p className="mt-1 text-xs text-gray-500">Your payslips appear here once an admin adds your salary.</p>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Slip p={current} user={user} onChanged={onChanged} />

          {/* History */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h2 className="text-sm font-bold text-gray-900">All payslips</h2>
              <span className="text-[11px] text-gray-400">↑ ↓ to move</span>
            </div>
            <div ref={listRef} role="listbox" aria-label="Payslips" onKeyDown={onListKey} className="max-h-[520px] overflow-y-auto p-2 [scrollbar-width:thin]">
              {sorted.map((s) => {
                const on = s._id === current._id;
                const st = STATUS[s.status] || STATUS.Pending;
                return (
                  <button key={s._id} type="button" role="option" aria-selected={on} data-slip={s._id} onClick={() => setSelected(s._id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${on ? "bg-indigo-50 ring-1 ring-indigo-100" : "hover:bg-gray-50"}`}>
                    <div className={`flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-lg ${on ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
                      <span className="text-[10px] font-bold uppercase leading-none">{s.month.slice(0, 3)}</span>
                      <span className="text-[9px] leading-tight opacity-80">{String(s.year).slice(2)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold ${on ? "text-indigo-900" : "text-gray-800"}`}>{s.month} {s.year}</p>
                      <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} /> {s.status || "Pending"}
                        {s.status === "Paid" && paidOn(s) && <span className="text-gray-400">· {fmtDate(paidOn(s))}</span>}
                      </p>
                    </div>
                    <span className="text-right">
                      <span className="block text-sm font-bold tabular-nums text-gray-900">{inr(s.netPay)}</span>
                      {awaitingConfirm(s) && <span className="mt-0.5 inline-block rounded-full bg-indigo-600 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-white">Confirm</span>}
                      {s.receipt?.status === "Not received" && <span className="mt-0.5 inline-block rounded-full bg-rose-50 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-rose-600 ring-1 ring-rose-100">Not received</span>}
                      {s.receipt?.status === "Received" && <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600"><CheckCheck className="h-3 w-3" /> Received</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-start gap-2 border-t border-gray-100 px-5 py-3 text-[11px] text-gray-500">
              <Info className="mt-px h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
              <span>Confirm each paid salary once it reaches your account. Use “Download PDF” and choose “Save as PDF” in the print dialog.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaySlips;
