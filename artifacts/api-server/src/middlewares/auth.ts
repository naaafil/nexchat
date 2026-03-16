import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token tidak ditemukan" });
      return;
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "nexchat_secret";
    const decoded = jwt.verify(token, secret) as { userId: string };

    const user = await User.findById(decoded.userId).select("-passwordHash -otp -otpExpiry");
    if (!user) {
      res.status(401).json({ error: "User tidak ditemukan" });
      return;
    }

    req.userId = decoded.userId;
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Token tidak valid" });
  }
}
