import express from 'express';
import {
  getProjectTasks, addProjectTask, updateTaskStatus,
  startTimer, stopTimer, getProjectStats, getMyTodayTime,
  getActiveTimers, getAllSessions, getWorkLog,
} from '../controllers/projectTaskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Must be before /:projectId so literals aren't treated as a projectId
router.get('/stats/all',      protect, getProjectStats);
router.get('/my-time-today',  protect, getMyTodayTime);
router.get('/active-timers',  protect, getActiveTimers);
router.get('/all-sessions',   protect, getAllSessions);
router.get('/work-log',       protect, getWorkLog);

router.get('/:projectId', protect, getProjectTasks);
router.post('/:projectId', protect, addProjectTask);
router.put('/:taskId/status', protect, updateTaskStatus);
router.post('/:taskId/timer/start', protect, startTimer);
router.post('/:taskId/timer/stop',  protect, stopTimer);

export default router;