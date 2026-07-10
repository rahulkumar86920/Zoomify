import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
    {
        conversationId: {
            type: Schema.Types.ObjectId,
            ref: "Conversation",
            required: true,
            index: true,
        },
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        text: { type: String, required: true },
        read: { type: Boolean, default: false },
    },
    { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export { Message };
