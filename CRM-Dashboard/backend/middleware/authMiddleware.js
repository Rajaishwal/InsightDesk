// backend/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../model/User.js";

export const protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in Authorization header first
    const authHeader = req.headers.authorization || "";
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    // If no token in header, check for token in cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Admin only middleware
export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

// HR or Admin middleware (employees are NOT let through — these routes edit / delete users and projects)
export const hrOrAdmin = (req, res, next) => {
  const role = String(req.user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'hr') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. HR or Admin only.' });
  }
};

// Only the user named in the URL (req.params[param]) — or an admin — may continue
export const selfOrAdmin = (param = 'id') => (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || String(req.user._id) === String(req.params[param]))) {
    next();
  } else {
    res.status(403).json({ message: "You can only do this for your own account." });
  }
};

// Acting on yourself: whatever userId the request sends, use the logged-in user's own id
export const asSelf = (req, res, next) => {
  req.body = { ...(req.body || {}), userId: String(req.user._id) };
  next();
};
