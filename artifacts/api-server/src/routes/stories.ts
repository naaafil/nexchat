import { Router, Response } from "express";
import { Story } from "../models/Story.js";
import { Chat } from "../models/Chat.js";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();
router.use(authMiddleware as any);

// Get semua story dari kontak user (24 jam terakhir)
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Ambil semua user yang punya chat dengan saya
    const chats = await Chat.find({ participants: new mongoose.Types.ObjectId(req.userId!) });
    const contactIds = new Set<string>();
    contactIds.add(req.userId!);
    for (const chat of chats) {
      for (const p of chat.participants) {
        contactIds.add(String(p));
      }
    }

    const stories = await Story.find({
      userId: { $in: Array.from(contactIds) },
      expiresAt: { $gt: new Date() },
    })
      .populate("userId", "nexId name avatar")
      .sort({ createdAt: -1 });

    // Group by user
    const grouped: Record<string, any> = {};
    for (const story of stories) {
      const uid = String((story.userId as any)._id || story.userId);
      if (!grouped[uid]) {
        grouped[uid] = { user: story.userId, stories: [] };
      }
      grouped[uid].stories.push({
        _id: story._id,
        type: story.type,
        content: story.content,
        mediaUrl: story.mediaUrl,
        bgColor: story.bgColor,
        viewCount: story.views.length,
        viewed: story.views.map(String).includes(req.userId!),
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
      });
    }

    res.json({ stories: Object.values(grouped) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil story" });
  }
});

// Buat story baru
router.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, content, mediaUrl, bgColor } = req.body;
    if (!type) { res.status(400).json({ error: "type diperlukan" }); return; }
    if (type === "text" && !content) { res.status(400).json({ error: "content diperlukan untuk story teks" }); return; }
    if (type === "image" && !mediaUrl) { res.status(400).json({ error: "mediaUrl diperlukan untuk story gambar" }); return; }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const story = new Story({
      userId: req.userId,
      type,
      content,
      mediaUrl,
      bgColor: bgColor || "#6c63ff",
      expiresAt,
    });
    await story.save();
    await story.populate("userId", "nexId name avatar");

    res.json({ story });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal membuat story" });
  }
});

// Tandai story sebagai dilihat
router.post("/:storyId/view", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { storyId } = req.params;
    await Story.findByIdAndUpdate(
      storyId,
      { $addToSet: { views: req.userId } },
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Gagal mencatat tampilan" });
  }
});

// Hapus story milik sendiri
router.delete("/:storyId", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const story = await Story.findOne({ _id: req.params.storyId, userId: req.userId });
    if (!story) { res.status(404).json({ error: "Story tidak ditemukan" }); return; }
    await story.deleteOne();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Gagal menghapus story" });
  }
});

export default router;
