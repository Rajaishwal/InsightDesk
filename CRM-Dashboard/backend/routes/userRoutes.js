import express from 'express';
import User from '../model/User.js';
import HRTask from '../model/hrTaskModel.js';
import Attendance from '../model/Attendance.js';
import Project from '../model/Project.js';
import Leave from '../model/Leave.js';
import Break from '../models/Break.js';
import {
  updateUserProfile,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';
import { protect, admin, hrOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// PUT /api/users/profile
router.put('/profile', protect, updateUserProfile);

// GET /api/users — all users (HR/Admin)
router.get('/', protect, hrOrAdmin, getAllUsers);

// GET /api/users/profile-stats
router.get('/profile-stats', protect, async (req, res) => {
  try {
    const userId  = req.user._id;
    const empId   = req.user.employeeId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [tasksInProgress, totalTasks, attendanceThisMonth, activeProjects, completedProjects, approvedLeaves] = await Promise.all([
      HRTask.countDocuments({ assignedTo: empId, status: { $in: ['In Progress', 'Assigned'] } }),
      HRTask.countDocuments({ assignedTo: empId }),
      Attendance.find({ userId, date: { $gte: startOfMonth.toISOString().split('T')[0], $lte: endOfMonth.toISOString().split('T')[0] } }),
      Project.countDocuments({ 'teamMembers.empId': req.user.employeeId, status: 'Ongoing', statusFlag: true }),
      Project.countDocuments({ 'teamMembers.empId': req.user.employeeId, status: 'Completed', statusFlag: true }),
      Leave.find({ userId, status: 'Approved', startDate: { $gte: startOfMonth }, endDate: { $lte: endOfMonth } }),
    ]);

    const attendanceDaysThisMonth = attendanceThisMonth.length;
    const monthlyWorkingHours = attendanceThisMonth.reduce((sum, a) => sum + (a.workingHours || 0), 0);
    const totalApprovedLeaveDays = approvedLeaves.reduce((sum, l) => sum + (l.totalDays || 0), 0);

    res.json({
      tasksInProgress,
      totalTasks,
      attendanceDaysThisMonth,
      monthlyWorkingHours,
      activeProjects,
      completedProjects,
      totalApprovedLeaveDays,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile stats', error: err.message });
  }
});

// GET /api/users/admin-stats — dashboard stats for admin
router.get('/admin-stats', protect, admin, async (req, res) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalEmployees, newJoined, onBreakCount] = await Promise.all([
      User.countDocuments({ role: 'employee' }),
      User.countDocuments({ role: 'employee', createdAt: { $gte: monthStart } }),
      Break.countDocuments({ endTime: null }),
    ]);

    // Monthly joining data for bar chart (last 7 months)
    const monthlyData = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const count = await User.countDocuments({ role: 'employee', createdAt: { $gte: start, $lte: end } });
      monthlyData.push({ month: start.toLocaleDateString('en-US', { month: 'short' }), count });
    }

    // Today's attendance
    const todayAtt = await Attendance.find({ date: today });
    const presentCount = todayAtt.length;

    // Employees currently on break
    const activeBreaks = await Break.find({ endTime: null }).lean();
    const breakUserIds = activeBreaks.map(b => b.userId);
    const breakUsersData = await User.find({ _id: { $in: breakUserIds } })
      .select('name employeeId designation domain photo').lean();
    const breakUsersMap = {};
    breakUsersData.forEach(u => { breakUsersMap[u._id.toString()] = u; });
    const breakAttMap = {};
    todayAtt.forEach(a => { breakAttMap[a.userId?.toString()] = a; });
    const onBreakEmployees = activeBreaks.map(b => {
      const u = breakUsersMap[b.userId?.toString()] || {};
      const att = breakAttMap[b.userId?.toString()] || {};
      return {
        _id: u._id,
        name: u.name || '',
        employeeId: u.employeeId || '',
        designation: u.designation || '',
        domain: u.domain || '',
        photo: u.photo || null,
        checkInTime: att.checkInTime || null,
        breakStartTime: b.startTime,
      };
    });
    const lateCount = todayAtt.filter(a => {
      const ci = new Date(a.checkInTime);
      return ci.getHours() > 9 || (ci.getHours() === 9 && ci.getMinutes() > 30);
    }).length;

    // Project stats
    const projectAgg = await Project.aggregate([
      { $match: { statusFlag: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const projMap = {};
    projectAgg.forEach(p => { projMap[p._id] = p.count; });
    const ongoingProjects   = projMap['Ongoing']   || 0;
    const completedProjects = projMap['Completed'] || 0;
    const pendingProjects   = projMap['Pending']   || 0;

    // Ongoing projects list for dashboard scroll
    const ongoingProjectsRaw = await Project.find({ status: 'Ongoing', statusFlag: true })
      .select('projectId title manager teamMembers')
      .lean();
    const allEmpIds = [...new Set(ongoingProjectsRaw.flatMap(p => p.teamMembers.map(m => m.empId)))];
    const empNameRows = await User.find({ employeeId: { $in: allEmpIds } }).select('employeeId name').lean();
    const empNameMap = {};
    empNameRows.forEach(u => { empNameMap[u.employeeId] = u.name; });
    const ongoingProjectsList = ongoingProjectsRaw.map(p => ({
      projectId: p.projectId,
      title: p.title,
      manager: p.manager,
      teamMembers: p.teamMembers.map(m => ({ empId: m.empId, name: empNameMap[m.empId] || m.empId })),
    }));

    // Employees on leave today
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const onLeaveRaw = await Leave.find({
      status: 'Approved',
      startDate: { $lte: todayEnd },
      endDate: { $gte: todayStart },
    }).select('userName leaveType userId').lean();

    // Enrich on-leave data with user profile fields
    const onLeaveUserIds = onLeaveRaw.map(l => l.userId).filter(Boolean);
    const onLeaveUserInfo = await User.find({ _id: { $in: onLeaveUserIds } })
      .select('employeeId designation domain photo').lean();
    const onLeaveUserMap = {};
    onLeaveUserInfo.forEach(u => { onLeaveUserMap[u._id.toString()] = u; });
    const onLeaveEnrichedBase = onLeaveRaw.map(l => {
      const u = onLeaveUserMap[l.userId?.toString()] || {};
      return {
        name: l.userName,
        leaveType: l.leaveType,
        employeeId: u.employeeId || '',
        designation: u.designation || '',
        domain: u.domain || '',
        photo: u.photo || null,
      };
    });

    // Attach projects to each on-leave employee
    const onLeaveEmpIds = onLeaveEnrichedBase.map(e => e.employeeId).filter(Boolean);
    const leaveEmpProjects = await Project.find({
      'teamMembers.empId': { $in: onLeaveEmpIds },
      statusFlag: true,
      status: 'Ongoing',
    }).select('title projectId teamMembers').lean();
    const empProjectMap = {};
    leaveEmpProjects.forEach(p => {
      p.teamMembers.forEach(m => {
        if (!empProjectMap[m.empId]) empProjectMap[m.empId] = [];
        empProjectMap[m.empId].push({ title: p.title, projectId: p.projectId, status: p.status });
      });
    });
    const onLeaveEnriched = onLeaveEnrichedBase.map(e => ({
      ...e,
      projects: empProjectMap[e.employeeId] || [],
    }));

    // Present employee details (enrich with User fields)
    const presentUserIds = todayAtt.map(a => a.userId);
    const presentUsersData = await User.find({ _id: { $in: presentUserIds } })
      .select('employeeId designation domain photo').lean();
    const presentUsersMap = {};
    presentUsersData.forEach(u => { presentUsersMap[u._id.toString()] = u; });

    const presentEmployees = todayAtt.map(a => {
      const u = presentUsersMap[a.userId?.toString()] || {};
      const ci = new Date(a.checkInTime);
      const isLate = ci.getHours() > 9 || (ci.getHours() === 9 && ci.getMinutes() > 30);
      return {
        name: a.userName,
        employeeId: u.employeeId || '',
        designation: u.designation || '',
        domain: u.domain || '',
        photo: u.photo || null,
        checkInTime: a.checkInTime,
        checkOutTime: a.checkOutTime || null,
        isLate,
      };
    });

    // Absent employees (not present and not on leave)
    const absentUsersData = await User.find({
      role: 'employee',
      _id: { $nin: [...presentUserIds, ...onLeaveUserIds] },
    }).select('name employeeId designation domain photo createdAt').lean();

    // All employees for overview table
    const recentEmployees = await User.find({ role: 'employee' })
      .sort({ createdAt: -1 })
      .select('name designation domain employeeId photo createdAt');

    const onLeaveCount = onLeaveRaw.length;
    const absentCount = absentUsersData.length;

    res.json({
      totalEmployees,
      newJoined,
      onBreakCount,
      presentCount,
      lateCount,
      onLeaveCount,
      absentCount,
      monthlyData,
      ongoingProjects,
      completedProjects,
      pendingProjects,
      totalProjects: ongoingProjects + completedProjects + pendingProjects,
      ongoingProjectsList,
      onLeave: onLeaveEnriched,
      presentEmployees,
      lateEmployees: presentEmployees.filter(e => e.isLate),
      absentEmployees: absentUsersData,
      onBreakEmployees,
      recentEmployees,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch admin stats', error: err.message });
  }
});

// GET /api/users/employee-dashboard — rich self-service dashboard data
router.get('/employee-dashboard', protect, async (req, res) => {
  try {
    const userId  = req.user._id;
    const empId   = req.user.employeeId;
    const now     = new Date();
    const year    = now.getFullYear();
    const month   = now.getMonth();
    const todayStr = now.toISOString().split('T')[0];
    const startStr = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay  = new Date(year, month + 1, 0);
    const endStr   = lastDay.toISOString().split('T')[0];
    const daysInMonth = lastDay.getDate();

    const [attendance, projects, tasks, leaves] = await Promise.all([
      Attendance.find({ userId, date: { $gte: startStr, $lte: todayStr } }).sort({ date: 1 }).lean(),
      Project.find({ 'teamMembers.empId': empId, statusFlag: true }).select('projectId title status manager').lean(),
      HRTask.find({ assignedTo: empId }).sort({ createdAt: -1 }).lean(),
      Leave.find({
        userId,
        status: 'Approved',
        startDate: { $lte: new Date(endStr + 'T23:59:59') },
        endDate:   { $gte: new Date(startStr + 'T00:00:00') },
      }).lean(),
    ]);

    // Build leave date set
    const leaveDates = new Set();
    for (const lv of leaves) {
      for (let d = new Date(lv.startDate); d <= new Date(lv.endDate); d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split('T')[0];
        if (ds >= startStr && ds <= endStr) leaveDates.add(ds);
      }
    }

    // Build attendance map
    const attMap = {};
    for (const a of attendance) attMap[a.date] = a;

    // Build calendar + aggregate stats
    const calendarDays = [];
    let workingDays = 0, presentDays = 0, leaveDayCount = 0, totalWorkHours = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const ds  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = new Date(ds).getDay(); // 0=Sun 6=Sat
      const isWeekend = dow === 0 || dow === 6;
      const isFuture  = ds > todayStr;
      const isToday   = ds === todayStr;
      let status = 'future', checkIn = null, checkOut = null, workingHours = 0;

      if (isWeekend) {
        status = 'weekend';
      } else if (isFuture) {
        status = 'future';
      } else {
        workingDays++;
        const att      = attMap[ds];
        const onLeave  = leaveDates.has(ds);
        if (att) {
          presentDays++;
          totalWorkHours += att.workingHours || 0;
          checkIn      = att.checkInTime;
          checkOut     = att.checkOutTime;
          workingHours = att.workingHours || 0;
          const ci  = new Date(att.checkInTime);
          const late = ci.getHours() > 9 || (ci.getHours() === 9 && ci.getMinutes() > 30);
          status = late ? 'late' : 'present';
        } else if (onLeave) {
          leaveDayCount++;
          status = 'leave';
        } else {
          status = 'absent';
        }
      }
      calendarDays.push({ date: ds, day: d, dow, status, checkIn, checkOut, workingHours, isToday });
    }

    const totalTasks       = tasks.length;
    const completedTasks   = tasks.filter(t => t.status === 'Completed').length;
    const activeProjects   = projects.filter(p => p.status === 'Ongoing').length;
    const completedProjects= projects.filter(p => p.status === 'Completed').length;
    const effectiveWorkDays= workingDays - leaveDayCount;
    const attendanceRate   = effectiveWorkDays > 0 ? Math.round((presentDays / effectiveWorkDays) * 100) : 100;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      attendanceDaysThisMonth:  presentDays,
      workingHoursThisMonth:    Math.round(totalWorkHours * 10) / 10,
      totalWorkingDaysThisMonth: effectiveWorkDays,
      activeProjects, completedProjects, totalProjects: projects.length,
      completedTasks, totalTasks,
      attendanceRate, taskCompletionRate,
      avgWorkingHoursPerDay: presentDays > 0 ? Math.round((totalWorkHours / presentDays) * 10) / 10 : 0,
      calendarDays, projects, tasks,
      monthYear: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch employee dashboard', error: err.message });
  }
});

// GET /api/users/search?query=... — search employees by name for chat
router.get('/search', protect, async (req, res) => {
  try {
    const q = (req.query.query || '').trim();
    if (!q) return res.json([]);
    const users = await User.find({
      name: { $regex: q, $options: 'i' },
      _id: { $ne: req.user._id },
    })
      .select('_id name photo designation employeeId role')
      .limit(20)
      .lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Search failed', error: err.message });
  }
});

router.get('/:id', protect, getUserById);
router.put('/:id/profile', protect, updateUserProfile);
router.put('/:id', protect, hrOrAdmin, updateUser);
router.delete('/:id', protect, hrOrAdmin, deleteUser);

export default router;