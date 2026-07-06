// HR Project API Route
import express from 'express';
import Project from '../model/Project.js';

const router = express.Router();

// GET /api/hr-projects - returns all projects with team members
router.get('/', async (req, res) => {
  try {
    // Get all projects
    const projects = await Project.find({});
    // Flatten team members for HR table
    const hrData = [];
    projects.forEach(project => {
      if (Array.isArray(project.teamMembers)) {
        project.teamMembers.forEach(member => {
          hrData.push({
            empId: member.empId,
            empEmail: member.empEmail,
            projectId: project.projectId,
            manager: project.manager,
            status: project.status,
            title: project.title,
            description: project.description
          });
        });
      }
    });
    res.json(hrData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch HR projects', details: err.message });
  }
});

// GET /hr-projects/:projectId - get full project details by projectId
router.get('/:projectId', async (req, res) => {
  try {
    const project = await Project.findOne({ projectId: req.params.projectId });
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project', details: err.message });
  }
});

export default router;
