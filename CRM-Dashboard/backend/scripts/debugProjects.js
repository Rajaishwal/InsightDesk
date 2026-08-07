import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User    from '../model/User.js';
import Project from '../model/Project.js';

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOne({ employeeId: 'IDE002' }).select('employeeId email name').lean();

const fixed = await Project.find({
  $or: [{ 'teamMembers.empId': user.employeeId }, { 'teamMembers.empEmail': user.email }],
  statusFlag: true,
}).select('projectId title status').lean();

console.log('Projects with $or fix:', fixed.map(p => `${p.title} (${p.status})`));

await mongoose.disconnect();