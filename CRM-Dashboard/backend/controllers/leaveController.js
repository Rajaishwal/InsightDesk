import mongoose from 'mongoose';
import Leave from '../model/Leave.js';
import User from '../model/User.js';
import MonthlyLeaveAllocation from '../model/MonthlyLeaveAllocation.js';

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

// Apply for leave
export const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
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

    // const overlappingLeave = await Leave.findOne({
    //   userId,
    //   status: { $in: ['Pending', 'Approved'] },
    //   startDate: { $lte: end },
    //   endDate: { $gte: start }
    // });


    if (overlappingLeave) {
      return res.status(400).json({ message: 'You already have a leave request for overlapping dates' });
    }

    // Calculate working days (excluding weekends) and check monthly allocation
    const requestedDays = calculateWorkingDays(start, end);
    
    if (requestedDays <= 0) {
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
      leaveType,
      startDate: start,
      endDate: end,
      reason
    });

    await newLeave.save();

    // Update monthly allocation - add to pending leaves
    await MonthlyLeaveAllocation.updateLeaveCount(userId, leaveYear, leaveMonth, 0, requestedDays);

    res.status(201).json({
      message: 'Leave application submitted successfully',
      leave: newLeave
    });
  } catch (error) {
    console.error('Apply leave error:', error);
    res.status(500).json({ message: 'Server error while applying for leave' });
  }
};

// Get user's leaves
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

// Get all leaves (HR/Admin only)
export const getAllLeaves = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, userId, startDate, endDate } = req.query;

    const query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }

    const leaves = await Leave.find(query)
      .populate('userId', 'name email')
      .populate('approvedBy', 'name')
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
    console.error('Get all leaves error:', error);
    res.status(500).json({ message: 'Server error while fetching all leaves' });
  }
};


// Get leave statistics
export const getLeaveStats = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
    
    
    // Get or create monthly allocation for current month
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
// Get all leave requests for HR management
export const getAllLeaveRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, startDate, endDate } = req.query;
    
    // Build filter object
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    
    const leaves = await Leave.find(filter)
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email');

    const totalRecords = await Leave.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      leaves,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRecords,
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

    // Update leave status
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
export const getHRLeaveStats = async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Get all leave requests
    const totalRequests = await Leave.countDocuments();
    
    // Get pending requests
    const pendingRequests = await Leave.countDocuments({ status: 'Pending' });
    
    // Get approved requests this month
    const approvedThisMonth = await Leave.countDocuments({
      status: 'Approved',
      appliedAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });
    
    // Get rejected requests this month
    const rejectedThisMonth = await Leave.countDocuments({
      status: 'Rejected',
      appliedAt: {
        $gte: new Date(currentYear, currentMonth, 1),
        $lt: new Date(currentYear, currentMonth + 1, 1)
      }
    });

    res.json({
      totalRequests,
      pendingRequests,
      approvedThisMonth,
      rejectedThisMonth
    });
  } catch (error) {
    console.error('Get HR leave stats error:', error);
    res.status(500).json({ message: 'Server error while fetching HR leave statistics' });
  }
};

// Process monthly carry-forward for all users (Admin function)
export const processMonthlyCarryForward = async (req, res) => {
  try {
    const { year, month } = req.body;
    
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Valid year and month (1-12) are required' });
    }

    // Get all unique users who have leave allocations
    const users = await MonthlyLeaveAllocation.distinct('userId');
    
    let processedCount = 0;
    const errors = [];

    for (const userId of users) {
      try {
        // Get previous month allocation
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;
        
        const prevAllocation = await MonthlyLeaveAllocation.findOne({
          userId,
          year: prevYear,
          month: prevMonth
        });

        if (prevAllocation && prevAllocation.remainingLeaves > 0) {
          // Create or update current month allocation with carry forward
          await MonthlyLeaveAllocation.getOrCreateAllocation(userId, year, month);
          processedCount++;
        }
      } catch (error) {
        errors.push({ userId, error: error.message });
      }
    }

    res.json({
      message: `Processed carry-forward for ${processedCount} users`,
      processedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Process monthly carry forward error:', error);
    res.status(500).json({ message: 'Server error while processing monthly carry forward' });
  }
};

// Get user's monthly allocation details
export const getMonthlyAllocation = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { year, month } = req.query;
    
    const currentDate = new Date();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;

    const allocation = await MonthlyLeaveAllocation.getOrCreateAllocation(
      userId, 
      targetYear, 
      targetMonth
    );

    res.json({
      allocation,
      monthInfo: {
        year: targetYear,
        month: targetMonth,
        monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
      }
    });
  } catch (error) {
    console.error('Get monthly allocation error:', error);
    res.status(500).json({ message: 'Server error while fetching monthly allocation' });
  }
};
