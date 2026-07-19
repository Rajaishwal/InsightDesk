// controllers/userController.js
import User from "../model/User.js";
import bcrypt from "bcryptjs";

// GET /api/users (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (e) {
    res.status(500).json({ message: "Error getting users" });
  }
};

// GET /api/users/search (Admin only) - Search by employeeId or name
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    const searchConditions = {
      $or: [
        { name: { $regex: query, $options: "i" } },
        { employeeId: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { designation: { $regex: query, $options: "i" } },
        { domain: { $regex: query, $options: "i" } },
        { role: { $regex: query, $options: "i" } }
      ]
    };

    const users = await User.find(searchConditions).select("-password");
    res.status(200).json(users);
  } catch (e) {
    res.status(500).json({ message: "Error searching users" });
  }
};

// GET /api/users/:id
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch {
    res.status(500).json({ message: "Error getting user" });
  }
};

// PUT /api/users/:id  (hash if password provided)
export const updateUser = async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const update = { name, email, role };

    if (password) {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(password, salt);
    }

    const updated = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json(updated);
  } catch (e) {
    res.status(500).json({ message: "Error updating user" });
  }
};

// PUT /api/users/:id/profile - Update employee profile
export const updateUserProfile = async (req, res) => {
  try {
    console.log("Profile update request received for user:", req.params.id);
    console.log("Request body:", req.body);
    
    const {
      name, email, employeeId, gender, photo, shiftTiming, address,
      designation, domain,
      phone, dateOfBirth, bloodGroup,
      emergencyContact,
      bio, skills, experience,
    } = req.body;

    const update = {
      name, email, employeeId, gender, photo, shiftTiming, address,
      designation, domain,
      phone, dateOfBirth, bloodGroup,
      emergencyContact,
      bio, skills, experience,
      profileCompleted: true,
    };

    console.log("Update data:", update);

    const updated = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updated) {
      console.log("User not found:", req.params.id);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Profile updated successfully:", updated);
    res.status(200).json(updated);
  } catch (e) {
    console.error("Profile update error:", e);
    if (e.code === 11000 && e.keyPattern.employeeId) {
      return res.status(400).json({ message: "Employee ID already exists" });
    }
    res.status(500).json({ message: "Error updating profile", error: e.message });
  }
};

// DELETE /api/users/:id
export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "User deleted" });
  } catch {
    res.status(500).json({ message: "Error deleting user" });
  }
};
