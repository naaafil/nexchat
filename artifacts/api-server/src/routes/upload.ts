import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";

const router = Router();
router.use(authMiddleware as any);

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf", "application/zip", "text/plain",
      "video/mp4", "audio/mpeg",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipe file tidak didukung"));
    }
  },
});

router.post("/", upload.single("file"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Tidak ada file yang diupload" });
      return;
    }

    const isImage = req.file.mimetype.startsWith("image/");
    const fileUrl = `/api/uploads/${req.file.filename}`;

    res.json({
      success: true,
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      type: isImage ? "image" : "file",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Gagal upload file" });
  }
});

export default router;
