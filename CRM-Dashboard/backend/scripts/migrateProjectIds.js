import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const db = mongoose.connection.db;
const col = db.collection("projects");

const projects = await col.find({}).toArray();
console.log(`Found ${projects.length} projects`);

let updated = 0;
let skipped = 0;

for (const p of projects) {
  const old = p.projectId;

  // Already in new format (has hyphen)
  if (old && old.startsWith("PRJ-")) {
    console.log(`  ⏭  ${old} — already in new format`);
    skipped++;
    continue;
  }

  // Convert old format PRJ001 → PRJ-001
  if (old && old.startsWith("PRJ")) {
    const num = parseInt(old.replace("PRJ", ""), 10);
    if (isNaN(num)) {
      console.log(`  ⚠️  ${old} — cannot parse number, skipping`);
      skipped++;
      continue;
    }
    const newId = `PRJ-${num.toString().padStart(3, "0")}`;
    await col.updateOne({ _id: p._id }, { $set: { projectId: newId } });
    console.log(`  ✅  ${old} → ${newId}`);
    updated++;
  } else {
    console.log(`  ⚠️  ${old} — unknown format, skipping`);
    skipped++;
  }
}

console.log(`\nDone. Updated: ${updated} | Skipped: ${skipped}`);
await mongoose.disconnect();