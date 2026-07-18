import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

await mongoose.connect(process.env.MONGO_URI);
console.log('✅ MongoDB connected');

const db = mongoose.connection.db;
const projectCol = db.collection('projects');
const userCol    = db.collection('users');
const taskCol    = db.collection('projecttasks');

// ── Look up real users ──────────────────────────────────────────
const [emp001, emp004, manager] = await Promise.all([
  userCol.findOne({ employeeId: 'EMP001' }),
  userCol.findOne({ employeeId: 'EMP004' }),
  userCol.findOne({ role: { $in: ['admin', 'hr'] } }),
]);

if (!emp001)  { console.error('❌ EMP001 not found — run seedEmployees.js first'); process.exit(1); }
if (!emp004)  { console.error('❌ EMP004 not found — run seedEmployees.js first'); process.exit(1); }
if (!manager) { console.error('❌ No admin/hr user found in DB');                   process.exit(1); }

console.log(`👤 EMP001  : ${emp001.name}  (${emp001.email})`);
console.log(`👤 EMP004  : ${emp004.name}  (${emp004.email})`);
console.log(`👤 Manager : ${manager.name} (${manager.email}, role: ${manager.role})`);

// ── Clean up any previous run ───────────────────────────────────
const PROJECT_ID = 'SIGNUP';
await Promise.all([
  projectCol.deleteOne({ projectId: PROJECT_ID }),
  taskCol.deleteMany({ projectId: PROJECT_ID }),
]);
console.log(`\n🗑️  Cleared any previous SIGNUP project + tasks`);

// ── Create project ──────────────────────────────────────────────
const projectDoc = {
  _id: new mongoose.Types.ObjectId(),
  projectId: PROJECT_ID,
  title: 'SignUp Module',
  manager: manager.name,
  email: manager.email,
  skills: ['React', 'Node.js', 'JWT', 'MongoDB'],
  tools: ['Figma', 'Postman', 'GitHub'],
  status: 'Ongoing',
  description: 'Build and test the complete user signup and authentication flow.',
  teamMembers: [
    { _id: new mongoose.Types.ObjectId(), empId: emp001.employeeId, empEmail: emp001.email },
    { _id: new mongoose.Types.ObjectId(), empId: emp004.employeeId, empEmail: emp004.email },
  ],
  statusFlag: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

await projectCol.insertOne(projectDoc);
console.log(`✅ Project created: ${PROJECT_ID} — "${projectDoc.title}"`);
console.log(`   Team: ${emp001.name} (EMP001), ${emp004.name} (EMP004)`);

// ── Create 4 tasks ──────────────────────────────────────────────
const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;

const tasks = [
  // ── EMP001 — Task 1 (Completed) ──
  {
    _id: new mongoose.Types.ObjectId(),
    projectId: PROJECT_ID,
    title: 'Set up user registration form',
    description: 'Build the signup form with name, email, and password fields including client-side validation.',
    status: 'Completed',
    isRevision: false,
    createdBy: emp001._id,
    createdByName: emp001.name,
    createdByRole: emp001.role || 'employee',
    completedAt: new Date(now - 2 * DAY),
    createdAt:  new Date(now - 6 * DAY),
    updatedAt:  new Date(now - 2 * DAY),
  },

  // ── EMP001 — Task 2 (Ongoing) ──
  {
    _id: new mongoose.Types.ObjectId(),
    projectId: PROJECT_ID,
    title: 'Implement email verification flow',
    description: 'Send OTP on signup and verify before activating the account.',
    status: 'Ongoing',
    isRevision: false,
    createdBy: emp001._id,
    createdByName: emp001.name,
    createdByRole: emp001.role || 'employee',
    createdAt: new Date(now - 4 * DAY),
    updatedAt: new Date(now - 1 * DAY),
  },

  // ── EMP004 — Task 3 (Pending) ──
  {
    _id: new mongoose.Types.ObjectId(),
    projectId: PROJECT_ID,
    title: 'Backend signup API endpoint',
    description: 'POST /api/auth/signup — hash password, validate unique email, return JWT on success.',
    status: 'Pending',
    isRevision: false,
    createdBy: emp004._id,
    createdByName: emp004.name,
    createdByRole: emp004.role || 'employee',
    createdAt: new Date(now - 2 * DAY),
    updatedAt: new Date(now - 2 * DAY),
  },

  // ── Manager — Task 4 (Revision, red dot) ──
  {
    _id: new mongoose.Types.ObjectId(),
    projectId: PROJECT_ID,
    title: 'Password strength meter — needs rework',
    description: 'Current meter does not flag common passwords. Revise logic to use proper scoring (e.g. zxcvbn) before merging.',
    status: 'Pending',
    isRevision: true,
    createdBy: manager._id,
    createdByName: manager.name,
    createdByRole: manager.role,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  },
];

await taskCol.insertMany(tasks);
console.log(`\n✅ Created ${tasks.length} tasks for project SIGNUP:`);
console.log(`   1. [Completed] "Set up user registration form"       — by ${emp001.name} (EMP001)`);
console.log(`   2. [Ongoing  ] "Implement email verification flow"   — by ${emp001.name} (EMP001)`);
console.log(`   3. [Pending  ] "Backend signup API endpoint"         — by ${emp004.name} (EMP004)`);
console.log(`   4. [Pending  ] "Password strength meter — rework"    — by ${manager.name} [REVISION 🔴]`);

console.log(`\n🎉 Done! Open the Projects page and click "Tasks" on SIGNUP to see the tracklist.`);

await mongoose.disconnect();
process.exit(0);