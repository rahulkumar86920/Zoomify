import React, { useState, useEffect, useRef, useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";
import SendIcon from "@mui/icons-material/Send";
import VideocamIcon from "@mui/icons-material/Videocam";
import CallIcon from "@mui/icons-material/Call";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

export default function ChatView({ convo, socket, onBack }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  
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
        // Instantly mark the message as read since the conversation is currently open
        socket.emit("read-conversation", {
          conversationId: convo._id,
          senderUsername: currentUserUsername
        });
      }
    };

    const handleTypingReceive = (data) => {
      if (data.senderUsername === otherUser.username) {
        setOtherUserTyping(data.isTyping);
      }
    };

    const handleReadAck = (data) => {
      if (data.conversationId === convo._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender.username === currentUserUsername
              ? { ...msg, read: true, delivered: true }
              : msg
          )
        );
      }
    };

    const handleDelivered = (data) => {
      if (data.conversationId === convo._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.sender.username === currentUserUsername
              ? { ...msg, delivered: true }
              : msg
          )
        );
      }
    };

    socket.on("dm-receive", handleDmReceive);
    socket.on("dm-typing-receive", handleTypingReceive);
    socket.on("conversation-read-ack", handleReadAck);
    socket.on("messages-delivered", handleDelivered);

    return () => {
      socket.off("dm-receive", handleDmReceive);
      socket.off("dm-typing-receive", handleTypingReceive);
      socket.off("conversation-read-ack", handleReadAck);
      socket.off("messages-delivered", handleDelivered);
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
    
    // Programmatically re-focus the input to keep mobile soft keyboard open
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);

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
    const code = "call-" + Math.random().toString(36).substring(2, 11);
    socket.emit("call-invite", {
      senderName: currentUserName,
      senderUsername: currentUserUsername,
      recipientUsername: otherUser.username,
      meetingCode: code,
      isVideo: isVideo,
      conversationId: convo._id // Include conversationId in the socket invite payload
    });

    // Go directly to room — pass parameters for audio state, recipient username, and conversation ID
    navigate(isVideo 
      ? `/${code}?to=${otherUser.username}&convo=${convo._id}` 
      : `/${code}?audio=1&to=${otherUser.username}&convo=${convo._id}`);
  };

  const formatLastSeen = (dateStr) => {
    if (!dateStr) return "offline";
    const date = new Date(dateStr);
    const diffMs = new Date() - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "last seen just now";
    if (diffMins < 60) return `last seen ${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `last seen at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `last seen on ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };

  const renderMessageStatus = (msg) => {
    if (msg.read) {
      return (
        <span className="msgStatusTick read" title="Read">
          ✓✓
        </span>
      );
    }
    if (msg.delivered) {
      return (
        <span className="msgStatusTick delivered" title="Delivered">
          ✓✓
        </span>
      );
    }
    return (
      <span className="msgStatusTick sent" title="Sent">
        ✓
      </span>
    );
  };

  // Messages List
  return (
    <div className="chatViewContainer">
      {/* Header */}
      <div className="chatViewHeader">
        <button className="backBtn" onClick={onBack}>
          <ArrowBackIcon />
        </button>
        <div className="chatHeaderUserInfo">
          <div className="avatarCircle headerAvatar">
            {otherUser.profilePic ? (
              <img src={otherUser.profilePic} alt={otherUser.name} className="avatarImg" />
            ) : (
              otherUser.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="chatHeaderUserDetails">
            <span className="chatHeaderUserName">{otherUser.name}</span>
            <span className="chatHeaderUserStatus">
              {otherUserTyping ? (
                <span style={{ color: "#00a884", fontWeight: "600" }}>typing...</span>
              ) : otherUser.isOnline ? (
                <span style={{ color: "#00a884", fontWeight: "600" }}>online</span>
              ) : (
                formatLastSeen(otherUser.lastSeen)
              )}
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
                <div className="messageMetadata">
                  <span className="messageTime">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isOwn && renderMessageStatus(msg)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel */}
      <div className="chatInputArea">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
        />
        <button 
          className="sendMsgBtn" 
          onClick={handleSend} 
          onMouseDown={(e) => e.preventDefault()} 
          disabled={!inputText.trim()}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
