import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  chatId: string;
  sender: mongoose.Types.ObjectId;
  content: string;
  type: "text" | "image" | "file" | "voice";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  readBy: mongoose.Types.ObjectId[];
  isDeleted: boolean;
  replyTo?: {
    messageId: string;
    content: string;
    senderName: string;
    type: string;
  };
  forwardedFrom?: {
    name: string;
    content: string;
  };
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    chatId: { type: String, required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "" },
    type: { type: String, enum: ["text", "image", "file", "voice"], default: "text" },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    duration: { type: Number },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isDeleted: { type: Boolean, default: false },
    replyTo: {
      messageId: { type: String },
      content: { type: String },
      senderName: { type: String },
      type: { type: String },
    },
    forwardedFrom: {
      name: { type: String },
      content: { type: String },
    },
  },
  { timestamps: true }
);

export const Message = mongoose.model<IMessage>("Message", MessageSchema);
