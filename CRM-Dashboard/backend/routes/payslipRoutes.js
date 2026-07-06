import express from 'express';
const router = express.Router();
import Payslip from '../model/Payslip.js'; // Adjust path/model name as needed

// PATCH /api/payslips/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const payslip = await Payslip.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!payslip) return res.status(404).json({ error: 'Payslip not found' });
    return res.status(200).json(payslip);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payslips/user/:employeeId
router.get('/user/:employeeId', async (req, res) => {
  try {
    const payslips = await Payslip.find({ employeeId: req.params.employeeId });
    // Always return an array, even if empty
    return res.status(200).json(payslips);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
