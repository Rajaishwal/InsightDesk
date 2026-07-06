import mongoose from 'mongoose';

const monthlyLeaveAllocationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  baseAllocation: {
    type: Number,
    default: 5, // Base 5 leaves per month
    required: true
  },
  carriedForward: {
    type: Number,
    default: 0, // Leaves carried from previous month
    min: 0
  },
  totalAllocation: {
    type: Number,
    default: 5
  },
  usedLeaves: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingLeaves: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingLeaves: {
    type: Number,
    default: 5
  },
  isCarryForwardProcessed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Calculate total and remaining leaves automatically
monthlyLeaveAllocationSchema.pre('save', function(next) {
  // Ensure totalAllocation is calculated
  if (!this.totalAllocation || this.isModified('baseAllocation') || this.isModified('carriedForward')) {
    this.totalAllocation = (this.baseAllocation || 5) + (this.carriedForward || 0);
  }
  
  // Ensure remainingLeaves is calculated
  if (!this.remainingLeaves || this.isModified('totalAllocation') || this.isModified('usedLeaves') || this.isModified('pendingLeaves')) {
    this.remainingLeaves = this.totalAllocation - (this.usedLeaves || 0) - (this.pendingLeaves || 0);
  }
  
  this.updatedAt = new Date();
  next();
});

// Ensure one record per user per month
monthlyLeaveAllocationSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

// Static method to get or create allocation for a user's month
monthlyLeaveAllocationSchema.statics.getOrCreateAllocation = async function(userId, year, month) {
  let allocation = await this.findOne({ userId, year, month });
  
  if (!allocation) {
    // Get previous month's allocation to check for carry forward
    let carriedForward = 0;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    
    const prevAllocation = await this.findOne({ 
      userId, 
      year: prevYear, 
      month: prevMonth 
    });
    
    if (prevAllocation && prevAllocation.remainingLeaves > 0) {
      carriedForward = prevAllocation.remainingLeaves;
    }
    
    const baseAllocation = 5;
    const totalAllocation = baseAllocation + carriedForward;
    
    // Create new allocation
    allocation = new this({
      userId,
      year,
      month,
      baseAllocation,
      carriedForward,
      totalAllocation,
      usedLeaves: 0,
      pendingLeaves: 0,
      remainingLeaves: totalAllocation
    });
    
    await allocation.save();
  }
  
  return allocation;
};

// Static method to update leave counts when leave status changes
monthlyLeaveAllocationSchema.statics.updateLeaveCount = async function(userId, year, month, usedChange = 0, pendingChange = 0) {
  const allocation = await this.getOrCreateAllocation(userId, year, month);
  
  allocation.usedLeaves = Math.max(0, allocation.usedLeaves + usedChange);
  allocation.pendingLeaves = Math.max(0, allocation.pendingLeaves + pendingChange);
  
  await allocation.save();
  return allocation;
};

export default mongoose.model('MonthlyLeaveAllocation', monthlyLeaveAllocationSchema);
