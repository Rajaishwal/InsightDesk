import express from 'express';
import { getProjectTasks, addProjectTask, updateTaskStatus, startTimer, stopTimer } from '../controllers/projectTaskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:projectId', protect, getProjectTasks);
router.post('/:projectId', protect, addProjectTask);
router.put('/:taskId/status', protect, updateTaskStatus);
router.post('/:taskId/timer/start', protect, startTimer);
router.post('/:taskId/timer/stop',  protect, stopTimer);

export default router;