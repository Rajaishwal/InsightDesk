import express from "express";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Message from "../models/Message.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/multer.js";

const router = express.Router();

// POST /api/messages/upload — upload a file to Cloudinary and return its URL
router.post("/upload", protect, upload.single("file"), async (req, res) => {
  const localPath = req.file?.path;
  try {
    if (!localPath) return res.status(400).json({ message: "No file provided" });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"];
    const isImage = imageExts.includes(ext);

    // Use "raw" for non-image files so Cloudinary serves them as direct downloads
    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: isImage ? "image" : "raw",
    });
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

    const fileType = isImage ? "image" : ext === ".pdf" ? "pdf" : "file";
    res.json({
      fileUrl: result.secure_url,
      fileName: req.file.originalname,
      fileType,
    });
  } catch (err) {
    if (localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// GET /api/messages/unread/count  — total unread for current user
router.get("/unread/count", protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiverId: req.user._id,
      read: false,
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
});

// GET /api/messages/conversations — recent conversation list
router.get("/conversations", protect, async (req, res) => {
  try {
    const me = req.user._id;

    const conversations = await Message.aggregate([
      { $match: { $or: [{ senderId: me }, { receiverId: me }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$senderId", me] },
              then: "$receiverId",
              else: "$senderId",
            },
          },
          lastMessage: { $first: "$$ROOT" },
          unread: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiverId", me] }, { $eq: ["$read", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          name: "$user.name",
          email: "$user.email",
          employeeId: "$user.employeeId",
          designation: "$user.designation",
          photo: "$user.photo",
          lastMessage: "$lastMessage.text",
          lastFileName: "$lastMessage.fileName",
          lastFileType: "$lastMessage.fileType",
          lastMessageTime: "$lastMessage.createdAt",
          lastSenderId: "$lastMessage.senderId",
          unread: 1,
        },
      },
      { $sort: { lastMessageTime: -1 } },
    ]);

    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

// GET /api/messages/:targetId — conversation with one user
router.get("/:targetId", protect, async (req, res) => {
  try {
    const me = req.user._id;
    const { targetId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: me, receiverId: targetId },
        { senderId: targetId, receiverId: me },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(100);

    // Mark received messages as read
    await Message.updateMany(
      { senderId: targetId, receiverId: me, read: false },
      { read: true }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// PUT /api/messages/:messageId — edit own message text
router.put("/:messageId", protect, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    if (msg.senderId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Forbidden" });
    msg.text = req.body.text || "";
    msg.edited = true;
    await msg.save();
    res.json(msg);
  } catch (err) {
    res.status(500).json({ message: "Edit failed" });
  }
});

// DELETE /api/messages/:messageId — delete own message
router.delete("/:messageId", protect, async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    if (msg.senderId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Forbidden" });
    await msg.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

export default router;