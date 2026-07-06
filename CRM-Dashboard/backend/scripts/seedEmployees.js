import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

// Use the raw collection to bypass pre-save hooks and timestamps auto-overwrite
const db = mongoose.connection.db;
const col = db.collection("users");

const DESIGNATIONS = [
  "Software Developer Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "UI/UX Designer",
  "QA Engineer",
  "DevOps Engineer",
  "Dot Net Developer",
  "React Developer",
  "Node.js Developer",
  "Data Analyst",
  "HR Manager",
  "HR Executive",
  "Marketing Executive",
  "Finance Analyst",
  "Project Manager",
  "Business Analyst",
  "Cloud Engineer",
  "Mobile Developer",
  "Scrum Master",
];

const DOMAINS = ["IT", "HR", "Finance", "Marketing", "Operations", "Design", "QA"];

const SHIFTS = [
  "07:00 AM - 02:00 PM",
  "09:00 AM - 06:00 PM",
  "10:00 AM - 07:00 PM",
  "02:00 PM - 10:00 PM",
];

const CITIES = [
  { city: "Mumbai",    state: "Maharashtra"  },
  { city: "Delhi",     state: "Delhi"        },
  { city: "Bangalore", state: "Karnataka"    },
  { city: "Hyderabad", state: "Telangana"    },
  { city: "Chennai",   state: "Tamil Nadu"   },
  { city: "Pune",      state: "Maharashtra"  },
  { city: "Kolkata",   state: "West Bengal"  },
  { city: "Ahmedabad", state: "Gujarat"      },
  { city: "Jaipur",    state: "Rajasthan"    },
  { city: "Lucknow",   state: "Uttar Pradesh"},
];

const EMPLOYEES = [
  { name: "Aarav Sharma",      gender: "male"   },
  { name: "Priya Patel",       gender: "female" },
  { name: "Rohit Verma",       gender: "male"   },
  { name: "Anjali Singh",      gender: "female" },
  { name: "Karan Mehta",       gender: "male"   },
  { name: "Neha Gupta",        gender: "female" },
  { name: "Vikram Yadav",      gender: "male"   },
  { name: "Pooja Joshi",       gender: "female" },
  { name: "Amit Kumar",        gender: "male"   },
  { name: "Divya Nair",        gender: "female" },
  { name: "Saurav Pandey",     gender: "male"   },
  { name: "Sneha Reddy",       gender: "female" },
  { name: "Rahul Tiwari",      gender: "male"   },
  { name: "Kavya Pillai",      gender: "female" },
  { name: "Nikhil Bose",       gender: "male"   },
  { name: "Meera Iyer",        gender: "female" },
  { name: "Arjun Malhotra",    gender: "male"   },
  { name: "Shreya Agarwal",    gender: "female" },
  { name: "Varun Saxena",      gender: "male"   },
  { name: "Ritu Chauhan",      gender: "female" },
  { name: "Sumit Dubey",       gender: "male"   },
  { name: "Pallavi Mishra",    gender: "female" },
  { name: "Gaurav Srivastava", gender: "male"   },
  { name: "Swati Bansal",      gender: "female" },
  { name: "Tarun Kapoor",      gender: "male"   },
  { name: "Kritika Ghosh",     gender: "female" },
  { name: "Deepak Pandya",     gender: "male"   },
  { name: "Ananya Kulkarni",   gender: "female" },
  { name: "Manish Rajput",     gender: "male"   },
  { name: "Sakshi Thakur",     gender: "female" },
  { name: "Vivek Shukla",      gender: "male"   },
  { name: "Riya Choudhary",    gender: "female" },
  { name: "Abhishek Bajaj",    gender: "male"   },
  { name: "Simran Kaur",       gender: "female" },
  { name: "Lokesh Rana",       gender: "male"   },
  { name: "Tanvi Patil",       gender: "female" },
  { name: "Shivam Dubey",      gender: "male"   },
  { name: "Nidhi Arora",       gender: "female" },
  { name: "Harsh Bhatt",       gender: "male"   },
  { name: "Tanya Kohli",       gender: "female" },
  { name: "Mohit Garg",        gender: "male"   },
  { name: "Ishita Venkat",     gender: "female" },
  { name: "Rajesh Soni",       gender: "male"   },
  { name: "Bhavana Menon",     gender: "female" },
  { name: "Ajay Pandey",       gender: "male"   },
  { name: "Shivangi Rastogi",  gender: "female" },
  { name: "Vinay Trivedi",     gender: "male"   },
  { name: "Ankita Desai",      gender: "female" },
  { name: "Suresh Nayak",      gender: "male"   },
  { name: "Preeti Jain",       gender: "female" },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Spread join dates across the last 7 months so the bar chart has data
// ~7 employees per month bucket
function randomDateInPast7Months(index) {
  const now = new Date();
  const monthsBack = Math.floor(index / 7); // 0 → current month, 6 → 6 months ago
  const d = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.floor(Math.random() * daysInMonth) + 1);
  d.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

// Hash password once — raw insert bypasses the pre-save hook so no double-hash
const hashedPassword = await bcrypt.hash("Password@123", 12);

let inserted = 0;
let skipped  = 0;

for (let i = 0; i < EMPLOYEES.length; i++) {
  const { name, gender } = EMPLOYEES[i];
  const empNum     = String(i + 51).padStart(3, "0");   // EMP051 – EMP100
  const employeeId = `EMP${empNum}`;
  const emailSlug  = name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z.]/g, "");
  const email      = `${emailSlug}${empNum}@company.com`;
  const location   = pick(CITIES);
  const createdAt  = randomDateInPast7Months(i);

  // Check for duplicates before inserting
  const exists = await col.findOne({ $or: [{ email }, { employeeId }] });
  if (exists) {
    console.warn(`⚠️  [${i + 1}/50] Skipped ${name} — already exists`);
    skipped++;
    continue;
  }

  const doc = {
    _id:              new mongoose.Types.ObjectId(),
    name,
    email,
    password:         hashedPassword,
    role:             "employee",
    employeeId,
    gender,
    designation:      pick(DESIGNATIONS),
    domain:           pick(DOMAINS),
    shiftTiming:      pick(SHIFTS),
    profileCompleted: true,
    address: {
      city:    location.city,
      state:   location.state,
      country: "India",
    },
    createdAt,
    updatedAt: createdAt,
    __v: 0,
  };

  await col.insertOne(doc);
  console.log(`✅ [${i + 1}/50] ${name} (${employeeId}) — joined ${createdAt.toDateString()}`);
  inserted++;
}

console.log(`\n🎉 Done — ${inserted} inserted, ${skipped} skipped`);
await mongoose.disconnect();
process.exit(0);