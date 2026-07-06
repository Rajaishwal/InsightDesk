import express from "express";
import Project from '../model/Project.js';
import {
  createProject,
  getAllProjects,
  getProjectById,
  deleteProject,
  getProjectStats,
  getMyProjects,
  updateProject
} from "../controllers/projectController.js";
import { protect, hrOrAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get team members for a project by projectId
router.get('/:projectId/team', async (req, res) => {
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

// Public routes (require authentication)
router.post("/", protect, createProject);                    // Create project
router.get("/my-projects", protect, getMyProjects);          // Get user's projects
router.get("/stats", protect, getProjectStats);              // Get project statistics
router.get("/:id", protect, getProjectById);                 // Get project by ID

// HR/Admin routes
router.get("/", protect, hrOrAdmin, getAllProjects);         // Get all projects (HR/Admin only)
router.put("/:id", protect, updateProject);                  // Update project
router.delete("/:id", protect, hrOrAdmin, deleteProject);    // Delete project (HR/Admin only)


export default router;
