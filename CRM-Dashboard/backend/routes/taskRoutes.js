import express from "express";
import {
  createTask,
  getAllTasks,
  updateTask,
  deleteTask,
  getMyTasks,
  getTasksByUserId,
} from "../controllers/taskController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 👉 Authenticated user (admin or employee) can create tasks
router.post("/", protect, createTask);

// 👉 Admin can get all tasks
router.get("/", protect, getAllTasks);

// 👉 Update a task by ID
router.put("/:id", protect, updateTask);

// 👉 Delete a task by ID
router.delete("/:id", protect, deleteTask);

// 👉 Get tasks for logged-in employee
router.get("/my", protect, getMyTasks);

// 👉 Get tasks by specific user ID (for HR)
router.get("/user/:userId", protect, getTasksByUserId);

export default router;
