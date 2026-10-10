import Attendance from "../model/Attendance.js";
import User from "../model/User.js";
import Location from "../model/Location.js";
import Break from "../models/Break.js";
import ProjectTask from "../model/ProjectTask.js";
import HRTask from "../model/hrTaskModel.js";
import { getIo } from "../socket.js";
import { istDateKey, istDayEnd, findOpenAttendance, OPEN_SESSION_MAX_HOURS } from "../utils/istDate.js";

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

    // Today's date in India time (YYYY-MM-DD)
    const today = istDateKey();

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

    // The open session — may have started before midnight
    const attendance = await findOpenAttendance(Attendance, userId);

    if (!attendance) {
      return res.status(400).json({ 
        message: "No check-in record found for today or already checked out"
      });
    }

    // Checkout requires a clean state — no running task timer, no open break
    const [activeProjTimer, activeHrTimer, activeBreak] = await Promise.all([
      ProjectTask.findOne({
        status: { $ne: 'Completed' },
        timers: { $elemMatch: { userId, timerStartedAt: { $ne: null } } },
      }).select('title').lean(),
      HRTask.findOne({
        status: { $nin: ['Completed', 'Failed'] },
        timers: { $elemMatch: { userId, timerStartedAt: { $ne: null } } },
      }).select('title').lean(),
      Break.findOne({ userId, endTime: null }).lean(),
    ]);
    const runningTask = activeProjTimer || activeHrTimer;
    if (runningTask) {
      return res.status(409).json({
        message: `Stop your task timer for "${runningTask.title}" before checking out.`,
        code: 'TIMER_RUNNING',
      });
    }
    if (activeBreak) {
      return res.status(409).json({
        message: "End your break before checking out.",
        code: 'ON_BREAK',
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
// GET /api/attendance/logs?page&limit&userId&startDate&endDate (dates are IST "YYYY-MM-DD"; either one alone works)
// Each record gets its own break and task time — counted inside that record's check-in → check-out window —
// plus a state: working | on-break | checked-out | missed-checkout. `summary` covers the whole filter, not just the page.
const MAX_TASK_SESSION_SECS = 12 * 3600; // longer = a timer left running by mistake; not counted (same rule as the employee report)

export const getAllAttendance = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const { userId, startDate, endDate } = req.query;

    const filter = {};
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }

    const now = Date.now();
    const staleBefore = new Date(now - OPEN_SESSION_MAX_HOURS * 3600 * 1000);

    const [attendance, total, summaryRows] = await Promise.all([
      Attendance.find(filter)
        .populate('userId', 'name email role employeeId photo designation')
        .sort({ date: -1, checkInTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Attendance.countDocuments(filter),
      Attendance.find(filter).select('status checkInTime workingHours').lean(),
    ]);

    // Summary over the whole filter
    let workingNow = 0, missedCheckouts = 0, closedDays = 0, closedHours = 0;
    for (const r of summaryRows) {
      if (r.status === 'checked-in') {
        if (new Date(r.checkInTime) >= staleBefore) workingNow++;
        else missedCheckouts++;
      } else if (r.workingHours > 0) {
        closedDays++;
        closedHours += r.workingHours;
      }
    }

    // Each record's window: check-in → check-out, or → now while still working,
    // or → end of that day when the check-out was missed (the session was left open)
    const windows = attendance.map((r) => {
      const start = new Date(r.checkInTime).getTime();
      const open  = r.status === 'checked-in';
      const stale = open && new Date(r.checkInTime) < staleBefore;
      const end   = r.checkOutTime ? new Date(r.checkOutTime).getTime()
                  : stale ? istDayEnd(r.date).getTime()
                  : now;
      return { start, end, open: open && !stale, stale };
    });

    const userIds = [...new Set(attendance.map((r) => String(r.userId?._id || r.userId)))];
    let breaks = [], projTasks = [], hrTasks = [];
    if (attendance.length) {
      const from = new Date(Math.min(...windows.map((w) => w.start)));
      const to   = new Date(Math.max(...windows.map((w) => w.end)));
      [breaks, projTasks, hrTasks] = await Promise.all([
        Break.find({ userId: { $in: userIds }, startTime: { $gte: from, $lte: to } })
          .select('userId startTime endTime durationInSeconds').lean(),
        ProjectTask.find({ 'timers.userId': { $in: userIds } }).select('timers').lean(),
        HRTask.find({ 'timers.userId': { $in: userIds } }).select('timers').lean(),
      ]);
    }

    // Task-timer intervals per user: logged sessions + any timer running now
    const intervalsByUser = {};
    for (const task of [...projTasks, ...hrTasks]) {
      for (const entry of task.timers || []) {
        const uid = String(entry.userId);
        if (!userIds.includes(uid)) continue;
        const list = (intervalsByUser[uid] ||= []);
        for (const s of entry.sessions || []) {
          if ((s.duration || 0) <= MAX_TASK_SESSION_SECS) list.push([new Date(s.startTime).getTime(), new Date(s.endTime).getTime()]);
        }
        if (entry.timerStartedAt) {
          const started = new Date(entry.timerStartedAt).getTime();
          if (now - started <= MAX_TASK_SESSION_SECS * 1000) list.push([started, now]);
        }
      }
    }
    const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

    const enriched = attendance.map((r, i) => {
      const w = windows[i];
      const uid = String(r.userId?._id || r.userId);

      const taskMs = (intervalsByUser[uid] || []).reduce((n, [s, e]) => n + overlap(s, e, w.start, w.end), 0);

      let breakSecs = 0, onBreak = false;
      for (const b of breaks) {
        if (String(b.userId) !== uid) continue;
        const t = new Date(b.startTime).getTime();
        if (t < w.start || t > w.end) continue;
        if (b.endTime) breakSecs += b.durationInSeconds || 0;
        else if (w.open) { onBreak = true; breakSecs += Math.floor((now - t) / 1000); }
      }

      return {
        ...r,
        taskSeconds: Math.floor(taskMs / 1000),
        breakSeconds: breakSecs,
        breakDurationMinutes: Math.round(breakSecs / 60),
        state: w.stale ? 'missed-checkout' : w.open ? (onBreak ? 'on-break' : 'working') : 'checked-out',
      };
    });

    res.status(200).json({
      attendance: enriched,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      currentPage: page,
      totalRecords: total,
      summary: {
        records: total,
        workingNow,
        missedCheckouts,
        closedDays,
        avgHours: closedDays ? Math.round((closedHours / closedDays) * 100) / 100 : 0,
      },
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

    // A session still open from before midnight counts as today's; otherwise today's (IST) record, if any
    const attendance = (await findOpenAttendance(Attendance, userId))
      || await Attendance.findOne({ userId, date: istDateKey() });

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