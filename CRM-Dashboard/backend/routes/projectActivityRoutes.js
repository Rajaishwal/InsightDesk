import express from 'express';
import { protect, hrOrAdmin } from '../middleware/authMiddleware.js';
import { getProjectActivity } from '../controllers/projectActivityController.js';

const router = express.Router();

router.get('/', protect, hrOrAdmin, getProjectActivity);

export default router;