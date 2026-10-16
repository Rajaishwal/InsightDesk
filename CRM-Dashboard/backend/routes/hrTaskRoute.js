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
import { protect, hrOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, hrOrAdmin, assignTask);

router.get("/", protect, hrOrAdmin, getAllHRTasks);

router.get("/assigned-by-me", protect, hrOrAdmin, getTasksAssignedByHR);

router.get("/my", protect, getMyAssignedTasks);

// HR can edit any field; an employee only the status of a task assigned to them (checked in the controller)
router.put("/:id", protect, updateHRTask);

router.delete("/:id", protect, hrOrAdmin, deleteHRTask);

router.post("/:id/timer/start", protect, startHrTimer);
router.post("/:id/timer/stop",  protect, stopHrTimer);

export default router;
