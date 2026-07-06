

import express from 'express';
const router = express.Router();

// Dashboard summary for a specific employee
router.get('/summary/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const User = (await import('../model/User.js')).default;
    const Project = (await import('../model/Project.js')).default;
    const Attendance = (await import('../model/Attendance.js')).default;

    // Employee exists?
    const employee = await User.findOne({ employeeId });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    // Project count: projects where this employee is in teamMembers
    const totalProjects = await Project.countDocuments({
      teamMembers: { $elemMatch: { empId: employeeId } },
      $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ]
    });

    // Attendance in last 30 days for this employee
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    const attendanceQuery = {
      employeeId,
      date: { $gte: lastMonth.toISOString().slice(0,10), $lte: today.toISOString().slice(0,10) }
    };
    const totalAttendance = await Attendance.countDocuments(attendanceQuery);
    console.log('DEBUG: Attendance query:', attendanceQuery);
    console.log('DEBUG: Attendance count for', employeeId, '=', totalAttendance);
    const possibleAttendance = 30;
    const attendanceRate = possibleAttendance ? Math.round((totalAttendance / possibleAttendance) * 100) : 0;

    // Project progress: percentage of completed projects for this employee
    const completedProjects = await Project.countDocuments({
      teamMembers: { $elemMatch: { empId: employeeId } },
      status: 'Completed',
      $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ]
    });
    const projectProgress = totalProjects ? Math.round((completedProjects / totalProjects) * 100) : 0;

    // Pending tasks: count of ongoing projects for this employee
    const pendingTasks = await Project.countDocuments({
      teamMembers: { $elemMatch: { empId: employeeId } },
      status: 'Ongoing',
      $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ]
    });

    // Top performer: not relevant for single employee, just return their name
    const topPerformer = employee.name || employeeId;

    res.json({
      totalEmployees: 1,
      totalProjects,
      attendanceRate,
      projectProgress,
      pendingTasks,
      topPerformer
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee dashboard summary', details: err.message });
  }
});
// Attendance count graph for a specific employee
router.get('/attendance-count-graph/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const Attendance = (await import('../model/Attendance.js')).default;
    const User = (await import('../model/User.js')).default;
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    // Find employee name
    const employee = await User.findOne({ employeeId });
    const userName = employee ? employee.name : employeeId;
    // Count attendance for this employee
    const attendanceCount = await Attendance.countDocuments({
      employeeId,
      date: { $gte: lastMonth.toISOString().slice(0,10), $lte: today.toISOString().slice(0,10) }
    });
    res.json([{ name: userName, count: attendanceCount }]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee attendance graph', details: err.message });
  }
});
// Project graph for a specific employee
router.get('/project-graph/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const Project = (await import('../model/Project.js')).default;
    const projects = await Project.find({
      teamMembers: { $elemMatch: { empId: employeeId } },
      $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ]
    }, { projectId: 1, teamMembers: 1, _id: 0 });
    const result = projects.map(p => ({
      projectId: p.projectId,
      employees: Array.isArray(p.teamMembers) ? p.teamMembers.map(tm => tm.empId) : []
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee project graph', details: err.message });
  }
});
// Project status summary for a specific employee
router.get('/project-status-summary/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const Project = (await import('../model/Project.js')).default;
    const statuses = ['Ongoing', 'Completed', 'Archived', 'Pending'];
    const statusCounts = {};
    for (const status of statuses) {
      statusCounts[status] = await Project.countDocuments({
        teamMembers: { $elemMatch: { empId: employeeId } },
        status,
        $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ]
      });
    }
    res.json(statusCounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee project status summary', details: err.message });
  }
});
// Project status details for a specific employee
router.get('/project-status-details/:employeeId', async (req, res) => {
  try {
    const employeeId = req.params.employeeId;
    const Project = (await import('../model/Project.js')).default;
    const projects = await Project.find({
      teamMembers: { $elemMatch: { empId: employeeId } },
      $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ]
    }, { status: 1, projectId: 1, teamMembers: 1, title: 1 });
    const result = {};
    for (const proj of projects) {
      if (!result[proj.status]) result[proj.status] = [];
      result[proj.status].push({
        projectId: proj.projectId,
        title: proj.title,
        employees: Array.isArray(proj.teamMembers) ? proj.teamMembers.map(tm => tm.empId) : []
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee project status details', details: err.message });
  }
});


// Project status details for pie chart hover
router.get('/project-status-details', async (req, res) => {
  try {
    const Project = (await import('../model/Project.js')).default;
    // Get all projects (active or all, as needed)
    const projects = await Project.find({ $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ] }, { status: 1, projectId: 1, teamMembers: 1, title: 1 });
    // Group by status
    const result = {};
    for (const proj of projects) {
      if (!result[proj.status]) result[proj.status] = [];
      result[proj.status].push({
        projectId: proj.projectId,
        title: proj.title,
        employees: Array.isArray(proj.teamMembers) ? proj.teamMembers.map(tm => tm.empId) : []
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project status details', details: err.message });
  }
});

// Project status summary for pie chart
router.get('/project-status-summary', async (req, res) => {
  try {
    const Project = (await import('../model/Project.js')).default;
    // Count projects by status (only active or all, as needed)
    const statuses = ['Ongoing', 'Completed', 'Archived', 'Pending'];
    const statusCounts = {};
    for (const status of statuses) {
      statusCounts[status] = await Project.countDocuments({ status, $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ] });
    }
    res.json(statusCounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project status summary', details: err.message });
  }
});

// Dashboard summary endpoint
router.get('/summary', async (req, res) => {
  try {
    const User = (await import('../model/User.js')).default;
    const Project = (await import('../model/Project.js')).default;
    const Attendance = (await import('../model/Attendance.js')).default;

    // Total registered users (all roles)
    const totalEmployees = await User.countDocuments({});
    // Count only role=employee for attendance rate calculation
    const employeeOnlyCount = await User.countDocuments({ role: 'employee' });

    // Project count: count all projects where statusFlag is true or missing
    const totalProjects = await Project.countDocuments({ $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ] });

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    const totalAttendance = await Attendance.countDocuments({ date: { $gte: lastMonth.toISOString().slice(0,10), $lte: todayStr } });
    const possibleAttendance = (employeeOnlyCount || totalEmployees) * 30;
    const attendanceRate = possibleAttendance ? Math.round((totalAttendance / possibleAttendance) * 100) : 0;

    // Present today: employees who have a check-in record for today
    const presentToday = await Attendance.countDocuments({ date: todayStr });

    // Project progress (percentage of completed projects)
    const completedProjects = await Project.countDocuments({ status: 'Completed', statusFlag: true });
    const projectProgress = totalProjects ? Math.round((completedProjects / totalProjects) * 100) : 0;

    // Pending tasks (example: count of ongoing projects)
    const pendingTasks = await Project.countDocuments({ status: 'Ongoing', statusFlag: true });

    // Top performer (employee with most attendance in last 30 days)
    const topAttendance = await Attendance.aggregate([
      { $match: { date: { $gte: lastMonth.toISOString().slice(0,10), $lte: today.toISOString().slice(0,10) } } },
      { $group: { _id: '$userName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const topPerformer = topAttendance[0]?.['_id'] || '';

    res.json({
      totalEmployees,
      presentToday,
      totalProjects,
      attendanceRate,
      projectProgress,
      pendingTasks,
      topPerformer
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard summary', details: err.message });
  }
});

// Attendance count graph endpoint
router.get('/attendance-count-graph', async (req, res) => {
  try {
    const Attendance = (await import('../model/Attendance.js')).default;
    // Group attendance by userName for the last 30 days
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    const attendanceStats = await Attendance.aggregate([
      { $match: { date: { $gte: lastMonth.toISOString().slice(0,10), $lte: today.toISOString().slice(0,10) } } },
      { $group: { _id: '$userName', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const result = attendanceStats.map(a => ({ name: a._id, count: a.count }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch attendance graph', details: err.message });
  }
});

// Project assignment graph endpoint
router.get('/project-graph', async (req, res) => {
  try {
    const Project = (await import('../model/Project.js')).default;
    // Get only 'Ongoing' and 'Completed' projects with statusFlag true or missing
    const projects = await Project.find({
      status: { $in: ['Ongoing', 'Completed'] },
      $or: [ { statusFlag: true }, { statusFlag: { $exists: false } } ]
    }, { projectId: 1, teamMembers: 1, _id: 0 });
    const result = projects.map(p => ({
      projectId: p.projectId,
      employees: Array.isArray(p.teamMembers) ? p.teamMembers.map(tm => tm.empId) : []
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch project graph', details: err.message });
  }
});

export default router;
