import mongoose from "mongoose";

const hrTaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
    },
    description: {
      type: String,
    },
    taskCompletionTime: {
      type: String, // format: "HH:mm:ss"
      default: null, // HR cannot set this, employees update later
    },
    assignedTo: {
      type: String,
      required: true,
    },
    assignedToName: {
      type: String,
      required: true,
    },
    assignedToEmail: {
      type: String,
      required: true,
    },
    assignedBy: {
      type: String,
      required: true,
    },
    assignedByName: {
      type: String,
      required: true,
    },
    assignedByEmail: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Assigned", "In Progress", "Completed", "Failed"],
      default: "Assigned",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    timers: [{
      userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      userName:        { type: String },
      timerStartedAt:  { type: Date, default: null },
      totalTimeLogged: { type: Number, default: 0 },
      sessions: [{
        startTime: { type: Date, required: true },
        endTime:   { type: Date, required: true },
        duration:  { type: Number, required: true },
        _id: false,
      }],
      _id: false,
    }],
  },
  { timestamps: true },
);

const HRTask = mongoose.model("HRTask", hrTaskSchema);
export default HRTask;
