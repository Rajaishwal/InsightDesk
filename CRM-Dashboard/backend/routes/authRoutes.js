// backend/routes/authRoutes.js
import express from "express";
import { registerUser, loginUser, logoutUser, changePassword } from "../controllers/authController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only an admin can create accounts (the Register Employee page) — there's no public sign-up
router.post("/register", protect, admin, registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.put("/change-password", protect, changePassword);
router.get("/me", protect, (req, res) => res.status(200).json(req.user));

export default router;
