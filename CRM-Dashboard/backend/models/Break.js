import mongoose from "mongoose";

const breakSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  durationInSeconds: { type: Number },
});

export default mongoose.model("Break", breakSchema);
