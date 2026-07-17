import mongoose from 'mongoose';

const projectTaskSchema = new mongoose.Schema({
  projectId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  status: {
    type: String,
    enum: ['Pending', 'Ongoing', 'Completed'],
    default: 'Pending',
  },
  isRevision: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdByName: {
    type: String,
    required: true,
  },
  createdByRole: {
    type: String, // 'employee' | 'hr' | 'admin'
    default: 'employee',
  },
  completedAt: {
    type: Date,
  },
  timers: [{
    userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName:        { type: String },
    timerStartedAt:  { type: Date, default: null },
    totalTimeLogged: { type: Number, default: 0 }, // seconds
    _id: false,
  }],
}, {
  timestamps: true,
  versionKey: false,
});

export default mongoose.model('ProjectTask', projectTaskSchema);