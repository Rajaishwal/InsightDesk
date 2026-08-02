import express from "express";
import {
  assignTask,
  getAllHRTasks,
  getTasksAssignedByHR,
  getMyAssignedTasks,
  updateHRTask,
  deleteHRTask,
  updateTaskTime,
  startHrTimer,
  stopHrTimer,
} from "../controllers/hrTaskController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 👉 HR assigns a task
router.post("/", protect, assignTask);

// 👉 Get all HR tasks (Admin/HR)
router.get("/", protect, getAllHRTasks);

// 👉 Get tasks assigned by logged-in HR
router.get("/assigned-by-me", protect, getTasksAssignedByHR);

// 👉 Get tasks assigned to logged-in employee
router.get("/my", protect, getMyAssignedTasks);

// 👉 Update task (HR or Employee can update status)
router.put("/:id", protect, updateHRTask);

// 👉 Delete task
router.delete("/:id", protect, deleteHRTask);

// Employee updates task time
router.put("/:id/time", protect, updateTaskTime);

// Timer
router.post("/:id/timer/start", protect, startHrTimer);
router.post("/:id/timer/stop",  protect, stopHrTimer);



export default router;
