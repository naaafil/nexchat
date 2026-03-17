import mongoose, { Schema, Document } from "mongoose";

export interface IStory extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: "text" | "image";
  content?: string;
  mediaUrl?: string;
  bgColor?: string;
  views: mongoose.Types.ObjectId[];
  expiresAt: Date;
  createdAt: Date;
}

const StorySchema = new Schema<IStory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["text", "image"], default: "text" },
    content: { type: String },
    mediaUrl: { type: String },
    bgColor: { type: String, default: "#6c63ff" },
    views: [{ type: Schema.Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

StorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Story = mongoose.model<IStory>("Story", StorySchema);
