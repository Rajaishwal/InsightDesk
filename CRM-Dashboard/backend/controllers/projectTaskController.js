import ProjectTask from '../model/ProjectTask.js';
import Project from '../model/Project.js';
import ProjectActivity from '../model/ProjectActivity.js';
import User from '../model/User.js';
import HRTask from '../model/hrTaskModel.js';

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

    // Enforce one active timer across both ProjectTask and HrTask
    const [activeProjTimer, activeHrTimer] = await Promise.all([
      ProjectTask.findOne({ 'timers.userId': userId, 'timers.timerStartedAt': { $ne: null } }),
      HRTask.findOne({      'timers.userId': userId, 'timers.timerStartedAt': { $ne: null } }),
    ]);
    const activeTask = activeProjTimer || activeHrTimer;
    if (activeTask && activeTask._id.toString() !== taskId) {
      return res.status(409).json({ message: `You already have an active timer on "${activeTask.title}". Pause it first.` });
    }

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
    const userId   = (req.user._id || req.user.id).toString();
    const userName = req.user.name;

    const task = await ProjectTask.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const entry = task.timers.find(t => t.userId.toString() === userId);
    if (!entry || !entry.timerStartedAt) {
      return res.status(400).json({ message: 'No running timer found' });
    }

    const startTime = new Date(entry.timerStartedAt);
    const endTime   = new Date();
    const elapsed   = Math.floor((endTime - startTime) / 1000);
    const newTotal  = (entry.totalTimeLogged || 0) + elapsed;

    // Use MongoDB $push/$set directly — avoids Mongoose change-tracking issues with _id:false nested arrays
    await ProjectTask.updateOne(
      { _id: task._id, 'timers.userId': entry.userId },
      {
        $set:  { 'timers.$.timerStartedAt': null, 'timers.$.totalTimeLogged': newTotal },
        $push: { 'timers.$.sessions': { startTime, endTime, duration: elapsed } },
      }
    );

    const updatedTask = await ProjectTask.findById(taskId);

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

    res.json({ task: updatedTask });
  } catch (err) {
    res.status(500).json({ message: 'Server error stopping timer' });
  }
};

