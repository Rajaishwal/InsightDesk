import express from "express";
import {
  startTimer,
  stopTimer,
  getLogs,
} from "../controllers/timerController.js";

const router = express.Router();

router.post("/start", startTimer);
router.post("/stop", stopTimer);
router.get("/logs/:userId", getLogs);

export default router;
