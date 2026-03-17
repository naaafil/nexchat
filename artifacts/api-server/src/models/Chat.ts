import mongoose, { Schema, Document } from "mongoose";

export interface IChat extends Document {
  _id: mongoose.Types.ObjectId;
  chatId: string;
  type: "direct" | "group";
  participants: mongoose.Types.ObjectId[];
  groupName?: string;
  groupAvatar?: string;
  groupAdmin?: mongoose.Types.ObjectId;
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageAt?: Date;
  pinnedMessage?: {
    messageId: string;
    content: string;
    senderName: string;
    type: string;
  };
  createdAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    chatId: { type: String, unique: true, required: true },
    type: { type: String, enum: ["direct", "group"], required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    groupName: { type: String },
    groupAvatar: { type: String },
    groupAdmin: { type: Schema.Types.ObjectId, ref: "User" },
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    lastMessageAt: { type: Date },
    pinnedMessage: {
      messageId: { type: String },
      content: { type: String },
      senderName: { type: String },
      type: { type: String },
    },
  },
  { timestamps: true }
);

export const Chat = mongoose.model<IChat>("Chat", ChatSchema);
