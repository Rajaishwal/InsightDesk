import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
    },
    checkInTime: {
      type: Date,
      required: true,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    workingHours: {
      type: Number, // in hours
      default: 0,
    },
    status: {
      type: String,
      enum: ["checked-in", "checked-out"],
      default: "checked-in",
    },
    location: {
      type: String,
      default: "Office",
    },
  },
  { 
    timestamps: true 
  }
);

// Create compound index to ensure one attendance record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

// Method to calculate working hours
attendanceSchema.methods.calculateWorkingHours = function() {
  if (this.checkOutTime && this.checkInTime) {
    const diffInMs = this.checkOutTime - this.checkInTime;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    this.workingHours = Math.round(diffInHours * 100) / 100; // Round to 2 decimal places
    return this.workingHours;
  }
  return 0;
};

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
