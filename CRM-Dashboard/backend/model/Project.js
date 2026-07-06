
import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema({
  empId: {
    type: String,
    required: true,
    trim: true
  },
  empEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  }
}, {
  _id: true,
  timestamps: false
});

const projectSchema = new mongoose.Schema({
  projectId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  manager: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  skills: [String],
  tools: [String],
  status: {
    type: String,
    required: true,
    enum: ['Ongoing', 'Completed', 'Pending'],
    default: 'Ongoing'
  },
  description: {
    type: String,
    trim: true
  },
  teamMembers: {
    type: [teamMemberSchema]
  },
  
  // ✅ Soft delete / active-archive flag
  statusFlag: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true,
  versionKey: false
});

const Project = mongoose.model('Project', projectSchema);

export default Project;
