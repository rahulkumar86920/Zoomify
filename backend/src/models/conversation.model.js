import mongoose, { Schema } from "mongoose";

const conversationSchema = new Schema(
    {
        participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
        lastMessage: { type: String, default: "" },
        lastMessageAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

// Compound index for fast lookup of conversations by participant
conversationSchema.index({ participants: 1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export { Conversation };
