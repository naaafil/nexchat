import mongoose from "mongoose";

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;

const uri = process.env.MONGODB_URI || "mongodb+srv://nexchat:nexchat123@cluster0.wxljnik.mongodb.net/nexchat?appName=Cluster0";

  try {
    await mongoose.connect(uri, {
      dbName: "nexchat",
    });
    isConnected = true;
    console.log("Connected to MongoDB Atlas");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}
