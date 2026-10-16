import express from "express";
import { startBreak, stopBreak, getBreakLogs, getBreakStatus } from "../controllers/breakController.js";
import { protect, asSelf, selfOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Login required. You can only start / stop your own break; break logs & status are yours (or any, for an admin).
router.post("/start", protect, asSelf, startBreak);
router.post("/stop", protect, asSelf, stopBreak);
router.get("/logs/:userId", protect, selfOrAdmin("userId"), getBreakLogs);
router.get("/status/:userId", protect, selfOrAdmin("userId"), getBreakStatus);

export default router;
