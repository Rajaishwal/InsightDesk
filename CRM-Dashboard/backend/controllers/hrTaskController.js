import HRTask from "../model/hrTaskModel.js";
import User from "../model/User.js";
import ProjectTask from "../model/ProjectTask.js";
import Break from "../models/Break.js";
import Attendance from "../model/Attendance.js";
import { findOpenAttendance } from "../utils/istDate.js";
import { getIo } from "../socket.js";

// 👉 HR assigns a task to employee route: POST /api/hr-tasks/
export const assignTask = async (req, res) => {
  try {
    console.log('🎯 HR Task Assignment Request:', {
      user: req.user ? { id: req.user._id, name: req.user.name, role: req.user.role } : 'No user',
      body: req.body
    });

    const { title, description, taskCompletionTime, assignedTo } = req.body;

    // 1️⃣ Find the employee by employeeId
    const employee = await User.findOne({ employeeId: assignedTo });
    if (!employee) {
      console.log('❌ Employee not found:', assignedTo);
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    console.log('✅ Employee found:', { employeeId: employee.employeeId, name: employee.name });

    // 2️⃣ Prepare task data
    const task = new HRTask({
      title,
      description,
      taskCompletionTime,
      assignedTo: employee.employeeId, // store employee code
      assignedToName: employee.name,
      assignedToEmail: employee.email,
      assignedBy: req.user._id,
      assignedByName: req.user.name,
      assignedByEmail: req.user.email,
    });

    // 3️⃣ Save task
    await task.save();
    console.log('✅ Task saved successfully:', task._id);

    res.status(201).json({ success: true, message: "Task assigned successfully", task });
  } catch (error) {
    console.error('❌ HR Task Assignment Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Get all HR assigned tasks
export const getAllHRTasks = async (req, res) => {
  try {
    const tasks = await HRTask.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Get tasks assigned by HR (tasks HR created)
export const getTasksAssignedByHR = async (req, res) => {
  try {
    const tasks = await HRTask.find({ assignedBy: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyAssignedTasks = async (req, res) => {
  try {
    // Use employeeId instead of Mongo _id
    const tasks = await HRTask.find({ assignedTo: req.user.employeeId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Employees can only move their task to In Progress or Completed; Completed/Failed is final for them
const EMPLOYEE_STATUSES = ['In Progress', 'Completed'];
const FINAL_STATUSES = ['Completed', 'Failed'];

// 👉 Update task (HR or Employee can update status)
export const updateHRTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const isAdmin = req.user?.role === 'admin';

    const existing = await HRTask.findById(taskId);
    if (!existing) return res.status(404).json({ success: false, message: "Task not found" });

    let update;
    if (isAdmin) {
      update = { ...req.body };
    } else {
      if (existing.assignedTo !== req.user?.employeeId) {
        return res.status(403).json({ success: false, message: "You can only update tasks assigned to you." });
      }
      if (FINAL_STATUSES.includes(existing.status)) {
        return res.status(409).json({ success: false, message: `This task is already ${existing.status.toLowerCase()} and can't be changed.` });
      }
      if (!EMPLOYEE_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ success: false, message: "Status can only be set to In Progress or Completed." });
      }
      update = { status: req.body.status }; // employees change status only — never title, assignee, etc.
    }

    // Keep completedAt in step with status — reports count completions by this date
    if (update.status === 'Completed' && existing.status !== 'Completed') update.completedAt = new Date();
    else if (update.status && update.status !== 'Completed') update.completedAt = null;

    // A finished task can't keep a timer running — stop it and log the session (same as project tasks)
    if (FINAL_STATUSES.includes(update.status)) {
      const now = new Date();
      for (const entry of existing.timers || []) {
        if (!entry.timerStartedAt) continue;
        const elapsed = Math.max(0, Math.floor((now - new Date(entry.timerStartedAt)) / 1000));
        await HRTask.updateOne(
          { _id: existing._id, 'timers.userId': entry.userId },
          { $set: { 'timers.$.timerStartedAt': null, 'timers.$.totalTimeLogged': (entry.totalTimeLogged || 0) + elapsed } }
        );
        try {
          await HRTask.updateOne(
            { _id: existing._id, 'timers.userId': entry.userId },
            { $push: { 'timers.$.sessions': { startTime: new Date(entry.timerStartedAt), endTime: now, duration: elapsed } } }
          );
        } catch (sessionErr) { console.warn('HR session log failed (non-critical):', sessionErr.message); }
      }
    }

    const updated = await HRTask.findByIdAndUpdate(taskId, update, { new: true });
    getIo()?.emit("crm:task:updated");

    res.status(200).json({ success: true, message: "Task updated", updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Delete task
export const deleteHRTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    await HRTask.findByIdAndDelete(taskId);
    res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/hr-tasks/:id/timer/start
export const startHrTimer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId   = (req.user._id || req.user.id).toString();
    const userName = req.user.name;

    const task = await HRTask.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.status === 'Completed') return res.status(400).json({ message: 'Task already completed' });

    // Timers only run inside a working session: checked in (session may span midnight), and not on a break
    const [checkedIn, activeBreak] = await Promise.all([
      findOpenAttendance(Attendance, userId).lean(),
      Break.findOne({ userId, endTime: null }).lean(),
    ]);
    if (!checkedIn) {
      return res.status(409).json({ message: 'Check in before starting a task timer.' });
    }
    if (activeBreak) {
      return res.status(409).json({ message: 'You are on a break. End your break before starting a task timer.' });
    }

    // Enforce one active timer across both collections
    // $elemMatch ensures BOTH conditions match the same array element (same user's entry)
    const [activeProjTimer, activeHrTimer] = await Promise.all([
      ProjectTask.findOne({ timers: { $elemMatch: { userId, timerStartedAt: { $ne: null } } } }),
      HRTask.findOne({      timers: { $elemMatch: { userId, timerStartedAt: { $ne: null } } } }),
    ]);
    const activeTask = activeProjTimer || activeHrTimer;
    if (activeTask && activeTask._id.toString() !== id) {
      return res.status(409).json({ message: `You already have an active timer on "${activeTask.title}". Pause it first.` });
    }

    const entry = task.timers.find(t => t.userId.toString() === userId);
    if (entry) {
      if (entry.timerStartedAt) return res.status(400).json({ message: 'Timer already running' });
      await HRTask.updateOne(
        { _id: task._id, 'timers.userId': userId },
        { $set: { 'timers.$.timerStartedAt': new Date() } }
      );
    } else {
      await HRTask.updateOne(
        { _id: task._id },
        { $push: { timers: { userId, userName, timerStartedAt: new Date(), totalTimeLogged: 0, sessions: [] } } }
      );
    }

    if (task.status === 'Assigned') {
      await HRTask.updateOne({ _id: task._id }, { $set: { status: 'In Progress' } });
    }

    const updated = await HRTask.findById(id);
    res.json({ task: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/hr-tasks/:id/timer/stop
export const stopHrTimer = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user._id || req.user.id).toString();

    const task = await HRTask.findById(id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const entry = task.timers.find(t => t.userId.toString() === userId);
    if (!entry || !entry.timerStartedAt) return res.status(400).json({ message: 'No running timer found' });

    const startTime = new Date(entry.timerStartedAt);
    const endTime   = new Date();
    const elapsed   = Math.floor((endTime - startTime) / 1000);
    const newTotal  = (entry.totalTimeLogged || 0) + elapsed;

    await HRTask.updateOne(
      { _id: task._id, 'timers.userId': userId },
      {
        $set:  { 'timers.$.timerStartedAt': null, 'timers.$.totalTimeLogged': newTotal },
        $push: { 'timers.$.sessions': { startTime, endTime, duration: elapsed } },
      }
    );

    const updated = await HRTask.findById(id);
    res.json({ task: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 👉 PUT /api/hr-tasks/:id/time
export const updateTaskTime = async (req, res) => {
  try {
    const { timeTaken } = req.body;
    const taskId = req.params.id;

    if (!timeTaken) {
      return res.status(400).json({ success: false, message: "timeTaken is required" });
    }

    // Check task exists
    const task = await HRTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    // Check authorization
    if (task.assignedToEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: "Not authorized to update this task" });
    }

    // 🚫 Prevent updating time more than once
    if (task.taskCompletionTime) {
      return res.status(400).json({
        success: false,
        message: "Time already recorded for this task. Cannot update again.",
      });
    }

    // ✅ Save time only once
    task.taskCompletionTime = timeTaken;
    task.status = "Completed";
    task.stopped = true; // optional: add in schema for frontend disabling
    task.completedAt = new Date();

    await task.save();

    res.status(200).json({
      success: true,
      message: "Time saved successfully",
      task,
    });
  } catch (error) {
    console.error("❌ Error in updateTaskTime:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
