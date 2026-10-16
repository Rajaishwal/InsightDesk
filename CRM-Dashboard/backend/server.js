import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import connectDB from "./config/db.js";
import User from "./model/User.js";
import Message from "./models/Message.js";
import "./config/cloudinary.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import breakRoutes from "./routes/breakRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import cors from "cors";
import hrTaskRoutes from "./routes/hrTaskRoute.js";
import salaryRoutes from "./routes/salaryRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import projectTaskRoutes from "./routes/projectTaskRoutes.js";
import projectActivityRoutes from "./routes/projectActivityRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { setIo } from "./socket.js";

dotenv.config();
connectDB();

const app = express();

// The local dev sites, plus the deployed frontend(s) from CLIENT_URL (comma-separated, e.g. "https://insightdesk.netlify.app")
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  ...(process.env.CLIENT_URL || "").split(",").map((u) => u.trim().replace(/\/+$/, "")).filter(Boolean),
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
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/hr-tasks", hrTaskRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/breaks", breakRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/salary", salaryRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/project-tasks", projectTaskRoutes);
app.use("/api/project-activity", projectActivityRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/reports", reportRoutes);

// Socket.io
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Share io instance with controllers so they can emit real-time events
setIo(io);

// A socket must carry a valid login token (sent by the app, or the login cookie). Who the user is comes from that token,
// never from ids the client sends — otherwise anyone could read or send another person's messages.
io.use(async (socket, next) => {
  try {
    const cookieToken = /(?:^|;\s*)token=([^;]+)/.exec(socket.handshake.headers.cookie || "")?.[1];
    const token = socket.handshake.auth?.token || (cookieToken && decodeURIComponent(cookieToken));
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id).select("_id").lean();
    if (!user) return next(new Error("Not authorised"));
    socket.data.userId = String(user._id);
    next();
  } catch {
    next(new Error("Not authorised"));
  }
});

// userId -> socketId map
const onlineUsers = new Map();

io.on("connection", (socket) => {
  const userId = socket.data.userId;

  onlineUsers.set(userId, socket.id);
  socket.join(userId);
  io.emit("online_users", Array.from(onlineUsers.keys()));

  socket.on("send_message", async ({ receiverId, text, fileUrl, fileName, fileType, replyTo }) => {
    try {
      const senderId = userId;
      const msg = await Message.create({
        senderId,
        receiverId,
        text: text || "",
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        replyTo: replyTo || undefined,
      });

      // Attach sender info so the receiver can show a rich notification
      const sender = await User.findById(senderId).select("name photo employeeId").lean();
      const enriched = { ...msg.toObject(), senderName: sender?.name || "Someone", senderPhoto: sender?.photo || null, senderEmpId: sender?.employeeId || null };

      // Send to receiver's room
      io.to(receiverId).emit("receive_message", enriched);
      // Confirm back to sender
      socket.emit("receive_message", enriched);
    } catch (err) {
      console.error("Socket send_message error:", err.message);
    }
  });

  // Only your own inbox: messages from senderId to you
  socket.on("mark_read", async ({ senderId }) => {
    try {
      await Message.updateMany(
        { senderId, receiverId: userId, read: false },
        { read: true }
      );
    } catch (err) {
      console.error("Socket mark_read error:", err.message);
    }
  });

  socket.on("edit_message", async ({ messageId, text }) => {
    try {
      const existing = await Message.findById(messageId);
      if (!existing) return;
      if (String(existing.senderId) !== userId) {
        socket.emit("edit_error", { messageId, reason: "You can only edit your own messages." });
        return;
      }
      const receiverId = String(existing.receiverId);

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

  socket.on("delete_message", async ({ messageId }) => {
    try {
      const existing = await Message.findById(messageId);
      if (!existing || String(existing.senderId) !== userId) return; // only the sender can delete
      await existing.deleteOne();
      io.to(String(existing.receiverId)).emit("message_deleted", { messageId });
      socket.emit("message_deleted", { messageId });
    } catch (err) {
      console.error("Socket delete_message error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));