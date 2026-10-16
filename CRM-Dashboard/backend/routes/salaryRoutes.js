// /api/salary — salary records (one per employee per month).
// Every route needs a login. Managing salaries is admin-only, and an admin can never create, mark or delete their
// OWN salary (another admin has to). Anyone can read their own records via GET /me (the Payslips page).
// Adding a salary sends it straight away (status Paid); its employee then confirms receipt (PATCH /:id/receipt):
// "Received" locks the record for good, "Not received" opens a Payroll support ticket. There's no editing — a wrong
// salary is deleted and added again. Every change is pushed live as "salary:updated".
// `userId` on a record is the employee's current Employee ID (e.g. IDE002); name & email are copied from the user.
import express from "express";
import Salary from "../model/Salary.js";
import User from "../model/User.js";
import Ticket from "../model/Ticket.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import { getIo } from "../socket.js";

const router = express.Router();
router.use(protect);

const SELF_MSG = "You can't create or change your own salary — another admin has to do it.";
const isSelf = (req, employeeId) => !!req.user.employeeId && String(employeeId) === String(req.user.employeeId);
const STATUSES = ["Pending", "Paid", "Failed"];

// Confirmed as received by the employee → nobody can change or delete it any more
const isLocked = (s) => s.receipt?.status === "Received";
const lockMsg = (s) => `${s.userName} confirmed receiving this salary — it can't be changed or deleted any more.`;

const inr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDay = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

// Tell every open page (admin list, employee payslips, sidebar badge) to refresh
const notify = (salary) => getIo()?.emit("salary:updated", { id: String(salary._id), employeeId: salary.userId });

// Add an update to the salary's "Salary Not Received" ticket (unless it's closed); optionally move its status.
// Returns the ticket, or null when there's no usable one.
const updateTicket = async (ticketId, user, message, status) => {
  if (!ticketId) return null;
  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket || ticket.status === "Closed") return null;
  ticket.replies.push({ authorId: user._id, authorName: user.name, authorRole: user.role, message });
  if (status) ticket.status = status;
  await ticket.save();
  if (user.role === "admin") {
    getIo()?.to(String(ticket.userId)).emit("ticket:reply", { ticketId: ticket._id, ticketRef: ticket.ticketId, authorName: user.name });
  }
  return ticket;
};

// Only these fields can be written from the form
const pickFields = (body) => {
  const out = {};
  for (const k of ["basicPay", "allowances", "deductions", "month", "year", "remarks"]) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
};

