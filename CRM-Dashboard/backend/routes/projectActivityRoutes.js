import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getProjectActivity } from '../controllers/projectActivityController.js';

const router = express.Router();

router.get('/', protect, getProjectActivity);

export default router;