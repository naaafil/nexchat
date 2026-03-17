import { Router, Response } from "express";
import webpush from "web-push";
import fs from "fs";
import path from "path";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";

const router = Router();

// Generate / load VAPID keys
const vapidPath = path.join(process.cwd(), ".vapid.json");
let vapidKeys: { publicKey: string; privateKey: string };

if (fs.existsSync(vapidPath)) {
  vapidKeys = JSON.parse(fs.readFileSync(vapidPath, "utf-8"));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(vapidPath, JSON.stringify(vapidKeys));
}

webpush.setVapidDetails(
  "mailto:nexchat@app.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// In-memory subscription store (keyed by userId)
// For production, store in MongoDB
const subscriptions = new Map<string, webpush.PushSubscription[]>();

export function sendPushToUser(userId: string, payload: object) {
  const subs = subscriptions.get(userId) || [];
  for (const sub of subs) {
    webpush.sendNotification(sub, JSON.stringify(payload)).catch(() => {});
  }
}

// GET VAPID public key
router.get("/vapid-public-key", (_req, res: Response) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// POST subscribe
router.post("/subscribe", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const subscription = req.body as webpush.PushSubscription;
  if (!subscription?.endpoint) {
    res.status(400).json({ error: "Subscription tidak valid" });
    return;
  }
  const userId = req.userId!;
  const existing = subscriptions.get(userId) || [];
  // Avoid duplicate endpoints
  if (!existing.find(s => s.endpoint === subscription.endpoint)) {
    existing.push(subscription);
    subscriptions.set(userId, existing);
  }
  res.json({ success: true });
});

// POST unsubscribe
router.post("/unsubscribe", authMiddleware as any, (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body;
  const userId = req.userId!;
  const existing = subscriptions.get(userId) || [];
  subscriptions.set(userId, existing.filter(s => s.endpoint !== endpoint));
  res.json({ success: true });
});

export default router;
