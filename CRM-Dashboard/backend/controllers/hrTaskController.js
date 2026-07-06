import HRTask from "../model/hrTaskModel.js";
import User from "../model/User.js";

// 👉 HR assigns a task to employee route: POST /api/hr-tasks/
export const assignTask = async (req, res) => {
  try {
    console.log('🎯 HR Task Assignment Request:', {
      user: req.user ? { id: req.user._id, name: req.user.name, role: req.user.role } : 'No user',
      body: req.body
    });

    const { title, description, taskCompletionTime, assignedTo } = req.body;

    // 1️⃣ Find the employee by employeeId
    const employee = await User.findOne({ employeeId: assignedTo });
    if (!employee) {
      console.log('❌ Employee not found:', assignedTo);
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    console.log('✅ Employee found:', { employeeId: employee.employeeId, name: employee.name });

    // 2️⃣ Prepare task data
    const task = new HRTask({
      title,
      description,
      taskCompletionTime,
      assignedTo: employee.employeeId, // store employee code
      assignedToName: employee.name,
      assignedToEmail: employee.email,
      assignedBy: req.user._id,
      assignedByName: req.user.name,
      assignedByEmail: req.user.email,
    });

    // 3️⃣ Save task
    await task.save();
    console.log('✅ Task saved successfully:', task._id);

    res.status(201).json({ success: true, message: "Task assigned successfully", task });
  } catch (error) {
    console.error('❌ HR Task Assignment Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Get all HR assigned tasks
export const getAllHRTasks = async (req, res) => {
  try {
    const tasks = await HRTask.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Get tasks assigned by HR (tasks HR created)
export const getTasksAssignedByHR = async (req, res) => {
  try {
    const tasks = await HRTask.find({ assignedBy: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyAssignedTasks = async (req, res) => {
  try {
    // Use employeeId instead of Mongo _id
    const tasks = await HRTask.find({ assignedTo: req.user.employeeId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Update task (HR or Employee can update status)
export const updateHRTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    const updated = await HRTask.findByIdAndUpdate(taskId, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Task not found" });

    res.status(200).json({ success: true, message: "Task updated", updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 Delete task
export const deleteHRTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    await HRTask.findByIdAndDelete(taskId);
    res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 👉 PUT /api/hr-tasks/:id/time
export const updateTaskTime = async (req, res) => {
  try {
    const { timeTaken } = req.body;
    const taskId = req.params.id;

    if (!timeTaken) {
      return res.status(400).json({ success: false, message: "timeTaken is required" });
    }

    // Check task exists
    const task = await HRTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    // Check authorization
    if (task.assignedToEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: "Not authorized to update this task" });
    }

    // 🚫 Prevent updating time more than once
    if (task.taskCompletionTime) {
      return res.status(400).json({
        success: false,
        message: "Time already recorded for this task. Cannot update again.",
      });
    }

    // ✅ Save time only once
    task.taskCompletionTime = timeTaken;
    task.status = "Completed";
    task.stopped = true; // optional: add in schema for frontend disabling
    task.completedAt = new Date();

    await task.save();

    res.status(200).json({
      success: true,
      message: "Time saved successfully",
      task,
    });
  } catch (error) {
    console.error("❌ Error in updateTaskTime:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
