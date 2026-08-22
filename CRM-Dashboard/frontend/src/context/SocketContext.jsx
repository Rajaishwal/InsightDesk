import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import api from "../services/axios";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);

  const [onlineUsers, setOnlineUsers] = useState([]);
  // messages keyed by the other user's _id string
  const [messages, setMessages] = useState({});
  // total unread badge count
  const [unreadCount, setUnreadCount] = useState(0);
  // per-sender unread counts  { senderId: number }
  const [unreadFrom, setUnreadFrom] = useState({});
  // incoming message notifications for the popup
  const [chatNotifs, setChatNotifs] = useState([]);

  useEffect(() => {
    if (!user?._id) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setOnlineUsers([]);
      return;
    }

    // Load persisted unread count on mount
    api.get("/messages/unread/count")
      .then((r) => setUnreadCount(r.data.count || 0))
      .catch(() => {});

    const socket = io("http://localhost:5000", {
      auth: { userId: user._id },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("online_users", (ids) => setOnlineUsers(ids));

    // Server-pushed data-change events → dispatch as window CustomEvents
    // so useAutoRefresh listeners on any page pick them up automatically
    socket.on("attendance:updated", () =>
      window.dispatchEvent(new CustomEvent("crm:attendance:updated"))
    );
    socket.on("task:updated", () =>
      window.dispatchEvent(new CustomEvent("crm:task:updated"))
    );
    socket.on("leave:updated", () =>
      window.dispatchEvent(new CustomEvent("crm:leave:updated"))
    );

    socket.on("receive_message", (msg) => {
      const otherId =
        msg.senderId === user._id ? msg.receiverId : msg.senderId;

      setMessages((prev) => ({
        ...prev,
        [otherId]: [...(prev[otherId] || []), msg],
      }));

      // Increment unread only for messages sent to me by someone else
      if (msg.senderId !== user._id) {
        setUnreadCount((c) => c + 1);
        setUnreadFrom((prev) => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] || 0) + 1,
        }));
        // Push notification popup
        const notifId = `${msg._id || Date.now()}`;
        setChatNotifs((prev) => [...prev, {
          id:          notifId,
          senderId:    msg.senderId,
          senderName:  msg.senderName  || "Someone",
          senderPhoto: msg.senderPhoto || null,
          senderEmpId: msg.senderEmpId || null,
          text:        msg.text        || (msg.fileName ? `📎 ${msg.fileName}` : "Sent an attachment"),
          fileType:    msg.fileType    || null,
          at:          new Date(),
        }]);
        // Auto-dismiss after 5s
        setTimeout(() => setChatNotifs((prev) => prev.filter((n) => n.id !== notifId)), 5000);
      }
    });

    socket.on("message_edited", (updatedMsg) => {
      const otherId =
        updatedMsg.senderId === user._id ? updatedMsg.receiverId : updatedMsg.senderId;
      setMessages((prev) => ({
        ...prev,
        [otherId]: (prev[otherId] || []).map((m) =>
          m._id === updatedMsg._id ? updatedMsg : m
        ),
      }));
    });

    socket.on("message_deleted", ({ messageId }) => {
      setMessages((prev) => {
        const next = {};
        for (const [key, msgs] of Object.entries(prev)) {
          next[key] = msgs.filter((m) => m._id !== messageId);
        }
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const sendMessage = (receiverId, text, fileData = null, replyTo = null) => {
    socketRef.current?.emit("send_message", {
      senderId: user._id,
      receiverId,
      text: text || "",
      ...(fileData || {}),
      ...(replyTo ? { replyTo } : {}),
    });
  };

  // Called when a conversation is opened — clears that sender's unread count
  const markRead = (senderId) => {
    if (!socketRef.current || !user?._id) return;
    socketRef.current.emit("mark_read", {
      senderId,
      receiverId: user._id,
    });
    const cleared = unreadFrom[senderId] || 0;
    setUnreadCount((c) => Math.max(0, c - cleared));
    setUnreadFrom((prev) => ({ ...prev, [senderId]: 0 }));
  };

  const editMessage = (messageId, receiverId, text) => {
    socketRef.current?.emit("edit_message", { messageId, text, receiverId });
  };

  const deleteMessage = (messageId, receiverId) => {
    socketRef.current?.emit("delete_message", { messageId, receiverId });
  };

  // Seed messages from REST API history into the local cache
  const loadHistory = (userId, msgs) => {
    setMessages((prev) => ({ ...prev, [userId]: msgs }));
  };

  const isOnline = (userId) => onlineUsers.includes(userId?.toString());

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        onlineUsers,
        messages,
        unreadCount,
        unreadFrom,
        chatNotifs,
        dismissChatNotif: (id) => setChatNotifs((p) => p.filter((n) => n.id !== id)),
        sendMessage,
        editMessage,
        deleteMessage,
        markRead,
        loadHistory,
        isOnline,
        setUnreadCount,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);