import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";

const getConversations = async (req, res) => {
  const token = req.headers.token || req.query.token;
  if (!token) {
    return res.status(httpStatus.UNAUTHORIZED).json({ message: "No token provided" });
  }

  try {
    const user = await User.findOne({ token });
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
    }

    const conversations = await Conversation.find({
      participants: user._id,
    })
      .populate("participants", "name username uniqueId profilePic")
      .sort({ lastMessageAt: -1 });

    res.json(conversations);
  } catch (e) {
    res.status(500).json({ message: `Something went wrong: ${e.message}` });
  }
};

const getMessages = async (req, res) => {
  const token = req.headers.token || req.query.token;
  const { conversationId } = req.params;

  if (!token) {
    return res.status(httpStatus.UNAUTHORIZED).json({ message: "No token provided" });
  }

  try {
    const user = await User.findOne({ token });
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
    }

    // Verify user is participant
    const convo = await Conversation.findById(conversationId);
    if (!convo || !convo.participants.includes(user._id)) {
      return res.status(httpStatus.FORBIDDEN).json({ message: "Unauthorized to access this conversation" });
    }

    const messages = await Message.find({ conversationId })
      .populate("sender", "name username uniqueId profilePic")
      .sort({ createdAt: 1 }); // Oldest first

    res.json(messages);
  } catch (e) {
    res.status(500).json({ message: `Something went wrong: ${e.message}` });
  }
};

const createOrGetConversation = async (req, res) => {
  const token = req.headers.token || req.body.token;
  const { recipientUniqueId } = req.body;

  if (!token) {
    return res.status(httpStatus.UNAUTHORIZED).json({ message: "No token provided" });
  }

  try {
    const user = await User.findOne({ token });
    if (!user) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
    }

    const recipient = await User.findOne({ uniqueId: recipientUniqueId });
    if (!recipient) {
      return res.status(httpStatus.NOT_FOUND).json({ message: "Recipient not found" });
    }

    if (user._id.equals(recipient._id)) {
      return res.status(httpStatus.BAD_REQUEST).json({ message: "Cannot chat with yourself" });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [user._id, recipient._id] },
    }).populate("participants", "name username uniqueId profilePic");

    if (!conversation) {
      conversation = new Conversation({
        participants: [user._id, recipient._id],
      });
      await conversation.save();
      
      // Populate participants for response
      conversation = await Conversation.findById(conversation._id).populate("participants", "name username uniqueId profilePic");

      // Add each other to contacts if not already there
      if (!user.contacts.includes(recipient._id)) {
        user.contacts.push(recipient._id);
        await user.save();
      }
      if (!recipient.contacts.includes(user._id)) {
        recipient.contacts.push(user._id);
        await recipient.save();
      }
    }

    res.status(httpStatus.OK).json(conversation);
  } catch (e) {
    res.status(500).json({ message: `Something went wrong: ${e.message}` });
  }
};

export { getConversations, getMessages, createOrGetConversation };