// GET /api/project-tasks/my-time-today
export const getMyTodayTime = async (req, res) => {
  try {
    const userId = (req.user._id || req.user.id).toString();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [projTasks, hrTasks] = await Promise.all([
      ProjectTask.find({ 'timers.userId': userId }),
      HRTask.find({      'timers.userId': userId }),
    ]);

    let completedSeconds = 0;
    let isRunning = false;
    let runningStartedAt = null;

    for (const task of [...projTasks, ...hrTasks]) {
      const entry = task.timers.find(t => t.userId.toString() === userId);
      if (!entry) continue;

      for (const s of (entry.sessions || [])) {
        if (new Date(s.startTime) >= startOfDay) {
          completedSeconds += s.duration || 0;
        }
      }

      if (entry.timerStartedAt) {
        isRunning = true;
        runningStartedAt = entry.timerStartedAt;
      }
    }

    res.json({ completedSeconds, isRunning, runningStartedAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/project-tasks/active-timers
export const getActiveTimers = async (req, res) => {
  try {
    const tasks = await ProjectTask.find({ 'timers': { $elemMatch: { timerStartedAt: { $ne: null } } } }).lean();

    const userIds    = [...new Set(tasks.flatMap(t => t.timers.filter(tm => tm.timerStartedAt).map(tm => tm.userId?.toString())))];
    const projectIds = [...new Set(tasks.map(t => t.projectId))];

    const [users, projects] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('name employeeId designation photo').lean(),
      Project.find({ projectId: { $in: projectIds } }).select('projectId title').lean(),
    ]);

    const userMap    = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const projectMap = Object.fromEntries(projects.map(p => [p.projectId, p]));

    const active = [];
    for (const task of tasks) {
      for (const timer of task.timers) {
        if (!timer.timerStartedAt) continue;
        const user    = userMap[timer.userId?.toString()] || {};
        const project = projectMap[task.projectId] || {};
        active.push({
          taskId:       task._id,
          taskTitle:    task.title,
          projectId:    task.projectId,
          projectTitle: project.title || task.projectId,
          userId:       timer.userId,
          userName:     timer.userName || user.name,
          employeeId:   user.employeeId,
          designation:  user.designation,
          photo:        user.photo,
          startedAt:    timer.timerStartedAt,
          totalLogged:  timer.totalTimeLogged || 0,
        });
      }
    }

    res.json({ active });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/project-tasks/work-log?period=today|all
export const getWorkLog = async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const filterToday = period === 'today';

    const tasks = await ProjectTask.find({ 'timers.0': { $exists: true } }).lean();

    const userIds    = [...new Set(tasks.flatMap(t => t.timers.map(tm => tm.userId?.toString())))];
    const projectIds = [...new Set(tasks.map(t => t.projectId))];

    const [users, projects] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('name employeeId designation photo').lean(),
      Project.find({ projectId: { $in: projectIds } }).select('projectId title').lean(),
    ]);

    const userMap    = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const projectMap = Object.fromEntries(projects.map(p => [p.projectId, p]));

    const rows = [];
    for (const task of tasks) {
      const project = projectMap[task.projectId] || {};
      for (const timer of (task.timers || [])) {
        const user = userMap[timer.userId?.toString()] || {};

        let logged = 0;
        if (filterToday) {
          // Sum only sessions that started today
          for (const s of (timer.sessions || [])) {
            if (new Date(s.startTime) >= todayStart) logged += s.duration || 0;
          }
          // Add running time if timer started today
          if (timer.timerStartedAt && new Date(timer.timerStartedAt) >= todayStart) {
            logged += Math.floor((Date.now() - new Date(timer.timerStartedAt)) / 1000);
          }
          if (logged === 0) continue; // skip rows with no activity today
        } else {
          const running = timer.timerStartedAt
            ? Math.floor((Date.now() - new Date(timer.timerStartedAt)) / 1000) : 0;
          logged = (timer.totalTimeLogged || 0) + running;
          if (logged === 0) continue;
        }

        rows.push({
          taskId:       task._id,
          taskTitle:    task.title,
          taskStatus:   task.status,
          projectId:    task.projectId,
          projectTitle: project.title || task.projectId,
          userId:       timer.userId,
          userName:     timer.userName || user.name,
          employeeId:   user.employeeId,
          designation:  user.designation,
          photo:        user.photo,
          totalLogged:  logged,
          isRunning:    !!timer.timerStartedAt,
          sessionCount: (timer.sessions || []).length,
        });
      }
    }

    rows.sort((a, b) => b.totalLogged - a.totalLogged);
    res.json({ rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/project-tasks/all-sessions?period=today|week|month|all
export const getAllSessions = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const now = new Date();
    const cutoff = period === 'today'  ? new Date(now.getFullYear(), now.getMonth(), now.getDate()) :
                   period === 'week'   ? new Date(now - 7 * 86400000) :
                   period === 'month'  ? new Date(now.getFullYear(), now.getMonth(), 1) : null;

    const tasks = await ProjectTask.find().lean();

    const userIds    = [...new Set(tasks.flatMap(t => t.timers.map(tm => tm.userId?.toString())))];
    const projectIds = [...new Set(tasks.map(t => t.projectId))];

    const [users, projects] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('name employeeId designation photo').lean(),
      Project.find({ projectId: { $in: projectIds } }).select('projectId title').lean(),
    ]);

    const userMap    = Object.fromEntries(users.map(u => [u._id.toString(), u]));
    const projectMap = Object.fromEntries(projects.map(p => [p.projectId, p]));

    const sessions = [];
    for (const task of tasks) {
      const project = projectMap[task.projectId] || {};
      for (const timer of (task.timers || [])) {
        const user = userMap[timer.userId?.toString()] || {};
        for (const s of (timer.sessions || [])) {
          if (cutoff && new Date(s.startTime) < cutoff) continue;
          sessions.push({
            taskId:       task._id,
            taskTitle:    task.title,
            projectId:    task.projectId,
            projectTitle: project.title || task.projectId,
            userId:       timer.userId,
            userName:     timer.userName || user.name,
            employeeId:   user.employeeId,
            designation:  user.designation,
            photo:        user.photo,
            startTime:    s.startTime,
            endTime:      s.endTime,
            duration:     s.duration,
          });
        }
      }
    }

    sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};