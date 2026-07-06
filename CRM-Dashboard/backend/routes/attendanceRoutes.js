// routes/attendanceRoutes.js
import express from "express";
import { 
  checkIn, 
  checkOut, 
  getAllAttendance, 
  getTodayStatus, 
  getUserAttendance,
  getAttendanceStatus
} from "../controllers/attendanceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Check-in and Check-out routes
router.post("/checkin", protect, checkIn);
router.post("/checkout", protect, checkOut);

// Get attendance records
router.get("/logs", protect, getAllAttendance);
router.get("/status/:userId", protect, getTodayStatus);
router.get("/status/:userId/:date", protect, getAttendanceStatus);
router.get("/user/:userId", protect, getUserAttendance);

export default router;
