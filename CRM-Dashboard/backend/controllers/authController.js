// backend/controllers/authController.js
import jwt from "jsonwebtoken";
import User from "../model/User.js";

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "30d" });

export const registerUser = async (req, res) => {
  try {
    const { employeeId, name, email, role } = req.body;
    if (!employeeId || !name || !email || !role) {
      return res.status(400).json({ message: "Employee ID, name, email, and role are required" });
    }

    // Check if email already exists
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(409).json({ message: "Email already in use" });
    }

    // Check if employee ID already exists
    const employeeIdExists = await User.findOne({ employeeId });
    if (employeeIdExists) {
      return res.status(409).json({ message: "Employee ID already in use" });
    }

    // Generate a default password (employee can change it later)
    const defaultPassword = `${employeeId}@2025`;
    
    // ✅ Fix: use requested role, fallback to employee if invalid
    const validRoles = ["admin", "employee"];
    const finalRole = validRoles.includes(role) ? role : "employee";


    const user = await User.create({ 
      employeeId,
      name, 
      email, 
      password: defaultPassword, 
      role: finalRole
    });

    const safe = { 
      _id: user._id, 
      employeeId: user.employeeId,
      name: user.name, 
      email: user.email, 
      role: user.role 
    };

    return res.status(201).json({ 
      token: signToken(user._id), 
      ...safe,
      message: `Employee registered successfully. Default password: ${defaultPassword}. Please change it after first login.`
    });
  } catch (err) {
    console.error("Register error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email only
    const user = await User.findOne({ email: email });
    
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    
    const token = signToken(user._id);
    const safe = { 
      _id: user._id, 
      employeeId: user.employeeId,
      name: user.name, 
      email: user.email, 
      role: user.role 
    };
    
    // Set JWT token as HTTP-only cookie
    const cookieOptions = {
      expires: new Date(Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 30) * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    };
    
    res.cookie('token', token, cookieOptions);
    
    return res.status(200).json({ token, ...safe });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// Logout user - clear cookie
export const logoutUser = (req, res) => {
  res.cookie('token', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ message: "Logged out successfully" });
};

// Change user password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.matchPassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Check if new password is different from current password
    const isSamePassword = await user.matchPassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Update password
    user.password = newPassword;
    await user.save();
    
    return res.status(200).json({ 
      message: "Password changed successfully" 
    });

  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Server error while changing password" });
  }
};
