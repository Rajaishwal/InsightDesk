import mongoose from 'mongoose';
import Leave from '../model/Leave.js';
import User from '../model/User.js';
import MonthlyLeaveAllocation from '../model/MonthlyLeaveAllocation.js';
import { getIo } from '../socket.js';
import { istDateKey } from '../utils/istDate.js';

// Utility function to calculate working days (excluding weekends)
const calculateWorkingDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let workingDays = 0;
  
  // Iterate through each day between start and end (inclusive)
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Saturday (6) and Sunday (0)
      workingDays++;
    }
  }
  
  return workingDays;
};

export const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason, halfDay } = req.body;
    const userId = req.user._id || req.user.id;

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start < today) {
      return res.status(400).json({ message: 'Start date cannot be in the past' });
    }

    if (end < start) {
      return res.status(400).json({ message: 'End date cannot be before start date' });
    }

    // Check for overlapping leaves
    const overlappingLeave = await Leave.findOne({
      userId,
      status: { $in: ['Pending', 'Approved'] },
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    if (overlappingLeave) {
      return res.status(400).json({ message: 'You already have a leave request for overlapping dates' });
    }

    // Calculate working days (excluding weekends) and check monthly allocation
    // For half-day leaves, use 0.5 regardless of the date range
    const requestedDays = halfDay ? 0.5 : calculateWorkingDays(start, end);

    if (!halfDay && requestedDays <= 0) {
      return res.status(400).json({ message: 'No working days found in the selected date range' });
    }
    
    // Get or create monthly allocation for the leave month
    const leaveYear = start.getFullYear();
    const leaveMonth = start.getMonth() + 1;
    const allocation = await MonthlyLeaveAllocation.getOrCreateAllocation(userId, leaveYear, leaveMonth);
    
    // Calculate what would be the new pending total if this request is added
    const newPendingTotal = allocation.pendingLeaves + requestedDays;
    const newRemainingAfterRequest = allocation.totalAllocation - allocation.usedLeaves - newPendingTotal;
    
    // Check if user has enough leaves available (considering current pending + new request)
    if (newRemainingAfterRequest < 0) {
      return res.status(400).json({ 
        message: `Cannot apply for ${requestedDays} days. You would exceed your monthly allocation. Available: ${allocation.remainingLeaves} days (Total: ${allocation.totalAllocation}, Used: ${allocation.usedLeaves}, Pending: ${allocation.pendingLeaves})` 
      });
    }

    // Create new leave request
    const newLeave = new Leave({
      userId: new mongoose.Types.ObjectId(userId),
      userName: user.name,
      userEmail: user.email,
      userEmployeeId: user.employeeId || '',
      leaveType,
      startDate: start,
      endDate: end,
      reason,
      halfDay: !!halfDay
    });

    await newLeave.save();

    // Update monthly allocation - add to pending leaves
    await MonthlyLeaveAllocation.updateLeaveCount(userId, leaveYear, leaveMonth, 0, requestedDays);

    getIo()?.emit("leave:updated");
    res.status(201).json({
      message: 'Leave application submitted successfully',
      leave: newLeave
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'Server error while applying for leave' });
  }
};

export const getUserLeaves = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const leaves = await Leave.find(query)
      .sort({ appliedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Leave.countDocuments(query);

    res.json({
      leaves,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalLeaves: total
    });
  } catch (error) {
    console.error('Get user leaves error:', error);
    res.status(500).json({ message: 'Server error while fetching leaves' });
  }
};

