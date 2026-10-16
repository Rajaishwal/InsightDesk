import express from "express";
import {
  assignTask,
  getAllHRTasks,
  getTasksAssignedByHR,
  getMyAssignedTasks,
  updateHRTask,
  deleteHRTask,
  startHrTimer,
  stopHrTimer,
} from "../controllers/hrTaskController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, assignTask);

// 👉 Get all HR tasks (Admin/HR)
router.get("/", protect, getAllHRTasks);

router.get("/assigned-by-me", protect, getTasksAssignedByHR);

router.get("/my", protect, getMyAssignedTasks);

// 👉 Update task (HR or Employee can update status)
router.put("/:id", protect, updateHRTask);

router.delete("/:id", protect, deleteHRTask);

router.post("/:id/timer/start", protect, startHrTimer);
router.post("/:id/timer/stop",  protect, stopHrTimer);

export default router;
