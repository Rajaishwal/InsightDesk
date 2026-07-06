import Timer from "../models/Timer.js";

// Start (Check-In)
export const startTimer = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Check if already checked in today
    const existing = await Timer.findOne({
      userId,
      checkIn: { $gte: today },
    });

    if (existing) {
      return res.status(400).json({ error: "Already checked in today." });
    }

    // Allow check-in
    const newTimer = await Timer.create({
      userId,
      checkIn: new Date(),
      checkOut: null,
    });

    res.status(201).json({ message: "Check-in successful", data: newTimer });
  } catch (error) {
    res.status(500).json({ error: "Internal server error during check-in" });
  }
};

// Stop (Check-Out)
export const stopTimer = async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    // Find today's check-in without check-out
    const timer = await Timer.findOne({
      userId,
      checkIn: { $gte: today },
      checkOut: null,
    });

    if (!timer) {
      return res.status(400).json({ error: "No active check-in found for today." });
    }

    timer.checkOut = new Date();
    await timer.save();

    res.status(200).json({ message: "Check-out successful", data: timer });
  } catch (error) {
    res.status(500).json({ error: "Internal server error during check-out" });
  }
};

// Get logs for a user
export const getLogs = async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  try {
    const logs = await Timer.find({ userId }).sort({ checkIn: -1 });
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch logs" });
  }
};