import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  nexId: string;
  name: string;
  phone?: string;
  email?: string;
  passwordHash?: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  otp?: string;
  otpExpiry?: Date;
  isVerified: boolean;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    nexId: { type: String, unique: true, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, sparse: true, unique: true },
    email: { type: String, sparse: true, unique: true, lowercase: true },
    passwordHash: { type: String },
    avatar: { type: String, default: null },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    otp: { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);
