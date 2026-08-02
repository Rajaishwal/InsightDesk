import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

await mongoose.connect(process.env.MONGO_URI);
console.log("✅ MongoDB connected");

const col = mongoose.connection.db.collection("breaks");

const activeBreaks = await col.find({ endTime: null }).sort({ startTime: -1 }).toArray();
console.log(`Found ${activeBreaks.length} active (unclosed) breaks`);

// Group by userId
const byUser = {};
for (const b of activeBreaks) {
  const uid = b.userId.toString();
  if (!byUser[uid]) byUser[uid] = [];
  byUser[uid].push(b);
}

let closed = 0;
for (const [uid, breaks] of Object.entries(byUser)) {
  if (breaks.length <= 1) continue;
  // Keep first (latest startTime), close the rest
  const toClose = breaks.slice(1);
  for (const b of toClose) {
    await col.updateOne({ _id: b._id }, { $set: { endTime: b.startTime } });
    console.log(`  ✅ Closed stale break ${b._id} for user ${uid}`);
    closed++;
  }
}

console.log(`\nDone. Closed ${closed} stale duplicate break(s).`);
await mongoose.disconnect();