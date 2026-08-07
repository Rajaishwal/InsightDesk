import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import Break from '../models/Break.js';
import User from '../model/User.js';
import ProjectTask from '../model/ProjectTask.js';
import HRTask from '../model/hrTaskModel.js';

await mongoose.connect(process.env.MONGO_URI);

const user = await User.findOne({ employeeId: 'IDE002' }).lean();
console.log('User:', user?.name, user?._id);

const todayStart = new Date(); todayStart.setHours(0,0,0,0);
const todayEnd   = new Date(); todayEnd.setHours(23,59,59,999);

// Today's breaks
const breaks = await Break.find({
  userId: user._id,
  startTime: { $gte: todayStart, $lte: todayEnd }
}).lean();
console.log('\nAll breaks today:');
breaks.forEach(b => console.log(
  `  start: ${b.startTime?.toISOString()}, end: ${b.endTime?.toISOString() || 'OPEN'}, dur: ${b.durationInSeconds}s`
));

// Closed breaks only
const closed = breaks.filter(b => b.endTime);
const totalSecs = closed.reduce((s, b) => s + (b.durationInSeconds || 0), 0);
console.log(`Closed breaks total: ${totalSecs}s = ${Math.round(totalSecs/60)}m`);

// Task sessions today
const [projTasks, hrTasks] = await Promise.all([
  ProjectTask.find({ 'timers.userId': user._id.toString() }).lean(),
  HRTask.find({ 'timers.userId': user._id.toString() }).lean(),
]);
let taskSec = 0;
for (const task of [...projTasks, ...hrTasks]) {
  const entry = task.timers?.find(t => t.userId?.toString() === user._id.toString());
  if (!entry) continue;
  for (const s of (entry.sessions || [])) {
    if (new Date(s.startTime) >= todayStart) {
      taskSec += s.duration || 0;
      console.log(`\n  Task session: ${s.startTime} dur=${s.duration}s`);
    }
  }
  if (entry.timerStartedAt) {
    console.log(`\n  RUNNING timer started: ${entry.timerStartedAt}`);
  }
}
console.log(`\nTask seconds today (sessions only): ${taskSec}s = ${Math.round(taskSec/60)}m`);

await mongoose.disconnect();