import ProjectActivity from '../model/ProjectActivity.js';

// GET /api/project-activity
export const getProjectActivity = async (req, res) => {
  try {
    const { projectId, limit = 40 } = req.query;
    const filter = projectId ? { projectId: projectId.toUpperCase() } : {};
    const activities = await ProjectActivity.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));
    res.json({ activities });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching activity' });
  }
};