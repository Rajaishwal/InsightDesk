// Salary.jsx — Admin: every employee's monthly salary. Summary tiles (filter by status), month chips, search,
// a table with the pay breakdown, and an add / edit form where net pay is worked out from the basic pay.
// Your own salary is read-only here — another admin has to set it (the server enforces this too).
import { useEffect, useMemo, useState } from "react";
import {
  IndianRupee, Plus, Search, X, Pencil, CheckCircle2, XCircle, Trash2, Lock, Wallet, Hourglass, AlertTriangle,
  Loader2, AlertCircle, ReceiptIndianRupee,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/axios";
import { getCache, setCache } from "../utils/pageCache";
import StatTile from "../components/StatTile";
import PersonAvatar from "../components/PersonAvatar";
import PersonPicker from "../components/PersonPicker";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// How the pay is built from the basic pay (same rules as before)
const ALLOWANCES = [
  { key: "housing",          label: "House rent (HRA)", rate: 0.5 },
  { key: "medical",          label: "Medical",          rate: 0.0625 },
  { key: "performanceBonus", label: "Performance bonus", rate: 0.1 },
];
const DEDUCTIONS = [
  { key: "providentFund",    label: "Provident fund (PF)", rate: 0.12 },
  { key: "incomeTax",        label: "Income tax",          rate: 0.05 },
  { key: "healthInsurance",  label: "ESI / health",        rate: 0.0075 },
];
const round2 = (n) => Math.round(n * 100) / 100;
const breakdown = (basic) => {
  const b = Number(basic) || 0;
  const allowances = Object.fromEntries(ALLOWANCES.map((a) => [a.key, round2(b * a.rate)]));
  const deductions = Object.fromEntries(DEDUCTIONS.map((d) => [d.key, round2(b * d.rate)]));
  const sum = (o) => Object.values(o).reduce((n, v) => n + v, 0);
  return { allowances, deductions, totalAllow: sum(allowances), totalDeduct: sum(deductions), net: round2(b + sum(allowances) - sum(deductions)) };
};
const sumObj = (o) => Object.values(o || {}).reduce((n, v) => n + (Number(v) || 0), 0);
const inr = (n) => { const v = Number(n) || 0; return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`; };
const periodKey = (s) => `${s.year}-${String(MONTHS.indexOf(s.month) + 1).padStart(2, "0")}`;

const STATUS = {
  Paid:    { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: CheckCircle2 },
  Pending: { chip: "bg-amber-50 text-amber-700 ring-amber-200",       Icon: Hourglass },
  Failed:  { chip: "bg-rose-50 text-rose-700 ring-rose-200",          Icon: XCircle },
};

const EMPTY_FORM = { employee: "", month: MONTHS[new Date().getMonth()], year: String(new Date().getFullYear()), basicPay: "" };

// Add / edit a salary
function SalaryForm({ editing, people, salaries, selfId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() =>
    editing
      ? { employee: people.find((p) => p.employeeId === editing.userId)?._id || "", month: editing.month, year: String(editing.year), basicPay: String(editing.basicPay ?? "") }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // You can't choose yourself (your own salary is set by another admin)
  const choices = people.filter((p) => p.employeeId && p.employeeId !== selfId);
  const person = people.find((p) => p._id === form.employee);
  const calc = breakdown(form.basicPay);

  // Months this person already has a salary for (except the one being edited)
  const taken = new Set(
    salaries.filter((s) => person && s.userId === person.employeeId && s._id !== editing?._id).map((s) => `${s.month}-${s.year}`)
  );
  const clash = person && taken.has(`${form.month}-${form.year}`);
  const years = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - 2 + i));

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (!person) return setError("Choose an employee.");
    if (!(Number(form.basicPay) > 0)) return setError("Enter the basic pay.");
    if (clash) return setError(`${person.name} already has a salary for ${form.month} ${form.year}.`);
    setSaving(true);
    try {
      const body = {
        userId: person.employeeId, month: form.month, year: Number(form.year),
        basicPay: Number(form.basicPay), allowances: calc.allowances, deductions: calc.deductions,
      };
      if (editing) await api.put(`/salary/${editing._id}`, body);
      else await api.post("/salary", body);
      toast.success(editing ? "Salary updated." : `Salary added for ${person.name}.`);
      onSaved();
    } catch (err) {
      setError(!err?.response ? "Can't reach the server — make sure the backend is running." : err.response.data?.error || "Couldn't save the salary.");
    } finally {
      setSaving(false);
    }
  };

  const fieldCls = "h-10 w-full rounded-xl border border-gray-200 bg-gray-50/70 px-3 text-sm text-gray-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="animate-dialog-in flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="h-1 flex-shrink-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-blue-500" />
        <div className="flex items-start gap-3 px-6 pt-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-indigo-50"><IndianRupee className="h-5 w-5 text-indigo-600" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit salary" : "Add salary"}</h2>
            <p className="text-sm text-gray-500">Allowances, deductions and net pay are worked out from the basic pay.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Who & when */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">Employee</p>
              <PersonPicker people={choices} value={form.employee} onChange={(id) => set({ employee: id })}
                allowAll={false} placeholder="Choose an employee" disabled={!!editing} full />
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">Month</p>
              <select value={form.month} onChange={(e) => set({ month: e.target.value })} className={`${fieldCls} pr-8`}>
                {MONTHS.map((m) => <option key={m} value={m} disabled={taken.has(`${m}-${form.year}`)}>{m}{taken.has(`${m}-${form.year}`) ? " — added" : ""}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">Year</p>
              <select value={form.year} onChange={(e) => set({ year: e.target.value })} className={`${fieldCls} pr-8`}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          {clash && <p className="-mt-3 text-xs text-amber-600">{person.name} already has a salary for {form.month} {form.year}.</p>}

          {/* Basic pay */}
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">Basic pay (monthly)</p>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">₹</span>
              <input type="number" min="0" step="1" inputMode="numeric" value={form.basicPay} onChange={(e) => set({ basicPay: e.target.value })}
                placeholder="e.g. 60000" className={`${fieldCls} h-11 pl-8 text-base font-semibold`} autoFocus={!!editing} />
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Allowances · + {inr(calc.totalAllow)}</p>
              <ul className="mt-2 space-y-1.5 text-xs">
                {ALLOWANCES.map((a) => (
                  <li key={a.key} className="flex justify-between gap-2">
                    <span className="text-gray-600">{a.label} <span className="text-gray-400">{a.rate * 100}%</span></span>
                    <span className="font-semibold tabular-nums text-gray-800">{inr(calc.allowances[a.key])}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700">Deductions · − {inr(calc.totalDeduct)}</p>
              <ul className="mt-2 space-y-1.5 text-xs">
                {DEDUCTIONS.map((d) => (
                  <li key={d.key} className="flex justify-between gap-2">
                    <span className="text-gray-600">{d.label} <span className="text-gray-400">{d.rate * 100}%</span></span>
                    <span className="font-semibold tabular-nums text-gray-800">{inr(calc.deductions[d.key])}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-gray-900 px-5 py-4">
            <span className="text-sm font-medium text-gray-400">Net pay</span>
            <span className="text-2xl font-bold tabular-nums text-white">{inr(calc.net)}</span>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Add salary"}
          </button>
        </div>
      </form>
    </div>
  );
}

const Salary = () => {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const selfId = user?.employeeId;

  const [salaries, setSalaries] = useState(getCache("salaries") || []);
  const [people, setPeople]     = useState([]);
  const [loading, setLoading]   = useState(!getCache("salaries"));
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");
  const [status, setStatus]     = useState("all");
  const [period, setPeriod]     = useState("all");
  const [form, setForm]         = useState(null); // null | { editing: record | null }
  const [busyId, setBusyId]     = useState(null);

  const fetchSalaries = async () => {
    try {
      const { data } = await api.get("/salary");
      setSalaries(data);
      setCache("salaries", data);
      setError(null);
    } catch (err) {
      if (!getCache("salaries")) setError(!err?.response ? "Can't reach the server — make sure the backend is running." : "Couldn't load salaries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaries();
    api.get("/users").then((r) => setPeople(Array.isArray(r.data) ? r.data : [])).catch(() => setPeople([]));
  }, []);

  const byEmpId = useMemo(() => Object.fromEntries(people.map((p) => [p.employeeId, p])), [people]);

  // Month chips (newest first) from the records themselves
  const periods = useMemo(() => {
    const seen = new Map();
    salaries.forEach((s) => seen.set(periodKey(s), `${s.month.slice(0, 3)} ${s.year}`));
    return [...seen.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [salaries]);

  const q = search.trim().toLowerCase();
  const inPeriod = salaries.filter((s) => period === "all" || periodKey(s) === period);
  const visible = inPeriod
    .filter((s) => status === "all" || s.status === status)
    .filter((s) => !q || [s.userName, s.userEmail, s.userId].some((v) => (v || "").toLowerCase().includes(q)))
    .sort((a, b) => periodKey(b).localeCompare(periodKey(a)) || (a.userName || "").localeCompare(b.userName || ""));

  const count = (st) => inPeriod.filter((s) => s.status === st).length;
  const totalNet = inPeriod.reduce((n, s) => n + (Number(s.netPay) || 0), 0);
  const paidNet = inPeriod.filter((s) => s.status === "Paid").reduce((n, s) => n + (Number(s.netPay) || 0), 0);
  const periodLabel = period === "all" ? "all months" : periods.find(([k]) => k === period)?.[1];

  const setStatusOf = async (s, next) => {
    setBusyId(s._id);
    try {
      await api.patch(`/salary/${s._id}/status`, { status: next });
      toast.success(`${s.userName}'s ${s.month} salary marked ${next.toLowerCase()}.`);
      fetchSalaries();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Couldn't update the status.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (s) => {
    const ok = await confirm({
      tone: "danger",
      title: "Delete this salary?",
      message: `${s.userName}'s salary for ${s.month} ${s.year} will be permanently deleted.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    setBusyId(s._id);
    try {
      await api.delete(`/salary/${s._id}`);
      toast.success("Salary deleted.");
      fetchSalaries();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Couldn't delete the salary.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = (st) => setStatus((cur) => (cur === st ? "all" : st));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Salary</h1>
          <p className="mt-1 text-sm text-gray-500">Monthly salaries for every employee. Your own salary is managed by another admin.</p>
        </div>
        <div className="flex w-full items-center gap-3 md:w-auto">
          <div className="flex w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50 md:w-72">
            <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID or email…"
              className="w-full min-w-0 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100"><X className="h-3.5 w-3.5" /></button>}
          </div>
          <button type="button" onClick={() => setForm({ editing: null })}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-gray-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900">
            <Plus className="h-4 w-4" /> Add salary
          </button>
        </div>
      </div>

      {/* Tiles */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile tone="violet" Icon={Wallet} label="Net payroll" value={loading ? "—" : inr(totalNet)}
          sub={`${inPeriod.length} ${inPeriod.length === 1 ? "salary" : "salaries"} · ${periodLabel}`}
          active={status === "all"} onClick={() => setStatus("all")} />
        <StatTile tone="emerald" Icon={CheckCircle2} label="Paid" value={loading ? "—" : count("Paid")}
          sub={`${inr(paidNet)} paid out`} active={status === "Paid"} onClick={() => toggleStatus("Paid")} />
        <StatTile tone="amber" Icon={Hourglass} label="Pending" value={loading ? "—" : count("Pending")}
          sub={count("Pending") ? "waiting to be paid" : "nothing waiting"} active={status === "Pending"} onClick={() => toggleStatus("Pending")} />
        <StatTile tone="rose" Icon={AlertTriangle} label="Failed" value={loading ? "—" : count("Failed")}
          sub={count("Failed") ? "need another try" : "no failed payments"} active={status === "Failed"} onClick={() => toggleStatus("Failed")} />
      </div>

      {/* Month chips */}
      {periods.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Month</span>
          {[["all", "All months"], ...periods].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)} aria-pressed={period === k}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${period === k ? "bg-gray-800 text-white" : "bg-white text-gray-500 ring-1 ring-gray-200 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-gray-50/80">
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <th className="px-5 py-3">Employee</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Basic</th>
                <th className="px-4 py-3 text-right">Allowances</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net pay</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-3.5"><div className="flex items-center gap-2.5"><div className="h-8 w-8 rounded-full bg-gray-100" /><div className="h-3.5 w-28 rounded bg-gray-100" /></div></td>
                    {Array.from({ length: 7 }, (_, j) => <td key={j} className="px-4 py-3.5"><div className="ml-auto h-3.5 w-16 rounded bg-gray-100" /></td>)}
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan="8" className="px-5 py-12 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-red-300" />
                  <p className="mt-2 text-sm font-medium text-gray-700">{error}</p>
                  <button type="button" onClick={() => { setLoading(true); fetchSalaries(); }} className="mt-3 text-xs font-semibold text-indigo-600 hover:underline">Try again</button>
                </td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan="8" className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><ReceiptIndianRupee className="h-6 w-6 text-gray-300" /></div>
                  <p className="mt-3 text-sm font-medium text-gray-700">{salaries.length ? "No salaries match" : "No salaries yet"}</p>
                  {salaries.length > 0 ? (
                    <button type="button" onClick={() => { setSearch(""); setStatus("all"); setPeriod("all"); }} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Clear filters</button>
                  ) : (
                    <button type="button" onClick={() => setForm({ editing: null })} className="mt-2 text-xs font-semibold text-indigo-600 hover:underline">Add the first salary</button>
                  )}
                </td></tr>
              ) : (
                visible.map((s) => {
                  const mine = !!selfId && s.userId === selfId;
                  const person = byEmpId[s.userId];
                  const st = STATUS[s.status] || STATUS.Pending;
                  const busy = busyId === s._id;
                  return (
                    <tr key={s._id} className={`transition hover:bg-gray-50/70 ${mine ? "bg-indigo-50/30" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <PersonAvatar person={person} name={s.userName} size={32} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-800">
                              {s.userName}
                              {mine && <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-indigo-600">You</span>}
                            </p>
                            <p className="truncate text-[11px] text-gray-400">{[s.userId, s.userEmail].filter(Boolean).join(" · ")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-sm"><span className="font-medium text-gray-800">{s.month}</span> <span className="text-gray-400">{s.year}</span></td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm tabular-nums text-gray-700">{inr(s.basicPay)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm tabular-nums text-emerald-700">+ {inr(sumObj(s.allowances))}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm tabular-nums text-rose-600">− {inr(sumObj(s.deductions))}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-bold tabular-nums text-gray-900">{inr(s.netPay)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${st.chip}`}>
                          {st.Icon && <st.Icon className="h-3.5 w-3.5" />} {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {mine ? (
                          <span className="flex items-center justify-end gap-1 text-[11px] text-gray-400" title="Your own salary is managed by another admin">
                            <Lock className="h-3.5 w-3.5" /> Managed by another admin
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-0.5">
                            <button type="button" onClick={() => setForm({ editing: s })} disabled={busy} title="Edit" aria-label="Edit"
                              className="rounded-full p-1.5 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40"><Pencil className="h-4 w-4" /></button>
                            {s.status !== "Paid" && (
                              <button type="button" onClick={() => setStatusOf(s, "Paid")} disabled={busy} title="Mark as paid" aria-label="Mark as paid"
                                className="rounded-full p-1.5 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40"><CheckCircle2 className="h-4 w-4" /></button>
                            )}
                            {s.status !== "Failed" && (
                              <button type="button" onClick={() => setStatusOf(s, "Failed")} disabled={busy} title="Mark as failed" aria-label="Mark as failed"
                                className="rounded-full p-1.5 text-gray-400 transition hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40"><XCircle className="h-4 w-4" /></button>
                            )}
                            <button type="button" onClick={() => remove(s)} disabled={busy} title="Delete" aria-label="Delete"
                              className="rounded-full p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && !error && visible.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{visible.length}</span> of {salaries.length} {salaries.length === 1 ? "salary" : "salaries"}
          </div>
        )}
      </div>

      {form && (
        <SalaryForm
          editing={form.editing}
          people={people}
          salaries={salaries}
          selfId={selfId}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); fetchSalaries(); }}
        />
      )}
    </div>
  );
};

export default Salary;
