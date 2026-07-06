import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const db = mongoose.connection.db;
const userCol       = db.collection("users");
const attendanceCol = db.collection("attendances");
const leaveCol      = db.collection("leaves");

// Today's date string YYYY-MM-DD
const now = new Date();
const todayStr = now.toISOString().split("T")[0];
const todayStart = new Date(todayStr + "T00:00:00.000Z");

// ── Fetch the 50 seeded employees (EMP051–EMP100) ──
// Build explicit list EMP051–EMP100
const seedIds = Array.from({ length: 50 }, (_, i) =>
  `EMP${String(i + 51).padStart(3, "0")}`
);

const employees = await userCol
  .find({ role: "employee", employeeId: { $in: seedIds } })
  .sort({ employeeId: 1 })
  .toArray();

console.log(`Found ${employees.length} seeded employees`);

if (employees.length < 50) {
  console.warn("⚠️  Less than 50 seeded employees found — run seedEmployees.js first");
}

// Delete any existing today's attendance/leave for these employees (clean re-run)
const empIds = employees.map(e => e._id);
await attendanceCol.deleteMany({ userId: { $in: empIds }, date: todayStr });
await leaveCol.deleteMany({
  userId: { $in: empIds },
  status: "Approved",
  startDate: { $lte: new Date(todayStr + "T23:59:59Z") },
  endDate:   { $gte: todayStart },
});
console.log("🗑️  Cleared existing today's records for these employees");

// ── Slice employees ──
const presentEmployees = employees.slice(0, 40);   // first 40 → present
const leaveEmployees   = employees.slice(40, 49);  // next 9  → on leave
// employees[49] → absent (no record)

// ── Helper: random check-in time ──
function randomCheckIn(isLate = false) {
  const h = isLate
    ? 9 + Math.floor(Math.random() * 2) + 1   // 10–11 AM (late)
    : 8 + Math.floor(Math.random() * 2);       // 8–9 AM (on time)
  const m = Math.floor(Math.random() * 60);
  const d = new Date(todayStr);
  d.setUTCHours(h - 5, m - 30, 0, 0);         // convert IST to UTC (IST = UTC+5:30)
  return d;
}

// ── Insert Attendance records (40 present) ──
let lateCount = 0;
const attendanceDocs = presentEmployees.map((emp, i) => {
  const isLate = i >= 35; // last 5 of the 40 are late
  if (isLate) lateCount++;
  const checkInTime = randomCheckIn(isLate);

  return {
    _id:         new mongoose.Types.ObjectId(),
    userId:      emp._id,
    userName:    emp.name,
    userEmail:   emp.email,
    date:        todayStr,
    checkInTime,
    checkOutTime: null,
    workingHours: 0,
    status:      "checked-in",
    location:    "Office",
    createdAt:   checkInTime,
    updatedAt:   checkInTime,
  };
});

await attendanceCol.insertMany(attendanceDocs);
console.log(`✅ Inserted ${attendanceDocs.length} attendance records (${lateCount} late, ${40 - lateCount} on time)`);

// ── Insert Leave records (9 on leave) ──
const LEAVE_TYPES = [
  "Sick Leave", "Casual Leave", "Annual Leave",
  "Emergency Leave", "Other",
];

const today = new Date(todayStr);

const leaveDocs = leaveEmployees.map((emp, i) => {
  const leaveType = LEAVE_TYPES[i % LEAVE_TYPES.length];
  return {
    _id:          new mongoose.Types.ObjectId(),
    userId:       emp._id,
    userName:     emp.name,
    userEmail:    emp.email,
    leaveType,
    startDate:    today,
    endDate:      today,
    reason:       "Personal reasons",
    status:       "Approved",
    totalDays:    1,
    appliedAt:    new Date(),
    updatedAt:    new Date(),
    createdAt:    new Date(),
    __v: 0,
  };
});

await leaveCol.insertMany(leaveDocs);
console.log(`✅ Inserted ${leaveDocs.length} approved leave records`);

// ── Summary ──
const absentEmp = employees[49];
console.log(`\n📊 Today's summary for ${todayStr}:`);
console.log(`   ✅ Present : 40  (${lateCount} late, ${40 - lateCount} on time)`);
console.log(`   🏖️  On Leave: 9`);
console.log(`   ❌ Absent  : ${employees.length - 49}  (${absentEmp?.name || "—"})`);

await mongoose.disconnect();
process.exit(0);