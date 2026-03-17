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
  transports: ["websocket", "polling"],
});

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/api", router);

// Serve frontend & static
const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));
app.get("/", (_req, res) => { res.sendFile(path.join(publicDir, "index.html")); });

// Socket.IO Auth
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Token diperlukan"));
    const secret = process.env.JWT_SECRET || "nexchat_secret";
    const decoded = jwt.verify(token, secret) as { userId: string };
    (socket as any).userId = decoded.userId;
    next();
  } catch { next(new Error("Token tidak valid")); }
});

// userId -> socketId
const onlineUsers = new Map<string, string>();

io.on("connection", async (socket) => {
  const userId = (socket as any).userId as string;
  onlineUsers.set(userId, socket.id);

  await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
  io.emit("user:status", { userId, isOnline: true });

  // Join semua room chat user
  const userChats = await Chat.find({ participants: userId });
  for (const chat of userChats) socket.join(chat.chatId);

  // Mark pending messages as delivered for this user upon reconnect
  try {
    const pendingMsgs = await Message.find({
      chatId: { $in: userChats.map(c => c.chatId) },
      sender: { $ne: userId },
      deliveredTo: { $ne: userId },
    }).select("_id chatId");

    for (const msg of pendingMsgs) {
      await Message.findByIdAndUpdate(msg._id, { $addToSet: { deliveredTo: userId } });
      io.to(msg.chatId).emit("message:delivered", { messageId: String(msg._id), chatId: msg.chatId, userId });
    }
  } catch {}

  // ── Kirim pesan ──
  socket.on("message:send", async (data) => {
    try {
      const { chatId, content, type = "text", fileUrl, fileName, fileSize, duration, replyTo, forwardedFrom } = data;
      const chat = await Chat.findOne({ chatId, participants: userId });
      if (!chat) return;

      // Find online recipients for immediate delivery tracking
      const onlineRecipients: string[] = [];
      for (const pid of chat.participants) {
        const pidStr = String(pid);
        if (pidStr !== userId && onlineUsers.has(pidStr)) {
          onlineRecipients.push(pidStr);
        }
      }

      const message = new Message({
        chatId, sender: userId,
        content: content || "", type,
        fileUrl, fileName, fileSize, duration,
        readBy: [userId],
        deliveredTo: [userId, ...onlineRecipients],
        replyTo: replyTo || undefined,
        forwardedFrom: forwardedFrom || undefined,
      });
      await message.save();
      await message.populate("sender", "nexId name avatar");

      await Chat.findOneAndUpdate({ chatId }, { lastMessage: message._id, lastMessageAt: new Date() });

      io.to(chatId).emit("message:new", { message, chatId });

      // Emit delivery confirmation for online recipients
      for (const rid of onlineRecipients) {
        io.to(chatId).emit("message:delivered", {
          messageId: String(message._id), chatId, userId: rid
        });
      }

      // Push for offline recipients
      const sender = await User.findById(userId).select("name");
      for (const participantId of chat.participants) {
        const pid = String(participantId);
        if (pid !== userId && !onlineUsers.has(pid)) {
          sendPushToUser(pid, {
            title: `${sender?.name || "NexChat"}`,
            body: type === "text" ? (content || "Pesan baru") :
              type === "voice" ? "🎤 Pesan suara" :
              type === "image" ? "📷 Foto" : "📎 File",
            chatId, icon: "/favicon.ico",
          });
        }
      }
    } catch (error) {
      console.error("message:send error:", error);
      socket.emit("error", { message: "Gagal mengirim pesan" });
    }
  });

  // Typing
  socket.on("typing:start", ({ chatId }) => socket.to(chatId).emit("typing:start", { userId, chatId }));
  socket.on("typing:stop", ({ chatId }) => socket.to(chatId).emit("typing:stop", { userId, chatId }));

  // Join room
  socket.on("chat:join", ({ chatId }) => socket.join(chatId));

  // Messages read
  socket.on("messages:read", async ({ chatId }) => {
    try {
      const unread = await Message.find({ chatId, sender: { $ne: userId }, readBy: { $ne: userId } }).select("_id");
      if (unread.length === 0) return;
      const ids = unread.map(m => m._id);
      await Message.updateMany({ _id: { $in: ids } }, { $addToSet: { readBy: userId } });
      io.to(chatId).emit("messages:read", { chatId, userId, messageIds: ids.map(String) });
    } catch (e) { console.error("messages:read error:", e); }
  });

  // Delete
  socket.on("message:delete", ({ chatId, messageId }) => io.to(chatId).emit("message:deleted", { chatId, messageId }));

  // Pin
  socket.on("message:pin", ({ chatId, pinned }) => io.to(chatId).emit("message:pinned", { chatId, pinned }));

  // Story
  socket.on("story:new", () => io.emit("story:new", {}));

  // ── WebRTC Signaling ──
  socket.on("call:offer", ({ targetUserId, offer, callType }) => {
    const tgt = onlineUsers.get(targetUserId);
    if (tgt) {
      io.to(tgt).emit("call:incoming", { callerId: userId, offer, callType });
    } else {
      socket.emit("call:unavailable", { targetUserId });
    }
  });

  socket.on("call:answer", ({ callerId, answer }) => {
    const tgt = onlineUsers.get(callerId);
    if (tgt) io.to(tgt).emit("call:answered", { answer });
  });

  socket.on("call:ice-candidate", ({ targetUserId, candidate }) => {
    const tgt = onlineUsers.get(targetUserId);
    if (tgt) io.to(tgt).emit("call:ice-candidate", { candidate, fromUserId: userId });
  });

  socket.on("call:reject", ({ callerId }) => {
    const tgt = onlineUsers.get(callerId);
    if (tgt) io.to(tgt).emit("call:rejected", { by: userId });
  });

  socket.on("call:end", ({ targetUserId }) => {
    const tgt = onlineUsers.get(targetUserId);
    if (tgt) io.to(tgt).emit("call:ended", { by: userId });
  });

  // Disconnect
  socket.on("disconnect", async () => {
    onlineUsers.delete(userId);
    const lastSeen = new Date();
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
    io.emit("user:status", { userId, isOnline: false, lastSeen });
  });
});

export { httpServer as default, io };