export const getLeaveStats = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

    const allocation = await MonthlyLeaveAllocation.getOrCreateAllocation(userId, currentYear, currentMonth);

    // Get detailed leave counts for current month
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0);

    const stats = await Leave.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          startDate: { $gte: monthStart, $lte: monthEnd }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        }
      }
    ]);

    let approvedDays = 0;
    let pendingDays = 0;
    let rejectedDays = 0;

    stats.forEach(stat => {
      if (stat._id === 'Approved') {
        approvedDays = stat.totalDays || 0;
      } else if (stat._id === 'Pending') {
        pendingDays = stat.totalDays || 0;
      } else if (stat._id === 'Rejected') {
        rejectedDays = stat.totalDays || 0;
      }
    });

    // Update allocation with current usage
    await MonthlyLeaveAllocation.updateLeaveCount(
      userId, 
      currentYear, 
      currentMonth, 
      approvedDays - allocation.usedLeaves, 
      pendingDays - allocation.pendingLeaves
    );

    // Refresh allocation data
    const updatedAllocation = await MonthlyLeaveAllocation.findOne({ 
      userId, 
      year: currentYear, 
      month: currentMonth 
    });

    const result = {
      taken: approvedDays,
      pending: pendingDays,
      rejected: rejectedDays,
      totalDaysTaken: approvedDays,
      totalDaysPending: pendingDays,
      remaining: updatedAllocation.remainingLeaves,
      monthlyAllocation: {
        baseLeaves: updatedAllocation.baseAllocation,
        carriedForward: updatedAllocation.carriedForward,
        totalAllocation: updatedAllocation.totalAllocation,
        usedLeaves: updatedAllocation.usedLeaves,
        pendingLeaves: updatedAllocation.pendingLeaves,
        remainingLeaves: updatedAllocation.remainingLeaves
      }
    };

    res.json(result);
  } catch (error) {
    console.error('Get leave stats error:', error);
    res.status(500).json({ message: 'Server error while fetching leave statistics' });
  }
};

// HR-specific endpoints
// GET /api/leaves/hr/all-requests?status&userId&startDate&endDate&page&limit
// Dates filter on the leave's start day ("YYYY-MM-DD"). `counts` = requests per status for the same
// employee/date filters (ignoring status) — for the status switch in the HR toolbar.
export const getAllLeaveRequests = async (req, res) => {
  try {
    const { status, userId, startDate, endDate } = req.query;
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const base = {};
    if (userId && mongoose.isValidObjectId(userId)) base.userId = new mongoose.Types.ObjectId(userId);
    if (startDate || endDate) {
      base.startDate = {};
      if (startDate) base.startDate.$gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) base.startDate.$lte = new Date(`${endDate}T00:00:00.000Z`);
    }
    const filter = status && status !== 'all' ? { ...base, status } : base;

    const [rawLeaves, totalRecords, byStatus] = await Promise.all([
      Leave.find(filter)
        .sort({ appliedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email employeeId photo designation'),
      Leave.countDocuments(filter),
      Leave.aggregate([{ $match: base }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    ]);

    // Merge the employee's ID / photo / designation into each leave
    const leaves = rawLeaves.map(l => {
      const obj = l.toObject();
      obj.userEmployeeId = obj.userEmployeeId || l.userId?.employeeId || '';
      obj.userPhoto = l.userId?.photo || null;
      obj.userDesignation = l.userId?.designation || '';
      return obj;
    });

    const counts = { Pending: 0, Approved: 0, Rejected: 0 };
    byStatus.forEach((s) => { counts[s._id] = s.n; });
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit));

    res.json({
      leaves,
      counts: { ...counts, all: counts.Pending + counts.Approved + counts.Rejected },
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get all leave requests error:', error);
    res.status(500).json({ message: 'Server error while fetching leave requests' });
  }
};

// Approve or reject leave request (HR only)
export const updateLeaveStatus = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { status, hrComments } = req.body;

    // Validate status
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be Approved or Rejected' });
    }

    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return res.status(404).json({ message: 'Leave request not found' });
    }

    const oldStatus = leave.status;
    const leaveYear = leave.startDate.getFullYear();
    const leaveMonth = leave.startDate.getMonth() + 1;
    const leaveDays = leave.totalDays;

    leave.status = status;
    leave.hrComments = hrComments || '';
    leave.reviewedAt = new Date();
    leave.reviewedBy = req.user._id;

    await leave.save();

    // Update monthly allocation based on status change
    if (oldStatus === 'Pending') {
      if (status === 'Approved') {
        // Move from pending to used
        await MonthlyLeaveAllocation.updateLeaveCount(
          leave.userId, 
          leaveYear, 
          leaveMonth, 
          leaveDays, // Add to used
          -leaveDays  // Remove from pending
        );
      } else if (status === 'Rejected') {
        // Remove from pending (add back to available)
        await MonthlyLeaveAllocation.updateLeaveCount(
          leave.userId, 
          leaveYear, 
          leaveMonth, 
          0, // No change to used
          -leaveDays  // Remove from pending
        );
      }
    } else if (oldStatus === 'Approved' && status === 'Rejected') {
      // Move from used back to available
      await MonthlyLeaveAllocation.updateLeaveCount(
        leave.userId, 
        leaveYear, 
        leaveMonth, 
        -leaveDays, // Remove from used
        0  // No change to pending
      );
    } else if (oldStatus === 'Rejected' && status === 'Approved') {
      // Check if user still has enough leaves available
      const allocation = await MonthlyLeaveAllocation.getOrCreateAllocation(
        leave.userId, 
        leaveYear, 
        leaveMonth
      );
      
      if (leaveDays > allocation.remainingLeaves) {
        return res.status(400).json({ 
          message: `Cannot approve: Insufficient leave balance. User has ${allocation.remainingLeaves} days remaining this month.` 
        });
      }
      
      // Move to used
      await MonthlyLeaveAllocation.updateLeaveCount(
        leave.userId, 
        leaveYear, 
        leaveMonth, 
        leaveDays, // Add to used
        0  // No change to pending
      );
    }

    // Populate user details for response
    await leave.populate('userId', 'name email');

    res.json({
      message: `Leave request ${status.toLowerCase()} successfully`,
      leave
    });
  } catch (error) {
    console.error('Update leave status error:', error);
    res.status(500).json({ message: 'Server error while updating leave status' });
  }
};

