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
      console.log('🔑 Token from Authorization header found');
    }
    // If no token in header, check for token in cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('🔑 Token from cookies found');
    }
    
    if (!token) {
      console.log('❌ No token provided in request');
      return res.status(401).json({ message: "No token provided" });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded successfully:', { userId: decoded.id });
    
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      console.log('❌ User not found for token');
      return res.status(401).json({ message: "User not found" });
    }
    
    console.log('✅ User authenticated:', { id: user._id, name: user.name, role: user.role });
    req.user = user;
    next();
  } catch (err) {
    console.error("❌ Auth middleware error:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

// Admin only middleware
export const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin only.' });
  }
};

// HR or Admin middleware
export const hrOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'hr' || req.user.role === 'employee')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. HR or Admin only.' });
  }
};
