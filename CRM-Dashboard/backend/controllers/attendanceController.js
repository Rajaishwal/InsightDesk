import Attendance from "../model/Attendance.js";
import User from "../model/User.js";
import Location from "../model/Location.js";
import Break from "../models/Break.js";
import ProjectTask from "../model/ProjectTask.js";
import HRTask from "../model/hrTaskModel.js";
import { getIo } from "../socket.js";

// Check In - Create new attendance record for the day
export const checkIn = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Check if user already checked in today
    const existingAttendance = await Attendance.findOne({
      userId,
      date: today
    });

    if (existingAttendance) {
      return res.status(400).json({ 
        message: "You have already checked in today",
        attendance: existingAttendance
      });
    }

    // Create new attendance record
    const attendance = new Attendance({
      userId,
      userName: user.name,
      userEmail: user.email,
      date: today,
      checkInTime: new Date(),
      status: "checked-in"
    });

    await attendance.save();

    // Activate location tracking for this user
    try {
      await Location.updateMany(
        { userId },
        { isActive: true }
      );
    } catch (locationError) {
      console.error('Error activating location tracking:', locationError);
      // Don't fail the check-in if location activation fails
    }

    const time = new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
    });

    // Notify all connected clients that attendance data changed
    getIo()?.emit("attendance:updated");

    res.status(201).json({
      message: "Checked In Successfully",
      time,
      attendance,
      locationTrackingActivated: true
    });

  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ 
      message: "Failed to check in", 
      error: error.message 
    });
  }
};

// Check Out - Update existing attendance record
export const checkOut = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Find today's attendance record
    const attendance = await Attendance.findOne({
      userId,
      date: today,
      status: "checked-in"
    });

    if (!attendance) {
      return res.status(400).json({ 
        message: "No check-in record found for today or already checked out" 
      });
    }

    // Update check-out time and status
    attendance.checkOutTime = new Date();
    attendance.status = "checked-out";
    attendance.calculateWorkingHours();

    await attendance.save();

    const checkOutNow = new Date();

    // ── 1. Close any active break ──────────────────────────────────────────
    try {
      const activeBreaks = await Break.find({ userId, endTime: null });
      for (const br of activeBreaks) {
        const elapsed = Math.max(0, Math.round((checkOutNow - new Date(br.startTime)) / 1000));
        br.endTime = checkOutNow;
        br.durationInSeconds = elapsed;
        await br.save();
      }
    } catch (breakErr) {
      console.error('Error closing active breaks on checkout:', breakErr);
    }

    // ── 2. Stop any running ProjectTask timer ──────────────────────────────
    try {
      const activeProjTasks = await ProjectTask.find({
        timers: { $elemMatch: { userId, timerStartedAt: { $ne: null } } },
      });
      for (const task of activeProjTasks) {
        const entry = task.timers.find(
          t => t.userId.toString() === userId.toString() && t.timerStartedAt
        );
        if (!entry) continue;
        const elapsed  = Math.floor((checkOutNow - new Date(entry.timerStartedAt)) / 1000);
        const newTotal = (entry.totalTimeLogged || 0) + elapsed;
        await ProjectTask.updateOne(
          { _id: task._id, 'timers.userId': entry.userId },
          {
            $set:  { 'timers.$.timerStartedAt': null, 'timers.$.totalTimeLogged': newTotal },
            $push: { 'timers.$.sessions': { startTime: new Date(entry.timerStartedAt), endTime: checkOutNow, duration: elapsed } },
          }
        );
      }
    } catch (projErr) {
      console.error('Error stopping project task timers on checkout:', projErr);
    }

    // ── 3. Stop any running HRTask timer ──────────────────────────────────
    try {
      const activeHrTasks = await HRTask.find({
        timers: { $elemMatch: { userId, timerStartedAt: { $ne: null } } },
      });
      for (const task of activeHrTasks) {
        const entry = task.timers.find(
          t => t.userId.toString() === userId.toString() && t.timerStartedAt
        );
        if (!entry) continue;
        const elapsed  = Math.floor((checkOutNow - new Date(entry.timerStartedAt)) / 1000);
        const newTotal = (entry.totalTimeLogged || 0) + elapsed;
        await HRTask.updateOne(
          { _id: task._id, 'timers.userId': entry.userId },
          {
            $set:  { 'timers.$.timerStartedAt': null, 'timers.$.totalTimeLogged': newTotal },
            $push: { 'timers.$.sessions': { startTime: new Date(entry.timerStartedAt), endTime: checkOutNow, duration: elapsed } },
          }
        );
      }
    } catch (hrErr) {
      console.error('Error stopping HR task timers on checkout:', hrErr);
    }

    // ── 4. Deactivate location tracking ───────────────────────────────────
    try {
      await Location.updateMany({ userId }, { isActive: false });
    } catch (locationError) {
      console.error('Error deactivating location tracking:', locationError);
    }

    const time = new Date().toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
    });

    // Notify all connected clients
    const io = getIo();
    io?.emit("attendance:updated");
    io?.emit("crm:task:updated"); // Clears running timers in LiveTaskTimer & task boards

    res.status(200).json({
      message: "Checked Out Successfully",
      time,
      attendance,
      workingHours: attendance.workingHours,
      locationTrackingDeactivated: true
    });

  } catch (error) {
    console.error("Check-out error:", error);
    res.status(500).json({ 
      message: "Failed to check out", 
      error: error.message 
    });
  }
};

