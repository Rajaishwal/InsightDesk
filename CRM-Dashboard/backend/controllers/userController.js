// controllers/userController.js
import User from "../model/User.js";

// GET /api/users (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (e) {
    res.status(500).json({ message: "Error getting users" });
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

// PUT /api/users/:id/profile - Update employee profile
export const updateUserProfile = async (req, res) => {
  try {
    
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

    const updated = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updated);
  } catch (e) {
    console.error("Profile update error:", e);
    if (e.code === 11000 && e.keyPattern.employeeId) {
      return res.status(400).json({ message: "Employee ID already exists" });
    }
    res.status(500).json({ message: "Error updating profile", error: e.message });
  }
};