// Get leave statistics for HR dashboard
// GET /api/leaves/hr/employees — one entry per employee for the HR leave view: who they are, how many requests
// per status, approved days this year (IST), their latest request and their latest decided (approved / rejected) one.
// Everyone with the employee role is listed, plus anyone else who has applied for leave.
export const getLeaveEmployees = async (req, res) => {
  try {
    const yearStart = new Date(`${istDateKey().slice(0, 4)}-01-01T00:00:00.000Z`); // leave dates = UTC-midnight days

    const [users, perUser] = await Promise.all([
      User.find({}).select('name email employeeId photo designation role').lean(),
      Leave.aggregate([
        { $sort: { startDate: -1, appliedAt: -1 } },
        {
          $group: {
            _id: '$userId',
            userName: { $first: '$userName' },
            userEmployeeId: { $first: '$userEmployeeId' },
            total:    { $sum: 1 },
            pending:  { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } },
            // when their oldest still-pending request was applied (first come, first served); $min skips the nulls
            pendingSince: { $min: { $cond: [{ $eq: ['$status', 'Pending'] }, '$appliedAt', null] } },
            approvedDaysThisYear: {
              $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Approved'] }, { $gte: ['$startDate', yearStart] }] }, '$totalDays', 0] },
            },
            all: { $push: { _id: '$_id', leaveType: '$leaveType', startDate: '$startDate', endDate: '$endDate', totalDays: '$totalDays', status: '$status', appliedAt: '$appliedAt' } },
          },
        },
        {
          $project: {
            userName: 1, userEmployeeId: 1,
            total: 1, pending: 1, approved: 1, rejected: 1, approvedDaysThisYear: 1, pendingSince: 1,
            latest: { $arrayElemAt: ['$all', 0] },
            latestDecided: { $arrayElemAt: [{ $filter: { input: '$all', cond: { $ne: ['$$this.status', 'Pending'] } } }, 0] },
          },
        },
      ]),
    ]);

    const statsBy = Object.fromEntries(perUser.map((s) => [String(s._id), s]));
    const userIds = new Set(users.map((u) => String(u._id)));
    const entry = (u, s, former = false) => ({
      _id: u._id,
      name: u.name,
      email: u.email || '',
      employeeId: u.employeeId || '',
      designation: u.designation || '',
      photo: u.photo || null,
      former, // has leave on record but is no longer in the user list
      counts: { total: s?.total || 0, pending: s?.pending || 0, approved: s?.approved || 0, rejected: s?.rejected || 0 },
      pendingSince: s?.pendingSince || null,
      approvedDaysThisYear: s?.approvedDaysThisYear || 0,
      latest: s?.latest || null,
      latestDecided: s?.latestDecided || null,
    });

    const employees = [
      ...users
        .filter((u) => u.role === 'employee' || statsBy[String(u._id)])
        .map((u) => entry(u, statsBy[String(u._id)])),
      // leave requests whose person was removed — still listed so totals add up
      ...perUser
        .filter((s) => !userIds.has(String(s._id)))
        .map((s) => entry({ _id: s._id, name: s.userName, employeeId: s.userEmployeeId }, s, true)),
    ]
      // Waiting for a decision always on top, first come first served (earliest applied first);
      // then everyone else by most recent leave, then by name
      .sort((a, b) => {
        const ap = a.counts.pending > 0, bp = b.counts.pending > 0;
        if (ap !== bp) return ap ? -1 : 1;
        if (ap) return new Date(a.pendingSince) - new Date(b.pendingSince);
        return new Date(b.latest?.startDate || 0) - new Date(a.latest?.startDate || 0) ||
          (a.name || '').localeCompare(b.name || '');
      });

    res.json({ employees });
  } catch (error) {
    console.error('Get leave employees error:', error);
    res.status(500).json({ message: 'Server error while fetching employees\' leave' });
  }
};

