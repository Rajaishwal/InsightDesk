import express from 'express';
import {
  applyLeave,
  getUserLeaves,
  getAllLeaves,
  updateLeaveStatus,
  getLeaveStats,
  getAllLeaveRequests,
  getHRLeaveStats,
  processMonthlyCarryForward,
  getMonthlyAllocation
} from '../controllers/leaveController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply for leave
router.post('/apply', protect, applyLeave);

// Get current user's leaves
router.get('/my-leaves', protect, getUserLeaves);

// Get leave statistics for current user
router.get('/stats', protect, getLeaveStats);

// Get monthly allocation details for current user
router.get('/monthly-allocation', protect, getMonthlyAllocation);

// Get all leaves (HR/Admin only)
router.get('/all', protect, getAllLeaves);

// HR-specific routes
router.get('/hr/all-requests', protect, getAllLeaveRequests);
router.get('/hr/stats', protect, getHRLeaveStats); 
router.put('/hr/status/:leaveId', protect, updateLeaveStatus);

// Admin routes for monthly processing
router.post('/admin/process-carry-forward', protect, processMonthlyCarryForward);

// Update leave status (HR/Admin only)
router.put('/status/:leaveId', protect, updateLeaveStatus);

export default router;
