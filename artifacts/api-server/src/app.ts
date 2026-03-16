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
import jwt from "jsonwebtoken";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
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

  // Update status online
  await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
  io.emit("user:status", { userId, isOnline: true });

  // Join semua room chat user
  const chats = await Chat.find({ participants: userId });
  for (const chat of chats) {
    socket.join(chat.chatId);
  }

  // Kirim pesan
  socket.on("message:send", async (data) => {
    try {
      const { chatId, content, type = "text", fileUrl, fileName, fileSize } = data;

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
        readBy: [userId],
      });
      await message.save();
      await message.populate("sender", "nexId name avatar");

      // Update lastMessage di chat
      await Chat.findOneAndUpdate(
        { chatId },
        { lastMessage: message._id, lastMessageAt: new Date() }
      );

      // Broadcast ke semua di room
      io.to(chatId).emit("message:new", { message, chatId });
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

  // Disconnect
  socket.on("disconnect", async () => {
    onlineUsers.delete(userId);
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
    io.emit("user:status", { userId, isOnline: false, lastSeen: new Date() });
    console.log(`User disconnected: ${userId}`);
  });
});

export { httpServer as default, io };
