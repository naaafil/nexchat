import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { generateUniqueNexId, generateOTP } from "../lib/helpers.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "nexchat_secret";

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

// Kirim OTP
router.post("/send-otp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, email, name } = req.body;

    if (!phone && !email) {
      res.status(400).json({ error: "Nomor HP atau email diperlukan" });
      return;
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

    let user = await User.findOne(phone ? { phone } : { email });

    if (!user) {
      if (!name) {
        res.status(400).json({ error: "Nama diperlukan untuk pendaftaran baru" });
        return;
      }
      const nexId = await generateUniqueNexId();
      user = new User({
        nexId,
        name,
        phone: phone || undefined,
        email: email || undefined,
        otp,
        otpExpiry,
        isVerified: false,
      });
    } else {
      user.otp = otp;
      user.otpExpiry = otpExpiry;
    }

    await user.save();

    // Di production, kirim OTP via SMS/email. Untuk dev, tampilkan di response
    console.log(`OTP untuk ${phone || email}: ${otp}`);

    res.json({
      success: true,
      message: `OTP dikirim ke ${phone || email}`,
      // Untuk testing/development - hapus di production
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });
  } catch (error: any) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Gagal mengirim OTP" });
  }
});

// Verifikasi OTP
router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, email, otp } = req.body;

    if (!otp) {
      res.status(400).json({ error: "OTP diperlukan" });
      return;
    }

    const user = await User.findOne(phone ? { phone } : { email });

    if (!user) {
      res.status(404).json({ error: "User tidak ditemukan" });
      return;
    }

    if (!user.otp || user.otp !== otp) {
      res.status(400).json({ error: "OTP tidak valid" });
      return;
    }

    if (!user.otpExpiry || user.otpExpiry < new Date()) {
      res.status(400).json({ error: "OTP sudah kadaluarsa" });
      return;
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken(user._id.toString());

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        nexId: user.nexId,
        name: user.name,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        isOnline: user.isOnline,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Gagal verifikasi OTP" });
  }
});

export default router;
