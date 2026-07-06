import express from "express";
import { startBreak, stopBreak, getBreakLogs, getBreakStatus } from "../controllers/breakController.js";

const router = express.Router();

router.post("/start", startBreak);
router.post("/stop", stopBreak);
router.get("/logs/:userId", getBreakLogs);
router.get("/status/:userId", getBreakStatus);

export default router;
