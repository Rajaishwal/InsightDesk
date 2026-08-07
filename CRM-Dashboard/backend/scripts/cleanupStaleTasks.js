// cleanupStaleTasks.js
// One-time script: stop any task timers that are still running from a previous day.
// Run: node backend/scripts/cleanupStaleTasks.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ProjectTask from '../model/ProjectTask.js';
import HRTask from '../model/hrTaskModel.js';

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log('Connected to MongoDB');

const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);
const now = new Date();

let fixed = 0;

for (const Model of [ProjectTask, HRTask]) {
  const tasks = await Model.find({
    timers: { $elemMatch: { timerStartedAt: { $ne: null } } },
  });

  for (const task of tasks) {
    for (const entry of task.timers) {
      if (!entry.timerStartedAt) continue;

      const startedAt = new Date(entry.timerStartedAt);
      // Only fix timers that started before today
      if (startedAt >= startOfToday) continue;

      // Count elapsed seconds from startedAt up to now, but only today's portion
      const effectiveStart = startedAt < startOfToday ? startOfToday : startedAt;
      const elapsed  = Math.floor((now - effectiveStart) / 1000);
      const newTotal = (entry.totalTimeLogged || 0) + elapsed;

      await Model.updateOne(
        { _id: task._id, 'timers.userId': entry.userId },
        {
          $set:  { 'timers.$.timerStartedAt': null, 'timers.$.totalTimeLogged': newTotal },
          $push: { 'timers.$.sessions': { startTime: effectiveStart, endTime: now, duration: elapsed } },
        }
      );

      console.log(`  Fixed: ${Model.modelName} "${task.title}" — user ${entry.userId}`);
      fixed++;
    }
  }
}

console.log(`\nDone — ${fixed} stale timer(s) stopped.`);
await mongoose.disconnect();