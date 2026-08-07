/**
 * resetPassword.js — one-shot CLI to reset any user's password
 * Usage:  node backend/scripts/resetPassword.js <email> <newPassword>
 * Example: node backend/scripts/resetPassword.js spider@gmail.com IDE004@2025
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const [,, email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Usage: node backend/scripts/resetPassword.js <email> <newPassword>');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const hashed = await bcrypt.hash(newPassword, 12);
const result = await mongoose.connection.collection('users').updateOne(
  { email },
  { $set: { password: hashed } }
);

if (result.matchedCount === 0) {
  console.error(`❌ No user found with email: ${email}`);
} else {
  console.log(`✅ Password reset for ${email}`);
  console.log(`   New password: ${newPassword}`);
}

await mongoose.disconnect();