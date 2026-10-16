// /api/salary — salary records (one per employee per month).
// Every route needs a login. Managing salaries is admin-only, and an admin can never create, edit, mark or delete
// their OWN salary (another admin has to). Anyone can read their own records via GET /me (the Payslips page).
// `userId` on a record is the employee's current Employee ID (e.g. IDE002); name & email are copied from the user.
import express from "express";
import Salary from "../model/Salary.js";
import User from "../model/User.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

const SELF_MSG = "You can't create or change your own salary — another admin has to do it.";
const isSelf = (req, employeeId) => !!req.user.employeeId && String(employeeId) === String(req.user.employeeId);
const STATUSES = ["Pending", "Paid", "Failed"];

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

// POST /api/salary — add a month's salary for an employee (admin, not for yourself)
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

    const salary = new Salary({ ...pickFields(req.body), userId, userName: employee.name, userEmail: employee.email });
    await salary.save(); // net pay is worked out in the model
    res.status(201).json(salary);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "This employee already has a salary for that month." });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/salary/:id — edit a record (admin, not your own)
router.put("/:id", admin, async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id);
    if (!salary) return res.status(404).json({ error: "Salary record not found" });
    if (isSelf(req, salary.userId)) return res.status(403).json({ error: SELF_MSG });

    // Moving the record to another employee
    if (req.body.userId && req.body.userId !== salary.userId) {
      if (isSelf(req, req.body.userId)) return res.status(403).json({ error: SELF_MSG });
      const employee = await User.findOne({ employeeId: req.body.userId }).select("name email").lean();
      if (!employee) return res.status(404).json({ error: `No employee has the ID ${req.body.userId}.` });
      Object.assign(salary, { userId: req.body.userId, userName: employee.name, userEmail: employee.email });
    }

    Object.assign(salary, pickFields(req.body));
    await salary.save(); // save (not findByIdAndUpdate) so net pay is recalculated
    res.json(salary);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "This employee already has a salary for that month." });
    }
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/salary/:id/status — Pending / Paid / Failed (admin, not your own)
router.patch("/:id/status", admin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "Status must be Pending, Paid or Failed." });
    const salary = await Salary.findById(req.params.id);
    if (!salary) return res.status(404).json({ error: "Salary record not found" });
    if (isSelf(req, salary.userId)) return res.status(403).json({ error: SELF_MSG });

    salary.status = status;
    salary.processedBy = req.user.employeeId || String(req.user._id);
    salary.processedAt = new Date();
    if (status === "Paid") salary.paymentDate = salary.paymentDate || new Date();
    await salary.save();
    res.json(salary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/salary/:id (admin, not your own)
router.delete("/:id", admin, async (req, res) => {
  try {
    const salary = await Salary.findById(req.params.id);
    if (!salary) return res.status(404).json({ error: "Salary record not found" });
    if (isSelf(req, salary.userId)) return res.status(403).json({ error: SELF_MSG });
    await salary.deleteOne();
    res.json({ message: "Salary record deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
