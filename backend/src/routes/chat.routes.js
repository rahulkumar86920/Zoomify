import { Router } from "express";
import {
  getConversations,
  getMessages,
  createOrGetConversation,
} from "../controllers/chat.controller.js";

const router = Router();

router.route("/conversations")
  .get(getConversations)
  .post(createOrGetConversation);

router.route("/messages/:conversationId")
  .get(getMessages);

export default router;
