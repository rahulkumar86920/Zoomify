import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";
import userRoutes from "./routes/users.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import { User } from "./models/user.model.js";
import crypto from "crypto";

const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", process.env.PORT || 3000);
app.use(cors());
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/chat", chatRoutes);

const start = async () => {
  try {
    const connectionDb = await mongoose.connect(
      "mongodb+srv://rahulkumar:Rahul150%40@cluster0.ghbafb3.mongodb.net/zoomify"
    );

    console.log("Connected!");
    console.log(connectionDb.connection.host);

    // Database Migration: Populate uniqueId for legacy accounts to prevent null index duplicate error
    const legacyUsers = await User.find({
      $or: [
        { uniqueId: { $exists: false } },
        { uniqueId: null },
        { uniqueId: "" }
      ]
    });
    
    if (legacyUsers.length > 0) {
      console.log(`[Migration] Found ${legacyUsers.length} users with missing uniqueId. Migrating...`);
      for (const u of legacyUsers) {
        u.uniqueId = crypto.randomBytes(4).toString("hex");
        await u.save();
      }
      console.log("[Migration] Database migrated successfully.");
    }

    server.listen(3000, () => {
      console.log("Listening on port 3000");
    });
  } catch (err) {
    console.error(err);
  }
};

start();
