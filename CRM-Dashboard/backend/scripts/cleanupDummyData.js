import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

await mongoose.connect(process.env.MONGO_URI);
console.log('✅ MongoDB connected\n');

const db = mongoose.connection.db;
const projectCol = db.collection('projects');
const taskCol    = db.collection('projecttasks');
const userCol    = db.collection('users');

// ── 1. Delete dummy seed projects PRJ001–PRJ015 ──
const dummyIds = Array.from({ length: 15 }, (_, i) =>
  `PRJ${String(i + 1).padStart(3, '0')}`
);
const projResult = await projectCol.deleteMany({ projectId: { $in: dummyIds } });
console.log(`🗑️  Deleted ${projResult.deletedCount} dummy projects (PRJ001–PRJ015)`);

// ── 2. Delete Saurav's (EMP004) tasks ──
const saurav = await userCol.findOne({ employeeId: 'EMP004' });
if (!saurav) {
  console.log('⚠️  EMP004 not found — skipping task cleanup');
} else {
  const taskResult = await taskCol.deleteMany({ createdBy: saurav._id });
  console.log(`🗑️  Deleted ${taskResult.deletedCount} task(s) created by ${saurav.name} (EMP004)`);
}

// ── Summary ──
const remainingProjects = await projectCol.countDocuments();
const remainingTasks    = await taskCol.countDocuments();
console.log(`\n📊 Remaining in DB:`);
console.log(`   Projects    : ${remainingProjects}`);
console.log(`   Tracklist tasks : ${remainingTasks}`);

await mongoose.disconnect();
process.exit(0);