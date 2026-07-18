import ProjectTask from '../model/ProjectTask.js';
import Project from '../model/Project.js';
import ProjectActivity from '../model/ProjectActivity.js';

const logActivity = async (data) => {
  try {
    await ProjectActivity.create(data);
  } catch (e) {
    console.error('Activity log error:', e.message);
  }
};

// GET /api/project-tasks/stats/all
export const getProjectStats = async (req, res) => {
  try {
    const stats = await ProjectTask.aggregate([
      {
        $group: {
          _id:       '$projectId',
          total:     { $sum: 1 },
          pending:   { $sum: { $cond: [{ $eq: ['$status', 'Pending'] },   1, 0] } },
          ongoing:   { $sum: { $cond: [{ $eq: ['$status', 'Ongoing'] },   1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
          revisions: { $sum: { $cond: ['$isRevision', 1, 0] } },
        },
      },
    ]);
    const result = {};
    stats.forEach(s => {
      result[s._id] = {
        total: s.total, pending: s.pending,
        ongoing: s.ongoing, completed: s.completed, revisions: s.revisions,
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching stats' });
  }
};

// GET /api/project-tasks/:projectId
export const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findOne({ projectId: projectId.toUpperCase() });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const tasks = await ProjectTask.find({ projectId: projectId.toUpperCase() })
      .sort({ createdAt: 1 });

    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching tasks' });
  }
};

// POST /api/project-tasks/:projectId
export const addProjectTask = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description, isRevision } = req.body;
    const user = req.user;

    if (!title?.trim()) return res.status(400).json({ message: 'Task title is required' });

    if (isRevision && user.role === 'employee') {
      return res.status(403).json({ message: 'Only managers can add revision tasks' });
    }

    const project = await Project.findOne({ projectId: projectId.toUpperCase() });
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const task = await ProjectTask.create({
      projectId: projectId.toUpperCase(),
      title: title.trim(),
      description: description?.trim() || '',
      isRevision: !!isRevision,
      createdBy: user._id || user.id,
      createdByName: user.name,
      createdByRole: user.role,
    });

    await logActivity({
      projectId:   task.projectId,
      projectName: project.title,
      taskId:      task._id,
      taskTitle:   task.title,
      userId:      user._id || user.id,
      userName:    user.name,
      action:      isRevision ? 'revision_added' : 'task_created',
      toStatus:    'Pending',
    });

    res.status(201).json({ task });
  } catch (err) {
    res.status(500).json({ message: 'Server error creating task' });
  }
};

// PUT /api/project-tasks/:taskId/status
export const updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!['Pending', 'Ongoing', 'Completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const task = await ProjectTask.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const fromStatus = task.status;
    task.status = status;
    if (status === 'Completed') task.completedAt = new Date();
    else task.completedAt = undefined;

    await task.save();

    const project = await Project.findOne({ projectId: task.projectId });
    await logActivity({
      projectId:   task.projectId,
      projectName: project?.title || task.projectId,
      taskId:      task._id,
      taskTitle:   task.title,
      userId:      user._id || user.id,
      userName:    user.name,
      action:      'status_changed',
      fromStatus,
      toStatus:    status,
    });

    res.json({ task });
  } catch (err) {
    res.status(500).json({ message: 'Server error updating task status' });
  }
};

// POST /api/project-tasks/:taskId/timer/start
export const startTimer = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId   = req.user._id || req.user.id;
    const userName = req.user.name;

    const task = await ProjectTask.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    let entry = task.timers.find(t => t.userId.toString() === userId.toString());
    if (!entry) {
      task.timers.push({ userId, userName, timerStartedAt: new Date(), totalTimeLogged: 0 });
    } else {
      if (entry.timerStartedAt) return res.status(400).json({ message: 'Timer already running' });
      entry.timerStartedAt = new Date();
    }

    const prevStatus = task.status;
    if (task.status === 'Pending') task.status = 'Ongoing';
    await task.save();

    const project = await Project.findOne({ projectId: task.projectId });
    await logActivity({
      projectId:   task.projectId,
      projectName: project?.title || task.projectId,
      taskId:      task._id,
      taskTitle:   task.title,
      userId,
      userName,
      action:      'timer_started',
      fromStatus:  prevStatus,
      toStatus:    task.status,
    });

    res.json({ task });
  } catch (err) {
    res.status(500).json({ message: 'Server error starting timer' });
  }
};

// POST /api/project-tasks/:taskId/timer/stop
export const stopTimer = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId   = req.user._id || req.user.id;
    const userName = req.user.name;

    const task = await ProjectTask.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const entry = task.timers.find(t => t.userId.toString() === userId.toString());
    if (!entry || !entry.timerStartedAt) {
      return res.status(400).json({ message: 'No running timer found' });
    }

    const elapsed = Math.floor((Date.now() - new Date(entry.timerStartedAt).getTime()) / 1000);
    entry.totalTimeLogged += elapsed;
    entry.timerStartedAt  = null;

    await task.save();

    const project = await Project.findOne({ projectId: task.projectId });
    await logActivity({
      projectId:   task.projectId,
      projectName: project?.title || task.projectId,
      taskId:      task._id,
      taskTitle:   task.title,
      userId,
      userName,
      action:      'timer_stopped',
    });

    res.json({ task });
  } catch (err) {
    res.status(500).json({ message: 'Server error stopping timer' });
  }
};