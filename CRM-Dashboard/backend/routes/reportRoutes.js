// reportRoutes.js — Admin-only Employee Report: one request returns everything about one employee for a period
import express from 'express';
import User from '../model/User.js';
import Attendance from '../model/Attendance.js';
import Leave from '../model/Leave.js';
import Project from '../model/Project.js';
import ProjectTask from '../model/ProjectTask.js';
import ProjectActivity from '../model/ProjectActivity.js';
import HRTask from '../model/hrTaskModel.js';
import Break from '../models/Break.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { istDateKey, utcDateKey, addDaysKey, dowOfKey, istDayStart, istDayEnd, findOpenAttendance } from '../utils/istDate.js';

const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 100;

// Day keys are IST calendar days (same as Attendance.date); leave dates are UTC-midnight calendar dates
const dayKey = istDateKey;
const addDays = addDaysKey;
const dowOf = dowOfKey; // 0=Sun 6=Sat

// Clock-time in IST, as minutes after midnight
const istClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const istMinutes = (d) => { const [h, m] = istClock.format(new Date(d)).split(':').map(Number); return h * 60 + m; };
// Late = more than 30 min after the employee's own shift start ("02:00 PM - 09:00 PM"); 9:30 AM if no shift is set
const LATE_GRACE_MIN = 30;
const DEFAULT_LATE_AFTER_MIN = 9 * 60 + 30;
const lateCutoffFor = (shiftTiming) => {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(shiftTiming || '');
  if (!m) return DEFAULT_LATE_AFTER_MIN;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return h * 60 + Number(m[2]) + LATE_GRACE_MIN;
};
// A single timer session longer than this is a timer left running (pre-fix data), not real work — excluded and reported
const MAX_SESSION_SEC = 12 * 3600;