// GET /api/salary/me — my own salary records, newest first
router.get("/me", async (req, res) => {
  try {
    if (!req.user.employeeId) return res.json([]);
    const rows = await Salary.find({ userId: req.user.employeeId }).sort({ year: -1, createdAt: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/salary/user/:userId — one person's records (admin, or yourself)
router.get("/user/:userId", async (req, res) => {
  try {
    if (req.user.role !== "admin" && !isSelf(req, req.params.userId)) {
      return res.status(403).json({ error: "You can only see your own payslips." });
    }
    const rows = await Salary.find({ userId: req.params.userId }).sort({ year: -1, createdAt: -1 });
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/salary — all records, optional ?userId= (admin)
router.get("/", admin, async (req, res) => {
  try {
    const query = req.query.userId ? { userId: req.query.userId } : {};
    const rows = await Salary.find(query).sort({ createdAt: -1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/salary — add a month's salary for an employee and send it to them (admin, not for yourself)
router.post("/", admin, async (req, res) => {
  try {
    const { userId, month, year } = req.body;
    if (!userId) return res.status(400).json({ error: "Choose an employee." });
    if (isSelf(req, userId)) return res.status(403).json({ error: SELF_MSG });

    const employee = await User.findOne({ employeeId: userId }).select("name email employeeId").lean();
    if (!employee) return res.status(404).json({ error: `No employee has the ID ${userId}.` });

    if (await Salary.findOne({ userId, month, year })) {
      return res.status(409).json({ error: `${employee.name} already has a salary for ${month} ${year}.` });
    }

    const now = new Date();
    const salary = new Salary({
      ...pickFields(req.body), userId, userName: employee.name, userEmail: employee.email,
      // Sent right away — the employee is asked to confirm it arrived
      status: "Paid", paymentDate: now, processedAt: now, processedBy: req.user.employeeId || String(req.user._id),
    });
    await salary.save(); // net pay is worked out in the model
    notify(salary);
    res.status(201).json(salary);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "This employee already has a salary for that month." });
    }
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/salary/:id/status — Paid (= send / send again) or Failed (admin, not your own, not once confirmed
// received). Changing the status — or sending again after the employee reported "Not received" — clears that report,
// so the employee is asked to confirm again. ("Pending" only exists on salaries added before they were sent automatically.)
router.patch("/:id/status", admin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "Status must be Pending, Paid or Failed." });
    const salary = await Salary.findById(req.params.id);
    if (!salary) return res.status(404).json({ error: "Salary record not found" });
    if (isSelf(req, salary.userId)) return res.status(403).json({ error: SELF_MSG });
    if (isLocked(salary)) return res.status(409).json({ error: lockMsg(salary) });

    const changed = salary.status !== status;
    const resent = status === "Paid" && salary.receipt?.status === "Not received";
    if (!changed && !resent) return res.json(salary);

    const now = new Date();
    const ticketId = salary.receipt?.ticketId; // the employee's "not received" ticket stays linked
    salary.status = status;
    salary.processedBy = req.user.employeeId || String(req.user._id);
    salary.processedAt = now;
    if (status === "Paid") salary.paymentDate = now;
    if (salary.receipt?.status || ticketId) salary.receipt = ticketId ? { ticketId } : undefined;
    await salary.save();

    // Keep the employee's ticket in the loop
    await updateTicket(ticketId, req.user, status === "Paid"
      ? `Payroll sent your ${salary.month} ${salary.year} salary again on ${fmtDay(now)}. Please confirm on your Payslips page once it arrives.`
      : `Payroll marked your ${salary.month} ${salary.year} salary payment as failed — it will be sent again.`, "In Progress");
    notify(salary);
    res.json(salary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/salary/:id/receipt — the employee confirms the money arrived ({ received: true })
// or reports it didn't ({ received: false, note }). Own salary only, and only once it's Paid.
router.patch("/:id/receipt", async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id);
    if (!salary) return res.status(404).json({ error: "Salary record not found" });
    if (!isSelf(req, salary.userId)) return res.status(403).json({ error: "You can only confirm your own salary." });
    if (salary.status !== "Paid") return res.status(400).json({ error: "You can confirm once payroll marks this salary as paid." });
    if (isLocked(salary)) return res.status(409).json({ error: "You've already confirmed receiving this salary." });

    const note = String(req.body.note || "").trim().slice(0, 300);
    const period = `${salary.month} ${salary.year}`;

    if (req.body.received === true) {
      const ticketId = salary.receipt?.ticketId;
      salary.receipt = { status: "Received", at: new Date(), ...(note ? { note } : {}), ...(ticketId ? { ticketId } : {}) };
      // It arrived after all — close the loop on the "not received" ticket
      await updateTicket(ticketId, req.user, `Update: my ${period} salary has arrived — I've confirmed it on the Payslips page.`, "Resolved");
    } else if (req.body.received === false) {
      if (salary.receipt?.status === "Not received") {
        return res.status(409).json({ error: `You've already reported this — see ticket ${salary.receipt.ticketId}.` });
      }
      // Reported before and sent again, but still missing → reopen the same ticket instead of opening another
      const reopened = await updateTicket(salary.receipt?.ticketId, req.user,
        `Still not received after it was sent again${salary.paymentDate ? ` on ${fmtDay(salary.paymentDate)}` : ""}.${note ? `\n\n${note}` : ""}`, "Open");
      if (reopened) {
        salary.receipt = { status: "Not received", at: new Date(), ...(note ? { note } : {}), ticketId: reopened.ticketId };
        await salary.save();
        notify(salary);
        return res.json(salary);
      }
      const ticket = await Ticket.create({
        userId: req.user._id,
        userName: req.user.name,
        userEmail: req.user.email,
        userEmployeeId: req.user.employeeId || "",
        category: "Payroll",
        problem: "Salary Not Received",
        priority: "High",
        description: `My salary for ${period} (net pay ${inr(salary.netPay)}) is marked as paid${salary.paymentDate ? ` on ${fmtDay(salary.paymentDate)}` : ""}, but I haven't received it.${note ? `\n\n${note}` : ""}`,
      });
      getIo()?.emit("ticket:new", { ticketId: ticket.ticketId, userName: ticket.userName, category: ticket.category, priority: ticket.priority });
      salary.receipt = { status: "Not received", at: new Date(), ...(note ? { note } : {}), ticketId: ticket.ticketId };
    } else {
      return res.status(400).json({ error: "Say whether you received it." });
    }

    await salary.save();
    notify(salary);
    res.json(salary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/salary/:id (admin, not your own, not once confirmed received)
router.delete("/:id", admin, async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id);
    if (!salary) return res.status(404).json({ error: "Salary record not found" });
    if (isSelf(req, salary.userId)) return res.status(403).json({ error: SELF_MSG });
    if (isLocked(salary)) return res.status(409).json({ error: lockMsg(salary) });
    await salary.deleteOne();
    notify(salary);
    res.json({ message: "Salary record deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
