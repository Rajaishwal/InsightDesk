import express from "express";
import Project from '../model/Project.js';
import {
  createProject,
  getAllProjects,
  getMyProjects,
  updateProject,
} from "../controllers/projectController.js";
import { protect, hrOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get('/:projectId/team', protect, async (req, res) => {
  try {
    const project = await Project.findOne({ projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found', teamMembers: [] });
    }
    const teamMembers = (project.teamMembers || []).map(member => ({
      empId: member.empId,
      empEmail: member.empEmail
    }));
    res.json({ success: true, teamMembers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching team members', teamMembers: [] });
  }
});

// Next auto-generated project ID preview
router.get("/next-id", protect, async (req, res) => {
  try {
    const last = await Project.findOne().sort({ createdAt: -1 }).select("projectId");
    const lastId = last ? last.projectId : "PRJ-000";
    const num = parseInt(lastId.replace("PRJ-", ""), 10) + 1;
    res.json({ nextId: `PRJ-${num.toString().padStart(3, "0")}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public routes (require authentication)
router.post("/", protect, createProject);
router.get("/my-projects", protect, getMyProjects);

// HR/Admin routes
router.get("/", protect, hrOrAdmin, getAllProjects);
router.put("/:id", protect, updateProject);

export default router;
