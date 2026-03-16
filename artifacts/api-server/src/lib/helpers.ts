import { v4 as uuidv4 } from "uuid";
import { User } from "../models/User.js";

export function generateNexId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "NCX-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function generateUniqueNexId(): Promise<string> {
  let nexId = generateNexId();
  let exists = await User.findOne({ nexId });
  while (exists) {
    nexId = generateNexId();
    exists = await User.findOne({ nexId });
  }
  return nexId;
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateChatId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  return `direct_${sorted[0]}_${sorted[1]}`;
}

export function generateGroupId(): string {
  return `group_${uuidv4()}`;
}
