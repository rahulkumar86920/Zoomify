import mongoose, { Schema } from "mongoose";
import crypto from "crypto";

const userSchema = new Schema(
    {
        name: { type: String, required: true },
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        token: { type: String },
        uniqueId: {
            type: String,
            unique: true,
            default: () => crypto.randomBytes(4).toString("hex"),
        },
        contacts: [{ type: Schema.Types.ObjectId, ref: "User" }],
    },
    { timestamps: true }
);

// Index for fast search
userSchema.index({ name: "text", username: "text" });

const User = mongoose.model("User", userSchema);

export { User };