import React, { useState, useEffect, useRef, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import SendIcon from "@mui/icons-material/Send";
import VideocamIcon from "@mui/icons-material/Videocam";
import CallIcon from "@mui/icons-material/Call";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export default function ChatView({ convo, socket, onBack }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  
  const { getMessages } = useContext(AuthContext);

  const currentUserUsername = localStorage.getItem("username");
  const currentUserName = localStorage.getItem("name");

  const otherUser = convo.participants.find(p => p.username !== currentUserUsername) || {
    name: "User",
    username: "",
    uniqueId: ""
  };

  // Fetch past messages
  useEffect(() => {
    const fetchMsgs = async () => {
      try {
        const data = await getMessages(convo._id);
        setMessages(data || []);
        scrollToBottom();
      } catch (e) {
        console.error("Failed to load messages:", e);
      }
    };
    fetchMsgs();
  }, [convo._id]);

  // Socket listener for incoming DMs and typing indicator
  useEffect(() => {
    if (!socket) return;

    const handleDmReceive = (msg) => {
      if (msg.conversationId === convo._id) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleTypingReceive = (data) => {
      if (data.senderUsername === otherUser.username) {
        setOtherUserTyping(data.isTyping);
      }
    };

    socket.on("dm-receive", handleDmReceive);
    socket.on("dm-typing-receive", handleTypingReceive);

    return () => {
      socket.off("dm-receive", handleDmReceive);
      socket.off("dm-typing-receive", handleTypingReceive);
    };
  }, [socket, convo._id, otherUser.username]);

  // Auto-scroll on new message
  useEffect(() => {
    scrollToBottom();
  }, [messages, otherUserTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = () => {
    if (!inputText.trim() || !socket) return;

    socket.emit("send-dm", {
      senderUsername: currentUserUsername,
      recipientUsername: otherUser.username,
      text: inputText.trim(),
      conversationId: convo._id
    });

    setInputText("");
    // Stop typing immediately
    socket.emit("typing-dm", {
      senderUsername: currentUserUsername,
      recipientUsername: otherUser.username,
      isTyping: false
    });
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!socket) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing-dm", {
        senderUsername: currentUserUsername,
        recipientUsername: otherUser.username,
        isTyping: true
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing-dm", {
        senderUsername: currentUserUsername,
        recipientUsername: otherUser.username,
        isTyping: false
      });
    }, 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  // Call invitation handlers
  const initiateCall = (isVideo) => {
    if (!socket) return;

    // Generate custom code: call-xxx-xxx-xxx
    const code = "call-" + Math.random().toString(36).substring(2, 11);
    
    // Emit call invite to recipient
    socket.emit("call-invite", {
      senderName: currentUserName,
      senderUsername: currentUserUsername,
      recipientUsername: otherUser.username,
      meetingCode: code,
      isVideo: isVideo
    });

    // Go directly to room
    window.location.href = `/${code}`;
  };

  return (
    <div className="chatViewContainer">
      {/* Header */}
      <div className="chatViewHeader">
        <button className="backBtn" onClick={onBack}>
          <ArrowBackIcon />
        </button>
        <div className="chatHeaderUserInfo">
          <div className="avatarCircle headerAvatar">
            {otherUser.name.charAt(0).toUpperCase()}
          </div>
          <div className="chatHeaderUserDetails">
            <span className="chatHeaderUserName">{otherUser.name}</span>
            <span className="chatHeaderUserStatus">
              {otherUserTyping ? "typing..." : `@${otherUser.uniqueId}`}
            </span>
          </div>
        </div>
        <div className="chatHeaderActions">
          <button className="headerActionBtn" onClick={() => initiateCall(false)} title="Voice Call">
            <CallIcon />
          </button>
          <button className="headerActionBtn" onClick={() => initiateCall(true)} title="Video Call">
            <VideocamIcon />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="chatMessagesList">
        {messages.map((msg) => {
          const isOwn = msg.sender.username === currentUserUsername;
          return (
            <div
              key={msg._id}
              className={`messageRow ${isOwn ? "own" : "incoming"}`}
            >
              <div className="messageBubble">
                <span className="messageText">{msg.text}</span>
                <span className="messageTime">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel */}
      <div className="chatInputArea">
        <input
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
        />
        <button className="sendMsgBtn" onClick={handleSend} disabled={!inputText.trim()}>
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