// GET /api/reports/employee/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/employee/:employeeId', protect, admin, async (req, res) => {
  try {
    const now = new Date();
    const todayStr = dayKey(now);

    // ── Period ────────────────────────────────────────────────────────────
    const from = DATE_RE.test(req.query.from || '') ? req.query.from : `${todayStr.slice(0, 8)}01`;
    const to   = DATE_RE.test(req.query.to   || '') ? req.query.to   : todayStr;
    if (from > to) return res.status(400).json({ message: '"from" must be on or before "to".' });
    const spanDays = (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000 + 1;
    if (spanDays > MAX_SPAN_DAYS) return res.status(400).json({ message: `Period can be at most ${MAX_SPAN_DAYS} days.` });
    const fromDate = istDayStart(from);
    const toDate   = istDayEnd(to);
    const inPeriod = (d) => d && new Date(d) >= fromDate && new Date(d) <= toDate;

    // ── Employee ──────────────────────────────────────────────────────────
    const emp = await User.findOne({ employeeId: req.params.employeeId })
      .select('name email employeeId designation domain shiftTiming photo phone experience skills role createdAt')
      .lean();
    if (!emp) return res.status(404).json({ message: `No employee found with ID ${req.params.employeeId}.` });
    const userId = emp._id;
    const uidStr = userId.toString();
    const year = Number(to.slice(0, 4));
    const lateAfterMin = lateCutoffFor(emp.shiftTiming);

    // ── Fetch everything in parallel ──────────────────────────────────────
    const [attendance, leaves, breaks, projects, projectTasks, hrTasks, activity, todayAtt, openBreak, openAtt] = await Promise.all([
      Attendance.find({ userId, date: { $gte: from, $lte: to } }).lean(),
      Leave.find({
        userId,
        startDate: { $lte: new Date(`${year}-12-31T23:59:59Z`) },
        endDate:   { $gte: new Date(`${year}-01-01T00:00:00Z`) },
      }).select('leaveType startDate endDate totalDays status halfDay reason appliedAt').sort({ startDate: -1 }).lean(),
      Break.find({ userId, startTime: { $gte: fromDate, $lte: toDate } }).lean(),
      Project.find({
        $or: [{ 'teamMembers.empId': emp.employeeId }, { 'teamMembers.empEmail': emp.email?.toLowerCase() }],
        statusFlag: true,
      }).select('projectId title status manager').lean(),
      ProjectTask.find({ $or: [{ 'timers.userId': userId }, { createdBy: userId }] }).lean(),
      HRTask.find({ assignedTo: emp.employeeId }).lean(),
      ProjectActivity.find({ userId, createdAt: { $gte: fromDate, $lte: toDate } })
        .select('projectId projectName taskTitle action fromStatus toStatus createdAt')
        .sort({ createdAt: -1 }).limit(15).lean(),
      Attendance.findOne({ userId, date: todayStr }).lean(),
      Break.findOne({ userId, endTime: null }).lean(),
      findOpenAttendance(Attendance, userId).lean(), // current session — may have started before midnight
    ]);

    // ── Leave days (approved) inside the period ───────────────────────────
    const leaveByDay = {}; // ds -> { leaveType, halfDay }
    for (const lv of leaves) {
      if (lv.status !== 'Approved') continue;
      for (let ds = utcDateKey(lv.startDate); ds <= utcDateKey(lv.endDate); ds = addDays(ds, 1)) {
        if (ds >= from && ds <= to) leaveByDay[ds] = { leaveType: lv.leaveType, halfDay: !!lv.halfDay };
      }
    }

    // ── Focus sessions (task timers) per day and per project ─────────────
    const focusByDay = {};
    const projectSec = {};      // projectId -> seconds in period
    const projectSecAll = {};   // projectId -> lifetime seconds
    const taskSecPeriod = {};   // taskId -> seconds in period
    let running = null;         // currently running timer
    const excludedSessions = [];
    const onDutyNow = !!openAtt;
    const addFocus = (ds, sec) => { focusByDay[ds] = (focusByDay[ds] || 0) + sec; };

    const collectTimers = (task, kind) => {
      const entry = (task.timers || []).find(t => t.userId?.toString() === uidStr);
      if (!entry) return;
      const id = task._id.toString();
      for (const s of entry.sessions || []) {
        const dur = s.duration || 0;
        if (dur > MAX_SESSION_SEC) {
          if (inPeriod(s.endTime)) excludedSessions.push({ taskTitle: task.title, hours: Math.round((dur / 3600) * 10) / 10, endedAt: s.endTime });
          continue;
        }
        if (kind === 'project') projectSecAll[task.projectId] = (projectSecAll[task.projectId] || 0) + dur;
        if (!inPeriod(s.endTime)) continue;
        addFocus(dayKey(s.endTime), dur);
        taskSecPeriod[id] = (taskSecPeriod[id] || 0) + dur;
        if (kind === 'project') projectSec[task.projectId] = (projectSec[task.projectId] || 0) + dur;
      }
      const done = task.status === 'Completed' || task.status === 'Failed';
      // A running timer only counts while the employee is checked in (timers can't run outside a work session)
      if (entry.timerStartedAt && !done && onDutyNow) {
        const elapsed = Math.max(0, Math.floor((now - new Date(entry.timerStartedAt)) / 1000));
        if (todayStr >= from && todayStr <= to) {
          addFocus(todayStr, elapsed);
          taskSecPeriod[id] = (taskSecPeriod[id] || 0) + elapsed;
          if (kind === 'project') projectSec[task.projectId] = (projectSec[task.projectId] || 0) + elapsed;
        }
        if (!running || new Date(entry.timerStartedAt) > new Date(running.since)) {
          running = { since: entry.timerStartedAt, taskTitle: task.title, projectId: kind === 'project' ? task.projectId : null };
        }
      }
    };
    projectTasks.forEach(t => collectTimers(t, 'project'));
    hrTasks.forEach(t => collectTimers(t, 'hr'));

    // ── Breaks per day ────────────────────────────────────────────────────
    const breakByDay = {};
    let breakCount = 0, breakSec = 0;
    for (const b of breaks) {
      const sec = b.endTime ? (b.durationInSeconds || 0) : Math.max(0, Math.floor((now - new Date(b.startTime)) / 1000));
      const ds = dayKey(b.startTime);
      breakByDay[ds] = (breakByDay[ds] || 0) + sec;
      breakCount++;
      breakSec += sec;
    }

    // ── Day-by-day log + attendance KPIs ──────────────────────────────────
    const attByDay = {};
    for (const a of attendance) attByDay[a.date] = a;

    const days = [];
    // presentDays/lateDays count working days only; weekend check-ins are tracked separately so the rate can't pass 100%
    let workingDays = 0, leaveDays = 0, presentDays = 0, lateDays = 0, absentDays = 0, weekendDays = 0, attendedDays = 0;
    let missedCheckouts = 0; // past days checked in but never checked out — no hours get recorded for them
    let hoursSum = 0, hoursCount = 0, checkInMinSum = 0;

    for (let ds = from; ds <= to; ds = addDays(ds, 1)) {
      const dow = dowOf(ds);
      const isWeekend = dow === 0 || dow === 6;
      const isFuture = ds > todayStr;
      const att = attByDay[ds];
      const lv = leaveByDay[ds];
      const todayNoShowYet = ds === todayStr && !att; // the day isn't over — not "absent" yet
      let status;

      if (isFuture) status = 'future';
      else if (lv && !lv.halfDay && !isWeekend) status = 'leave'; // approved full-day leave wins over a check-in that day
      else if (att) {
        const lateNow = istMinutes(att.checkInTime) > lateAfterMin;
        status = lv?.halfDay ? 'half-leave' : (lateNow ? 'late' : 'present'); // half-day leave: they worked the other half
        attendedDays++;
        checkInMinSum += istMinutes(att.checkInTime);
        if (att.checkOutTime) { hoursSum += att.workingHours || 0; hoursCount++; }
        else if (ds !== todayStr && String(att._id) !== String(openAtt?._id)) missedCheckouts++; // the live session isn't "missed"
        if (isWeekend) weekendDays++;
        else { presentDays++; if (lateNow && !lv?.halfDay) lateDays++; }
      } else if (todayNoShowYet && !isWeekend && !lv) status = 'today';
      else if (isWeekend) status = 'weekend';
      else if (lv) status = lv.halfDay ? 'half-leave' : 'leave';
      else status = 'absent';

      if (!isWeekend && !isFuture && status !== 'today') {
        workingDays++;
        if (lv) leaveDays += lv.halfDay ? 0.5 : 1;
        if (status === 'absent') absentDays++;
      }

      days.push({
        date: ds, dow, status,
        checkIn: att?.checkInTime || null,
        checkOut: att?.checkOutTime || null,
        hours: att?.workingHours || 0,
        focusSec: focusByDay[ds] || 0,
        breakSec: breakByDay[ds] || 0,
        leaveType: lv?.leaveType || null,
      });
    }

    const focusSec = Object.values(focusByDay).reduce((a, b) => a + b, 0);
    const expectedDays = Math.max(0, workingDays - leaveDays);
    const daysMeetingTarget = days.filter(d => d.focusSec >= 6.5 * 3600).length;
    const daysOverBreakLimit = Object.values(breakByDay).filter(s => s > 3600).length;

    // ── Tasks ─────────────────────────────────────────────────────────────
    const hoursBetween = (a, b) => (new Date(b) - new Date(a)) / 3600000;
    // HR tasks completed from the status dropdown before the fix have no completedAt — fall back to updatedAt
    const doneAt = (t) => t.completedAt || (t.status === 'Completed' ? t.updatedAt : null);
    const completedProject = projectTasks.filter(t => t.status === 'Completed' && inPeriod(doneAt(t)));
    const completedHr = hrTasks.filter(t => t.status === 'Completed' && inPeriod(doneAt(t)));
    const completedAll = [...completedProject, ...completedHr];
    const openProject = projectTasks.filter(t => t.status !== 'Completed').length;
    const openHr = hrTasks.filter(t => t.status === 'Assigned' || t.status === 'In Progress').length;
    const avgCompletionHours = completedAll.length
      ? completedAll.reduce((s, t) => s + hoursBetween(t.createdAt, doneAt(t)), 0) / completedAll.length
      : null;
    const revisionCount = projectTasks.filter(t => t.isRevision && inPeriod(t.createdAt)).length;
    const failedHr = hrTasks.filter(t => t.status === 'Failed' && inPeriod(t.updatedAt)).length;

    const projectTitle = Object.fromEntries(projects.map(p => [p.projectId, p.title]));
    const recentTasks = [
      ...projectTasks.map(t => ({ kind: 'Project', project: projectTitle[t.projectId] || t.projectId, isRevision: !!t.isRevision, ...t })),
      ...hrTasks.map(t => ({ kind: 'HR', project: null, isRevision: false, ...t })),
    ]
      .filter(t => inPeriod(t.updatedAt) || inPeriod(doneAt(t)) || taskSecPeriod[t._id.toString()])
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map(t => ({
        id: t._id, title: t.title, kind: t.kind, project: t.project, status: t.status,
        isRevision: t.isRevision, periodSec: taskSecPeriod[t._id.toString()] || 0,
        completedAt: doneAt(t) || null, updatedAt: t.updatedAt,
      }));

    // ── Projects ──────────────────────────────────────────────────────────
    const lastActivityByProject = {};
    for (const a of activity) if (!lastActivityByProject[a.projectId]) lastActivityByProject[a.projectId] = a.createdAt;
    const projectRows = projects.map(p => {
      const mine = projectTasks.filter(t => t.projectId === p.projectId);

      // When the employee's work on this project started / last happened, and how many work sessions it took
      let startedAt = null, lastWorkedAt = null, sessionCount = 0;
      const earlier = (a, b) => (!a || new Date(b) < new Date(a) ? b : a);
      const later = (a, b) => (!a || new Date(b) > new Date(a) ? b : a);
      for (const t of mine) {
        startedAt = earlier(startedAt, t.createdAt);
        const entry = (t.timers || []).find(x => x.userId?.toString() === uidStr);
        for (const s of entry?.sessions || []) {
          if ((s.duration || 0) > MAX_SESSION_SEC) continue; // stuck timers don't count as work
          sessionCount++;
          startedAt = earlier(startedAt, s.startTime);
          lastWorkedAt = later(lastWorkedAt, s.endTime);
        }
      }
      // A completed project "finished" when its last task was completed
      const doneTimes = mine.map(doneAt).filter(Boolean);
      const completedAt = p.status === 'Completed' && doneTimes.length
        ? doneTimes.reduce((a, b) => later(a, b))
        : null;

      return {
        projectId: p.projectId, title: p.title, status: p.status, manager: p.manager,
        tasksTotal: mine.length,
        tasksDone: mine.filter(t => t.status === 'Completed').length,
        tasksOngoing: mine.filter(t => t.status === 'Ongoing').length,
        periodSec: projectSec[p.projectId] || 0,
        totalSec: projectSecAll[p.projectId] || 0,
        sessionCount, startedAt, completedAt,
        lastWorkedAt: lastWorkedAt || lastActivityByProject[p.projectId] || null,
      };
    }).sort((a, b) => {
      // Ongoing first (most time this period), then completed (most recently finished)
      if ((a.status === 'Completed') !== (b.status === 'Completed')) return a.status === 'Completed' ? 1 : -1;
      if (a.status === 'Completed') return new Date(b.completedAt || 0) - new Date(a.completedAt || 0);
      return b.periodSec - a.periodSec || b.totalSec - a.totalSec;
    });

    // ── Live status ───────────────────────────────────────────────────────
    let live = { state: 'offline', since: null };
    if (openAtt) {
      live = { state: 'checked-in', since: openAtt.checkInTime };
      if (openBreak) live = { state: 'on-break', since: openBreak.startTime };
      else if (running) live = { state: 'working', since: running.since, taskTitle: running.taskTitle, projectId: running.projectId };
    } else if (todayAtt?.checkOutTime) live = { state: 'checked-out', since: todayAtt.checkOutTime };

    res.json({
      employee: emp,
      period: { from, to, workingDays, leaveDays, expectedDays },
      live,
      kpis: {
        presentDays, lateDays, absentDays, weekendDays, attendedDays,
        attendanceRate: expectedDays > 0 ? Math.round((presentDays / expectedDays) * 100) : null,
        punctualityRate: presentDays > 0 ? Math.round(((presentDays - lateDays) / presentDays) * 100) : null,
        avgHoursPerDay: hoursCount ? Math.round((hoursSum / hoursCount) * 10) / 10 : null,
        missedCheckouts,
        avgCheckInMin: attendedDays ? Math.round(checkInMinSum / attendedDays) : null,
        lateAfterMin,
        focusSec,
        avgFocusSecPerDay: attendedDays ? Math.round(focusSec / attendedDays) : null,
        daysMeetingTarget,
        breakCount, breakSec,
        avgBreakSec: breakCount ? Math.round(breakSec / breakCount) : null,
        daysOverBreakLimit,
        tasksCompleted: completedAll.length,
        tasksCompletedProject: completedProject.length,
        tasksCompletedHr: completedHr.length,
        tasksOpen: openProject + openHr,
        avgCompletionHours: avgCompletionHours === null ? null : Math.round(avgCompletionHours * 10) / 10,
        revisionCount, failedHr,
      },
      days,
      projects: projectRows,
      tasks: recentTasks,
      leaves,
      activity,
      excludedSessions,
    });
  } catch (err) {
    console.error('Employee report error:', err);
    res.status(500).json({ message: 'Failed to build employee report', error: err.message });
  }
});

export default router;
