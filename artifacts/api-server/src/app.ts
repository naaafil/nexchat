import express, { type Express } from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { User } from "./models/User.js";
import { Message } from "./models/Message.js";
import { Chat } from "./models/Chat.js";
import { sendPushToUser } from "./routes/push.js";
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/api/socket.io",
});

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", router);

// Serve frontend
const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));
app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Socket.IO Auth Middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Token diperlukan"));
    const secret = process.env.JWT_SECRET || "nexchat_secret";
    const decoded = jwt.verify(token, secret) as { userId: string };
    (socket as any).userId = decoded.userId;
    next();
  } catch {
    next(new Error("Token tidak valid"));
  }
});

// Track online users: userId -> socketId
const onlineUsers = new Map<string, string>();

io.on("connection", async (socket) => {
  const userId = (socket as any).userId as string;
  console.log(`User connected: ${userId}`);

  onlineUsers.set(userId, socket.id);

  await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
  io.emit("user:status", { userId, isOnline: true });

  // Join semua room chat user
  const chats = await Chat.find({ participants: userId });
  for (const chat of chats) {
    socket.join(chat.chatId);
  }

  // ── Kirim pesan ──
  socket.on("message:send", async (data) => {
    try {
      const { chatId, content, type = "text", fileUrl, fileName, fileSize, duration, replyTo, forwardedFrom } = data;

      const chat = await Chat.findOne({ chatId, participants: userId });
      if (!chat) return;

      const message = new Message({
        chatId,
        sender: userId,
        content: content || "",
        type,
        fileUrl,
        fileName,
        fileSize,
        duration,
        readBy: [userId],
        replyTo: replyTo || undefined,
        forwardedFrom: forwardedFrom || undefined,
      });
      await message.save();
      await message.populate("sender", "nexId name avatar");

      await Chat.findOneAndUpdate(
        { chatId },
        { lastMessage: message._id, lastMessageAt: new Date() }
      );

      io.to(chatId).emit("message:new", { message, chatId });

      // Push notification ke peserta yang offline
      const sender = await User.findById(userId).select("name");
      for (const participantId of chat.participants) {
        const pid = String(participantId);
        if (pid !== userId && !onlineUsers.has(pid)) {
          sendPushToUser(pid, {
            title: `NexChat - ${sender?.name || "Pesan baru"}`,
            body: message.isDeleted ? "Pesan dihapus" :
              type === "text" ? (content || "") :
              type === "voice" ? "🎤 Voice message" :
              type === "image" ? "📷 Gambar" : "📎 File",
            chatId,
            icon: "/icon.png",
          });
        }
      }
    } catch (error) {
      console.error("Message send error:", error);
      socket.emit("error", { message: "Gagal mengirim pesan" });
    }
  });

  // Typing indicator
  socket.on("typing:start", ({ chatId }) => {
    socket.to(chatId).emit("typing:start", { userId, chatId });
  });
  socket.on("typing:stop", ({ chatId }) => {
    socket.to(chatId).emit("typing:stop", { userId, chatId });
  });

  // Join room chat baru
  socket.on("chat:join", ({ chatId }) => {
    socket.join(chatId);
  });

  // Mark messages as read
  socket.on("messages:read", async ({ chatId }) => {
    try {
      await Message.updateMany(
        { chatId, readBy: { $ne: userId } },
        { $push: { readBy: userId } }
      );
      io.to(chatId).emit("messages:read", { chatId, userId });
    } catch (error) {
      console.error("Read error:", error);
    }
  });

  // Hapus pesan
  socket.on("message:delete", ({ chatId, messageId }) => {
    io.to(chatId).emit("message:deleted", { chatId, messageId });
  });

  // Pin pesan (broadcast ke room)
  socket.on("message:pin", ({ chatId, pinned }) => {
    io.to(chatId).emit("message:pinned", { chatId, pinned });
  });

  // Story baru
  socket.on("story:new", ({ story }) => {
    io.emit("story:new", { story });
  });

  // ── WebRTC Signaling ──
  socket.on("call:offer", ({ targetUserId, offer, callType }) => {
    const targetSocket = onlineUsers.get(targetUserId);
    if (targetSocket) {
      io.to(targetSocket).emit("call:incoming", { callerId: userId, offer, callType });
    } else {
      socket.emit("call:unavailable", { targetUserId });
    }
  });

  socket.on("call:answer", ({ callerId, answer }) => {
    const callerSocket = onlineUsers.get(callerId);
    if (callerSocket) io.to(callerSocket).emit("call:answered", { answer });
  });

  socket.on("call:ice-candidate", ({ targetUserId, candidate }) => {
    const targetSocket = onlineUsers.get(targetUserId);
    if (targetSocket) io.to(targetSocket).emit("call:ice-candidate", { candidate, fromUserId: userId });
  });

  socket.on("call:reject", ({ callerId }) => {
    const callerSocket = onlineUsers.get(callerId);
    if (callerSocket) io.to(callerSocket).emit("call:rejected", { by: userId });
  });

  socket.on("call:end", ({ targetUserId }) => {
    const targetSocket = onlineUsers.get(targetUserId);
    if (targetSocket) io.to(targetSocket).emit("call:ended", { by: userId });
  });

  // Disconnect
  socket.on("disconnect", async () => {
    onlineUsers.delete(userId);
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
    io.emit("user:status", { userId, isOnline: false, lastSeen: new Date() });
    console.log(`User disconnected: ${userId}`);
  });
});

export { httpServer as default, io };
