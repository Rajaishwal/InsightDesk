import express from 'express';
import {
  getProjectTasks,
  addProjectTask,
  updateTaskStatus,
  startTimer,
  stopTimer,
  getProjectStats,
  getMyTodayTime,
  getActiveTimers,
  getWorkLog,
} from '../controllers/projectTaskController.js';
import { protect, hrOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Must be before /:projectId so literals aren't treated as a projectId
router.get('/stats/all',              protect, hrOrAdmin, getProjectStats);
router.get('/my-time-today',          protect, getMyTodayTime);
router.get('/active-timers',          protect, hrOrAdmin, getActiveTimers);
router.get('/work-log',               protect, hrOrAdmin, getWorkLog);

// Project team members (or an admin) only — checked in the controller
router.get('/:projectId', protect, getProjectTasks);
router.post('/:projectId', protect, addProjectTask);
router.put('/:taskId/status', protect, updateTaskStatus);
router.post('/:taskId/timer/start', protect, startTimer);
router.post('/:taskId/timer/stop',  protect, stopTimer);

export default router;