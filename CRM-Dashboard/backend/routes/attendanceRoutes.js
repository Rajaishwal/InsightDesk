// routes/attendanceRoutes.js
import express from "express";
import {
  checkIn,
  checkOut,
  getAllAttendance,
  getTodayStatus,
} from "../controllers/attendanceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Check-in and Check-out routes
router.post("/checkin", protect, checkIn);
router.post("/checkout", protect, checkOut);

// Get attendance records
router.get("/logs", protect, getAllAttendance);
router.get("/status/:userId", protect, getTodayStatus);

export default router;