// Get all attendance records (for HR)
export const getAllAttendance = async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, startDate, endDate } = req.query;
    
    // Build filter object
    const filter = {};
    if (userId) filter.userId = userId;
    if (startDate && endDate) {
      filter.date = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const attendance = await Attendance.find(filter)
      .populate('userId', 'name email role')
      .sort({ date: -1, checkInTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Attendance.countDocuments(filter);

    const attendanceWithBreaks = await Promise.all(
      attendance.map(async (record) => {
        const dayStart = new Date(record.date + 'T00:00:00.000Z');
        const dayEnd = new Date(record.date + 'T23:59:59.999Z');
        const breaks = await Break.find({
          userId: record.userId,
          startTime: { $gte: dayStart, $lte: dayEnd },
          endTime: { $exists: true, $ne: null }
        });
        const totalBreakSeconds = breaks.reduce((sum, b) => sum + (b.durationInSeconds || 0), 0);
        return {
          ...record.toObject(),
          breakDurationMinutes: totalBreakSeconds > 0 ? Math.round(totalBreakSeconds / 60) : 0
        };
      })
    );

    res.status(200).json({
      attendance: attendanceWithBreaks,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecords: total
    });

  } catch (error) {
    console.error("Get attendance error:", error);
    res.status(500).json({ 
      message: "Failed to fetch attendance records", 
      error: error.message 
    });
  }
};

// Get user's attendance status for today
export const getTodayStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const attendance = await Attendance.findOne({
      userId,
      date: today
    });

    res.status(200).json({
      hasCheckedIn: !!attendance,
      hasCheckedOut: attendance?.status === "checked-out",
      attendance: attendance || null
    });

  } catch (error) {
    console.error("Get today status error:", error);
    res.status(500).json({ 
      message: "Failed to get today's status", 
      error: error.message 
    });
  }
};

// Get user's attendance history
export const getUserAttendance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 30, month, year } = req.query;

    // Build filter
    const filter = { userId };
    if (month && year) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const endDate = `${year}-${month.padStart(2, '0')}-31`;
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(filter)
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Attendance.countDocuments(filter);

    res.status(200).json({
      attendance,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecords: total
    });

  } catch (error) {
    console.error("Get user attendance error:", error);
    res.status(500).json({ 
      message: "Failed to fetch user attendance", 
      error: error.message 
    });
  }
};

// Get attendance status for a specific user and date
export const getAttendanceStatus = async (req, res) => {
  try {
    const { userId, date } = req.params;
    
    const attendance = await Attendance.findOne({
      userId,
      date
    });

    if (!attendance) {
      return res.status(200).json({
        hasCheckedIn: false,
        hasCheckedOut: false,
        attendance: null
      });
    }

    res.status(200).json({
      hasCheckedIn: !!attendance.checkInTime,
      hasCheckedOut: !!attendance.checkOutTime,
      attendance
    });

  } catch (error) {
    console.error("Get attendance status error:", error);
    res.status(500).json({ 
      message: "Failed to get attendance status", 
      error: error.message 
    });
  }
};