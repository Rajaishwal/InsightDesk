import express from 'express';
import User from '../model/User.js';

const router = express.Router();

// GET /api/user/by-employee-id/:empId
router.get('/by-employee-id/:empId', async (req, res) => {
  try {
    const user = await User.findOne({ employeeId: req.params.empId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ name: user.name, email: user.email, employeeId: user.employeeId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
