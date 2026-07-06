import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['Sick Leave', 'Casual Leave', 'Annual Leave', 'Maternity Leave', 'Paternity Leave', 'Emergency Leave', 'Other']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    maxlength: 200
  },
  hrComments: {
    type: String,
    maxlength: 500
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  totalDays: {
    type: Number,
    min: 0.5
  },
  documents: [{
    filename: String,
    path: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  appliedAt: {
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

// Calculate working days automatically (excluding weekends)
leaveSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    // Ensure dates are Date objects
    const startDate = new Date(this.startDate);
    const endDate = new Date(this.endDate);
    
    // Check if dates are valid
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      // Calculate working days (excluding weekends)
      let workingDays = 0;
      
      // Iterate through each day between start and end (inclusive)
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Saturday (6) and Sunday (0)
          workingDays++;
        }
      }
      
      
      this.totalDays = Math.max(1, workingDays); // Ensure at least 1 working day
    } else {
      return next(new Error('Invalid start or end date provided'));
    }
  } else {
    return next(new Error('Start date and end date are required'));
  }
  
  this.updatedAt = new Date();
  next();
});

// Index for faster queries
leaveSchema.index({ userId: 1, status: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });
leaveSchema.index({ appliedAt: -1 });

export default mongoose.model('Leave', leaveSchema);
