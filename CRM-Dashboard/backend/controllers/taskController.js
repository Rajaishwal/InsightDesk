import Task from "../model/taskModel.js";
import mongoose from "mongoose";

// 👉 Create a new task
export const createTask = async (req, res) => {
  try {
    const { title, description, taskCompletionTime } = req.body;

    const task = new Task({
      title,
      description,
      taskCompletionTime,
      createdBy: req.user.id,
      createdByName: req.user.name,
      createdByEmail: req.user.email,
    });

    await task.save();
    res.status(201).json({ success: true, message: "Task created successfully", task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Get all tasks
export const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find().populate("createdBy", "name email");
    console.log("📊 Total tasks in database:", tasks.length);
    console.log("📊 All tasks:", tasks.map(t => ({
      id: t._id,
      title: t.title,
      createdBy: t.createdBy?._id || t.createdBy,
      createdByName: t.createdByName
    })));
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Update task
export const updateTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const updated = await Task.findByIdAndUpdate(taskId, req.body, {
      new: true,
    });
    res.status(200).json({ success: true, message: "Task updated", updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Delete task
export const deleteTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    await Task.findByIdAndDelete(taskId);
    res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Get tasks by user
export const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user.id });
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Get tasks by user ID (for HR to view employee tasks)
export const getTasksByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log("🔍 Raw userId from params:", userId);
    console.log("🔍 UserId type:", typeof userId);
    
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
    
    // Find tasks created by this user
    const tasks = await Task.find({ createdBy: objectId })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    
    console.log("📋 Found tasks:", tasks.length);
    console.log("📋 Tasks data:", tasks.map(t => ({ 
      id: t._id, 
      title: t.title, 
      createdBy: t.createdBy,
      createdByName: t.createdByName
    })));
    
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    console.error("❌ Error in getTasksByUserId:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

