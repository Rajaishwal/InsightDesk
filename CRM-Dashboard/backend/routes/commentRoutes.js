import express from 'express';
import { addComment, getComments } from '../controllers/commentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Add a comment to a task
router.post('/', protect, addComment);

// Get all comments for a task
router.get('/:taskId', protect, getComments);

export default router;
