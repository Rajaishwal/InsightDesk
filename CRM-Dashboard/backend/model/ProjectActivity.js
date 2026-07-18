import mongoose from 'mongoose';

const projectActivitySchema = new mongoose.Schema({
  projectId:   { type: String, required: true, uppercase: true, index: true },
  projectName: { type: String, default: '' },
  taskId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask' },
  taskTitle:   { type: String, default: '' },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName:    { type: String, default: '' },
  action: {
    type: String,
    enum: ['task_created', 'status_changed', 'timer_started', 'timer_stopped', 'revision_added'],
    required: true,
  },
  fromStatus: { type: String, default: null },
  toStatus:   { type: String, default: null },
}, { timestamps: true, versionKey: false });

export default mongoose.model('ProjectActivity', projectActivitySchema);