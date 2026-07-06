import mongoose from "mongoose";
import User from "../model/User.js";

async function addEmp001() {
  await mongoose.connect("mongodb://localhost:27017/crmteam"); // Change DB name if needed
  const exists = await User.findOne({ employeeId: "EMP001" });
  if (exists) {
    console.log("EMP001 already exists");
    process.exit(0);
  }
  const user = new User({
    name: "Raj",
    email: "rajaiswal@gmail.com",
    password: "test1234", // Will be hashed
    role: "employee",
    employeeId: "EMP001",
    designation: "Developer",
    domain: "IT",
    profileCompleted: true
  });
  await user.save();
  console.log("EMP001 added successfully");
  process.exit(0);
}

addEmp001();
