import express from "express";
import Salary from "../model/Salary.js";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { userId, month, year } = req.body;

    // if (req.body.userId === userId) {
    //   return res.status(403).json({ error: "HR cannot create salary for themselves." });
    // }


    // Check if salary already exists before inserting
    const existing = await Salary.findOne({ userId, month, year });
    if (existing) {
      return res.status(409).json({
        error: `Salary for ${userId} in ${month} ${year} already exists.`,
      });
    }

    const salary = new Salary(req.body);
    await salary.save();
    res.status(201).json(salary);
  } catch (err) {
    if (err.code === 11000) {
      // Fallback in case duplicate slips through
      return res.status(409).json({
        error: "Duplicate salary record. Salary for this employee/month/year already exists.",
      });
    }
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   GET /api/salary
 * @desc    Get all salaries
 * @access  Admin / HR
 */
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    let query = {};
    if (userId) query.userId = userId;
    const salaries = await Salary.find(query).sort({ createdAt: -1 });
    res.json(salaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// // GET /api/salary/user/:userId
// router.get('/user/:userId', async (req, res) => {
//   try {
//     const payslips = await Salary.find({ userId: req.params.userId });
//     if (!payslips) return res.status(404).json({ error: "Salary not found for this employeeId" });
//     // Always return an array, even if empty
//     return res.status(200).json(payslips);
//   } catch (err) {
//     return res.status(500).json({ error: 'Server error' });
//   }
// });


// GET /api/salary/user/:userId
router.get('/user/:userId', async (req, res) => {
  try {
    const payslips = await Salary.find({ userId: req.params.userId });

    if (!payslips || payslips.length === 0) {
      return res.status(200).json([]); // Always return an empty array instead of 404
    }

    return res.status(200).json(payslips);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});



/**
 * @route   PUT /api/salary/:id
 * @desc    Update salary record
 * @access  Admin / HR
 */
router.put("/:id", async (req, res) => {
  try {
    const updatedSalary = await Salary.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedSalary) return res.status(404).json({ error: "Salary record not found" });
    res.json(updatedSalary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   PATCH /api/salary/:id/status
 * @desc    Update salary status (Processed / Paid / Failed)
 * @access  Admin / HR
 */
router.patch("/:id/status", async (req, res) => {
  try {
    const { status, processedBy } = req.body;
    const updatedSalary = await Salary.findByIdAndUpdate(
      req.params.id,
      {
        status,
        processedBy,
        processedAt: new Date(),
      },
      { new: true }
    );
    if (!updatedSalary) return res.status(404).json({ error: "Salary record not found" });
    res.json(updatedSalary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   DELETE /api/salary/:id
 * @desc    Delete salary record
 * @access  Admin / HR
 */
router.delete("/:id", async (req, res) => {
  try {
    const deletedSalary = await Salary.findByIdAndDelete(req.params.id);
    if (!deletedSalary) return res.status(404).json({ error: "Salary record not found" });
    res.json({ message: "Salary record deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;