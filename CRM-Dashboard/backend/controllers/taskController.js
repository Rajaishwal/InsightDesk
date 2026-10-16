import Task from "../model/taskModel.js";
import mongoose from "mongoose";

// 👉 Get tasks by user ID (for HR to view employee tasks)
export const getTasksByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId
    if (!userId || userId === 'undefined' || userId === '[object Object]' || userId.includes('[object')) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid user ID provided" 
      });
    }

    // Check if it's a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid ObjectId format" 
      });
    }
    
    // Convert to ObjectId for proper comparison
    const objectId = new mongoose.Types.ObjectId(userId);
    
    const tasks = await Task.find({ createdBy: objectId })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, tasks });
  } catch (error) {
    console.error("❌ Error in getTasksByUserId:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

