import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text:       { type: String, default: "", trim: true },
    fileUrl:    { type: String, default: null },
    fileName:   { type: String, default: null },
    fileType:   { type: String, default: null }, // 'image' | 'pdf' | 'file'
    read:       { type: Boolean, default: false },
    edited:     { type: Boolean, default: false },
    replyTo: {
      messageId:  { type: mongoose.Schema.Types.ObjectId, default: null },
      senderId:   { type: mongoose.Schema.Types.ObjectId, default: null },
      senderName: { type: String, default: "" },
      text:       { type: String, default: "" },
      fileName:   { type: String, default: null },
      fileType:   { type: String, default: null },
    },
  },
  { timestamps: true }
);

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
// Auto-delete messages after 48 hours
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

export default mongoose.model("Message", messageSchema);