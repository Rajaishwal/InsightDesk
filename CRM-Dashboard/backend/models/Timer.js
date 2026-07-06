import mongoose from "mongoose";

const timerSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
    default: null,
  },
});

const Timer = mongoose.model("Timer", timerSchema);

export default Timer;
