import express from "express";
import {
  getTasksByUserId,
} from "../controllers/taskController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 👉 Get tasks by specific user ID (for HR)
router.get("/user/:userId", protect, getTasksByUserId);

export default router;
