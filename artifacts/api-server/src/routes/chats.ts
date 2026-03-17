import { Router, Response } from "express";
import mongoose from "mongoose";
import { Chat } from "../models/Chat.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";
import { generateChatId, generateGroupId } from "../lib/helpers.js";

const router = Router();
router.use(authMiddleware as any);

// Ambil semua chat milik user
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const chats = await Chat.find({
      participants: new mongoose.Types.ObjectId(req.userId!),
    })
      .populate("participants", "nexId name avatar isOnline lastSeen")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });

    res.json({ chats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil daftar chat" });
  }
});

// Mulai chat 1-on-1
router.post("/direct", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      res.status(400).json({ error: "targetUserId diperlukan" });
      return;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ error: "User tidak ditemukan" });
      return;
    }

    const chatId = generateChatId(req.userId!, targetUserId);
    let chat = await Chat.findOne({ chatId });

    if (!chat) {
      chat = new Chat({
        chatId,
        type: "direct",
        participants: [req.userId, targetUserId],
      });
      await chat.save();
    }

    await chat.populate("participants", "nexId name avatar isOnline lastSeen");
    res.json({ chat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal membuat chat" });
  }
});

// Buat grup chat
router.post("/group", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { groupName, participantIds } = req.body;
    if (!groupName || !participantIds || !Array.isArray(participantIds)) {
      res.status(400).json({ error: "groupName dan participantIds diperlukan" });
      return;
    }

    const allParticipants = [req.userId!, ...participantIds].filter(
      (v, i, arr) => arr.indexOf(v) === i
    );
    const chatId = generateGroupId();

    const chat = new Chat({
      chatId,
      type: "group",
      groupName,
      participants: allParticipants,
      groupAdmin: req.userId,
    });
    await chat.save();
    await chat.populate("participants", "nexId name avatar isOnline lastSeen");

    res.json({ chat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal membuat grup" });
  }
});

// Get pesan dalam chat
router.get("/:chatId/messages", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 50;

    const chat = await Chat.findOne({
      chatId,
      participants: new mongoose.Types.ObjectId(req.userId!),
    });
    if (!chat) {
      res.status(404).json({ error: "Chat tidak ditemukan" });
      return;
    }

    const messages = await Message.find({ chatId })
      .populate("sender", "nexId name avatar")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil pesan" });
  }
});

// Hapus pesan
router.delete("/:chatId/messages/:messageId", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { chatId, messageId } = req.params;

    const chat = await Chat.findOne({
      chatId,
      participants: new mongoose.Types.ObjectId(req.userId!),
    });
    if (!chat) {
      res.status(404).json({ error: "Chat tidak ditemukan" });
      return;
    }

    const message = await Message.findOne({ _id: messageId, chatId });
    if (!message) {
      res.status(404).json({ error: "Pesan tidak ditemukan" });
      return;
    }

    // Hanya pengirim yang bisa hapus pesannya sendiri
    if (String(message.sender) !== req.userId) {
      res.status(403).json({ error: "Kamu hanya bisa menghapus pesanmu sendiri" });
      return;
    }

    message.isDeleted = true;
    message.content = "";
    message.fileUrl = undefined;
    await message.save();

    res.json({ success: true, messageId });
  } catch (error) {
    res.status(500).json({ error: "Gagal menghapus pesan" });
  }
});

// Tambah anggota ke grup
router.post("/:chatId/members", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    const chat = await Chat.findOne({ chatId, type: "group", groupAdmin: req.userId });
    if (!chat) {
      res.status(403).json({ error: "Hanya admin yang bisa menambah anggota" });
      return;
    }

    if (!chat.participants.map(String).includes(userId)) {
      chat.participants.push(new mongoose.Types.ObjectId(userId));
      await chat.save();
    }

    res.json({ success: true, chat });
  } catch (error) {
    res.status(500).json({ error: "Gagal menambah anggota" });
  }
});

export default router;
