import Break from "../models/Break.js";
import mongoose from "mongoose";

// Use a valid ObjectId string from your User collection or just a random valid ObjectId for testing
const DUMMY_USER_ID = "64d3e4b7f2a4c2a1b1234567"; // 24 hex chars

// startBreak
export const startBreak = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }
    const newBreak = new Break({ userId, startTime: new Date() });
    await newBreak.save();
    res.status(201).json(newBreak);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// stopBreak
export const stopBreak = async (req, res) => {
  try {
    const { breakId, userId } = req.body;
    let breakData = null;

    if (breakId) {
      if (!mongoose.isValidObjectId(breakId)) {
        return res.status(400).json({ message: "Invalid breakId" });
      }
      breakData = await Break.findById(breakId);
    } else if (userId) {
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: "Invalid userId" });
      }
      breakData = await Break.findOne({ userId, endTime: { $exists: false } })
        .sort({ startTime: -1 });
    }

    if (!breakData) {
      return res.status(404).json({ message: "Active break not found" });
    }

    if (breakData.endTime) {
      return res.status(409).json({ message: "Break already stopped" });
    }

    const startMs = breakData.startTime ? new Date(breakData.startTime).getTime() : null;
    if (!startMs || Number.isNaN(startMs)) {
      return res.status(409).json({ message: "Invalid break data: missing startTime" });
    }

    const endMs = Date.now();
    const durationSeconds = Math.max(0, Math.round((endMs - startMs) / 1000));

    breakData.endTime = new Date(endMs);
    breakData.durationInSeconds = durationSeconds;
    await breakData.save();
    res.json(breakData);
  } catch (error) {
    console.error("Error in stopBreak:", error);
    if (error?.name === "CastError") {
      return res.status(400).json({ message: "Invalid identifier" });
    }
    res.status(500).json({ message: error.message });
  }
};

export const getBreakStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.json({ isOnBreak: false, elapsedSeconds: 0 });
    }
    const active = await Break.findOne({ userId, endTime: { $exists: false } })
      .sort({ startTime: -1 });

    if (!active) return res.json({ isOnBreak: false, elapsedSeconds: 0 });

    const elapsedSeconds = Math.floor((Date.now() - active.startTime.getTime()) / 1000);
    res.json({ isOnBreak: true, elapsedSeconds, breakId: active._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// getBreakLogs
export const getBreakLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const logs = await Break.find({ userId }).sort({ startTime: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};