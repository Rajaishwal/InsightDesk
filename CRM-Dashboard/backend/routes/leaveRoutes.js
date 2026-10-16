import express from 'express';
import {
  applyLeave,
  getUserLeaves,
  updateLeaveStatus,
  getLeaveStats,
  getAllLeaveRequests,
  getHRLeaveStats,
  getLeaveEmployees,
  cancelLeave,
} from '../controllers/leaveController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply for leave
router.post('/apply', protect, applyLeave);

// Get current user's leaves
router.get('/my-leaves', protect, getUserLeaves);

// Get leave statistics for current user
router.get('/stats', protect, getLeaveStats);

// HR-specific routes
router.get('/hr/all-requests', protect, getAllLeaveRequests);
router.get('/hr/stats', protect, getHRLeaveStats);
router.get('/hr/employees', protect, getLeaveEmployees); // one entry per employee (HR leave view)
router.put('/hr/status/:leaveId', protect, updateLeaveStatus);

// Cancel a pending leave (employee)
router.delete('/cancel/:leaveId', protect, cancelLeave);

export default router;
