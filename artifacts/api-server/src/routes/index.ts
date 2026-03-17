import { Router } from "express";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import chatRoutes from "./chats.js";
import uploadRoutes from "./upload.js";
import storyRoutes from "./stories.js";
import pushRoutes from "./push.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/chats", chatRoutes);
router.use("/upload", uploadRoutes);
router.use("/stories", storyRoutes);
router.use("/push", pushRoutes);

// Serve uploaded files
router.get("/uploads/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(process.cwd(), "uploads", filename);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "File tidak ditemukan" });
    return;
  }
  const stream = createReadStream(filePath);
  stream.pipe(res as any);
});

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok", service: "NexChat API" });
});

// Serve the frontend at /api/ (since the proxy routes /api to this server)
const publicDir = path.join(__dirname, "../../public");
router.get("/app", (_req, res) => {
  const htmlPath = path.join(publicDir, "index.html");
  if (existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).send("Frontend not found");
  }
});

// Serve service worker
router.get("/sw.js", (_req, res) => {
  const swPath = path.join(publicDir, "sw.js");
  if (existsSync(swPath)) {
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Service-Worker-Allowed", "/");
    res.sendFile(swPath);
  } else {
    res.status(404).send("Not found");
  }
});

// Redirect root /api to /api/app
router.get("/", (_req, res) => {
  res.redirect("/api/app");
});

export default router;
