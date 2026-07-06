import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./model/User.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const existing = await User.findOne({ email: "admin@crm.com" });
    if (existing) {
      console.log("⚠️  Admin user already exists. Skipping.");
      process.exit(0);
    }

    await User.create({
      employeeId: "ADMIN001",
      name: "Admin",
      email: "admin@crm.com",
      password: "ADMIN001@2025",
      role: "admin",
    });

    console.log("🎉 Admin user created!");
    console.log("   Email:    admin@crm.com");
    console.log("   Password: ADMIN001@2025");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err.message);
    process.exit(1);
  }
};

seedAdmin();