// GET /api/leaves/hr/stats — all-time counts per status, who is on approved leave today,
// and approved leave starting this month. "Today" / "this month" are India time; leave dates are
// stored as UTC-midnight calendar days, so compare against the same.
export const getHRLeaveStats = async (req, res) => {
  try {
    const todayKey   = istDateKey();
    const today      = new Date(`${todayKey}T00:00:00.000Z`);
    const monthStart = new Date(`${todayKey.slice(0, 8)}01T00:00:00.000Z`);
    const nextMonth  = new Date(monthStart);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

    const [byStatus, onLeave, approvedMonth] = await Promise.all([
      Leave.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Leave.find({ status: 'Approved', startDate: { $lte: today }, endDate: { $gte: today } })
        .populate('userId', 'name photo employeeId')
        .select('userId userName leaveType halfDay')
        .lean(),
      Leave.aggregate([
        { $match: { status: 'Approved', startDate: { $gte: monthStart, $lt: nextMonth } } },
        { $group: { _id: null, n: { $sum: 1 }, days: { $sum: '$totalDays' } } },
      ]),
    ]);

    const count = { Pending: 0, Approved: 0, Rejected: 0 };
    byStatus.forEach((s) => { count[s._id] = s.n; });

    res.json({
      totalRequests: count.Pending + count.Approved + count.Rejected,
      pendingRequests: count.Pending,
      approvedRequests: count.Approved,
      rejectedRequests: count.Rejected,
      approvedThisMonth: approvedMonth[0]?.n || 0,
      approvedDaysThisMonth: approvedMonth[0]?.days || 0,
      onLeaveToday: onLeave.map((l) => ({
        _id: l.userId?._id || l._id,
        name: l.userId?.name || l.userName,
        photo: l.userId?.photo || null,
        employeeId: l.userId?.employeeId || '',
        leaveType: l.leaveType,
        halfDay: !!l.halfDay,
      })),
    });
  } catch (error) {
    console.error('Get HR leave stats error:', error);
    res.status(500).json({ message: 'Server error while fetching HR leave statistics' });
  }
};

// Cancel a pending leave (employee only)
export const cancelLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const userId = req.user._id || req.user.id;

    const leave = await Leave.findById(leaveId);
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    if (leave.userId.toString() !== userId.toString())
      return res.status(403).json({ message: 'Not authorized to cancel this leave' });

    if (leave.status !== 'Pending')
      return res.status(400).json({ message: 'Only pending leaves can be cancelled' });

    const leaveYear  = leave.startDate.getFullYear();
    const leaveMonth = leave.startDate.getMonth() + 1;
    const leaveDays  = leave.totalDays;

    await Leave.findByIdAndDelete(leaveId);
    await MonthlyLeaveAllocation.updateLeaveCount(userId, leaveYear, leaveMonth, 0, -leaveDays);

    getIo()?.emit("leave:updated");
    res.json({ message: 'Leave request cancelled successfully' });
  } catch (error) {
    console.error('Cancel leave error:', error);
    res.status(500).json({ message: 'Server error while cancelling leave' });
  }
};

