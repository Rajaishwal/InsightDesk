import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import "./config/cloudinary.js";
import userRoutes from "./routes/userRoutes.js";
import userEmployeeIdRoutes from "./routes/userEmployeeIdRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import timerRoutes from "./routes/timerRoutes.js";
import breakRoutes from "./routes/breakRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import cors from "cors";
import hrProjectRoutes from "./routes/hrProjectRoutes.js";
import hrTaskRoutes from "./routes/hrTaskRoute.js";
import salaryRoutes from "./routes/salaryRoutes.js";
import payslipRoutes from "./routes/payslipRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import employeeRoutes from "./routes/employeeRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import projectTaskRoutes from "./routes/projectTaskRoutes.js";

dotenv.config();
connectDB();

const app = express();

const allowedOrigins = [
  "https://crm-dashboard-1-ldaf.netlify.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// REST routes
app.use("/api/users", userRoutes);
app.use("/api/user", userEmployeeIdRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/hr-tasks", hrTaskRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/timer", timerRoutes);
app.use("/api/breaks", breakRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/salary", salaryRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/hr-projects", hrProjectRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/project-tasks", projectTaskRoutes);

// Socket.io
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// userId -> socketId map
const onlineUsers = new Map();

io.on("connection", (socket) => {
  const userId = socket.handshake.auth?.userId;

  if (userId) {
    onlineUsers.set(userId, socket.id);
    socket.join(userId);
    io.emit("online_users", Array.from(onlineUsers.keys()));
  }

  socket.on("send_message", async ({ senderId, receiverId, text, fileUrl, fileName, fileType, replyTo }) => {
    try {
      const Message = (await import("./models/Message.js")).default;
      const msg = await Message.create({
        senderId,
        receiverId,
        text: text || "",
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        replyTo: replyTo || undefined,
      });

      // Send to receiver's room
      io.to(receiverId).emit("receive_message", msg);
      // Confirm back to sender
      socket.emit("receive_message", msg);
    } catch (err) {
      console.error("Socket send_message error:", err.message);
    }
  });

  socket.on("mark_read", async ({ senderId, receiverId }) => {
    try {
      const Message = (await import("./models/Message.js")).default;
      await Message.updateMany(
        { senderId, receiverId, read: false },
        { read: true }
      );
    } catch (err) {
      console.error("Socket mark_read error:", err.message);
    }
  });

  socket.on("edit_message", async ({ messageId, text, receiverId }) => {
    try {
      const Message = (await import("./models/Message.js")).default;
      const existing = await Message.findById(messageId);
      if (!existing) return;

      const ageMs = Date.now() - new Date(existing.createdAt).getTime();
      if (ageMs > 60 * 60 * 1000) {
        socket.emit("edit_error", { messageId, reason: "Messages can only be edited within 60 minutes of sending." });
        return;
      }

      const msg = await Message.findByIdAndUpdate(
        messageId,
        { text: text || "", edited: true },
        { new: true }
      );
      io.to(receiverId).emit("message_edited", msg);
      socket.emit("message_edited", msg);
    } catch (err) {
      console.error("Socket edit_message error:", err.message);
    }
  });

  socket.on("delete_message", async ({ messageId, receiverId }) => {
    try {
      const Message = (await import("./models/Message.js")).default;
      await Message.findByIdAndDelete(messageId);
      io.to(receiverId).emit("message_deleted", { messageId });
      socket.emit("message_deleted", { messageId });
    } catch (err) {
      console.error("Socket delete_message error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    if (userId) {
      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));