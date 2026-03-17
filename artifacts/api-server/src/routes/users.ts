import { Router, Response } from "express";
import { User } from "../models/User.js";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.use(authMiddleware as any);

// Get profil sendiri
router.get("/me", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil profil" });
  }
});

// Update profil
router.put("/me", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, avatar } = req.body;
    const updates: any = {};
    if (name) updates.name = name;
    if (avatar !== undefined) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select(
      "-passwordHash -otp -otpExpiry"
    );
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Gagal update profil" });
  }
});

// Cari user berdasarkan NexID
router.get("/search/:nexId", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const nexId = String(req.params.nexId);
    const user = await User.findOne({ nexId: nexId.toUpperCase() }).select(
      "nexId name avatar isOnline lastSeen"
    );
    if (!user) {
      res.status(404).json({ error: "User tidak ditemukan" });
      return;
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Gagal mencari user" });
  }
});

// Get user by ID
router.get("/:userId", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select(
      "nexId name avatar isOnline lastSeen"
    );
    if (!user) {
      res.status(404).json({ error: "User tidak ditemukan" });
      return;
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil user" });
  }
});

export default router;
