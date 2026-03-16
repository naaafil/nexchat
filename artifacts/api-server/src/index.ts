import app from "./app.js";
import { connectDatabase } from "./lib/database.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start listening immediately, attempt DB connection in background
app.listen(port, () => {
  console.log(`NexChat server listening on port ${port}`);
  // Try to connect to MongoDB in background
  connectDatabase()
    .then(() => console.log("MongoDB ready"))
    .catch((err) => console.error("MongoDB connection failed - ensure IP is whitelisted in Atlas:", err.message));
});
