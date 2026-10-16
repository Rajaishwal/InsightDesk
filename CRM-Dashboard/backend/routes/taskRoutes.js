import express from "express";
import {
  getTasksByUserId,
} from "../controllers/taskController.js";
import { protect, selfOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/user/:userId", protect, selfOrAdmin("userId"), getTasksByUserId);

export default router;
