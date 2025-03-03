import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/myapp";

// Connection options focused on pooling
const options = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 5, // Keep at least 5 connections open
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
};

// Cached connection
let cached: {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
} = { conn: null, promise: null };

export async function connectToDatabase() {
  // If we have a connection, return it
  if (cached.conn) {
    return cached.conn;
  }

  // If we're already connecting, wait for that to complete
  if (cached.promise) {
    return await cached.promise;
  }

  // Create a new connection
  cached.promise = mongoose.connect(MONGODB_URI, options);

  try {
    cached.conn = await cached.promise;
    console.log("MongoDB connected successfully");
    return cached.conn;
  } catch (e) {
    console.error("MongoDB connection error:", e);
    cached.promise = null;
    throw e;
  }
}

export async function disconnectFromDatabase() {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
    console.log("MongoDB disconnected");
  }
}
