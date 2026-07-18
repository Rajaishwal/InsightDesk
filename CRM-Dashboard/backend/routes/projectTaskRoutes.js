import express from 'express';
import {
  getProjectTasks, addProjectTask, updateTaskStatus,
  startTimer, stopTimer, getProjectStats,
} from '../controllers/projectTaskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Must be before /:projectId so "stats" isn't treated as a projectId
router.get('/stats/all', protect, getProjectStats);

router.get('/:projectId', protect, getProjectTasks);
router.post('/:projectId', protect, addProjectTask);
router.put('/:taskId/status', protect, updateTaskStatus);
router.post('/:taskId/timer/start', protect, startTimer);
router.post('/:taskId/timer/stop',  protect, stopTimer);

export default router;