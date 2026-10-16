// routes/attendanceRoutes.js
import express from "express";
import {
  checkIn,
  checkOut,
  getAllAttendance,
  getTodayStatus,
} from "../controllers/attendanceController.js";
import { protect, hrOrAdmin, selfOrAdmin, asSelf } from "../middleware/authMiddleware.js";

const router = express.Router();

// Always for the logged-in user, whatever userId the request sends
router.post("/checkin", protect, asSelf, checkIn);
router.post("/checkout", protect, asSelf, checkOut);

router.get("/logs", protect, hrOrAdmin, getAllAttendance);
router.get("/status/:userId", protect, selfOrAdmin("userId"), getTodayStatus);

export default router;
