import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import { AuthContext } from "../contexts/AuthContext";
import SearchUsers from "./SearchUsers";
import ChatView from "./ChatView";
import RestoreIcon from "@mui/icons-material/Restore";
import LogoutIcon from "@mui/icons-material/Logout";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import VideocamIcon from "@mui/icons-material/Videocam";
import PhoneInTalkIcon from "@mui/icons-material/PhoneInTalk";
import PhoneDisabledIcon from "@mui/icons-material/PhoneDisabled";
import CloseIcon from "@mui/icons-material/Close";
import server from "../environment";
import "../App.css";

export default function ChatHome() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showMeetMenu, setShowMeetMenu] = useState(false);
  const [meetingCode, setMeetingCode] = useState("");
  const [joining, setJoining] = useState(false);
  
  // Incoming Call State
  const [incomingCall, setIncomingCall] = useState(null); // { senderName, senderUsername, meetingCode, isVideo }

  const [currentTime, setCurrentTime] = useState(new Date());
  const socketRef = useRef(null);

  const { getConversations, addToUserHistory } = useContext(AuthContext);

  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");
  const name = localStorage.getItem("name") || username || "User";
  const uniqueId = localStorage.getItem("uniqueId") || "";
  const userInitial = name.trim().charAt(0).toUpperCase();

  // Redirect if not authenticated
  useEffect(() => {
    if (!token) {
      navigate("/auth");
    }
  }, [token, navigate]);

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Conversations List on mount/update
  const fetchConversationsList = async () => {
    try {
      const data = await getConversations();
      setConversations(data || []);
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchConversationsList();
    }
  }, [token]);

  // Connect to Socket.io for Direct Messages and Calling
  useEffect(() => {
    if (!username) return;

    socketRef.current = io.connect(server, { secure: true });

    socketRef.current.on("connect", () => {
      console.log("[Socket] Connected to DM hub");
      socketRef.current.emit("join-dm-lobby", username);
    });

    socketRef.current.on("dm-receive", (msg) => {
      // Refresh conversations list to update lastMessage and order
      fetchConversationsList();
    });

    // Handle Incoming Call Invite
    socketRef.current.on("call-invite-receive", (callData) => {
      setIncomingCall(callData);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [username]);

  const handleStartInstantMeeting = async () => {
    const part1 = Math.random().toString(36).substring(2, 5);
    const part2 = Math.random().toString(36).substring(2, 6);
    const part3 = Math.random().toString(36).substring(2, 5);
    const code = `${part1}-${part2}-${part3}`;
    setJoining(true);
    try {
      await addToUserHistory(code);
      navigate(`/${code}`);
    } catch {
      setJoining(false);
    }
  };

  const handleJoinVideoCall = async () => {
    if (!meetingCode.trim()) return;
    setJoining(true);
    try {
      await addToUserHistory(meetingCode.trim());
      navigate(`/${meetingCode.trim()}`);
    } catch {
      setJoining(false);
    }
  };

  // Call acceptance/rejection
  const handleAcceptCall = () => {
    if (!incomingCall) return;
    if (socketRef.current) {
      socketRef.current.emit("call-accept", {
        recipientUsername: username,
        senderUsername: incomingCall.senderUsername,
        meetingCode: incomingCall.meetingCode
      });
    }
    navigate(`/${incomingCall.meetingCode}`);
    setIncomingCall(null);
  };

  const handleRejectCall = () => {
    if (!incomingCall) return;
    if (socketRef.current) {
      socketRef.current.emit("call-reject", {
        recipientUsername: username,
        senderUsername: incomingCall.senderUsername
      });
    }
    setIncomingCall(null);
  };

  const formattedTime = currentTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const handleLogout = () => {
    localStorage.clear();
    navigate("/auth");
  };

  return (
    <div className="chatDashboardWrapper">
      {/* ── Sidebar Pane ── */}
      <div className={`chatSidebar ${activeConvo ? "hiddenOnMobile" : ""}`}>
        {/* Header */}
        <div className="chatSidebarHeader">
          <div className="sidebarProfileInfo">
            <div className="avatarCircle headerAvatar">{userInitial}</div>
            <div className="sidebarUserDetails">
              <span className="profileName">{name}</span>
              <span className="profileId">@{uniqueId}</span>
            </div>
          </div>
          <div className="sidebarActions">
            <button onClick={() => setShowSearchModal(true)} title="Search and Start Chat">
              <SearchIcon fontSize="small" />
            </button>
            <button onClick={() => navigate("/history")} title="Meeting History">
              <RestoreIcon fontSize="small" />
            </button>
            <button onClick={handleLogout} title="Logout" className="logoutBtn">
              <LogoutIcon fontSize="small" />
            </button>
          </div>
        </div>

        {/* Chat List */}
        <div className="conversationsList">
          {conversations.length > 0 ? (
            conversations.map((convo) => {
              const other = convo.participants.find(p => p.username !== username) || {
                name: "User",
                uniqueId: "unknown"
              };
              const isActive = activeConvo && activeConvo._id === convo._id;
              return (
                <div
                  key={convo._id}
                  className={`conversationListItem ${isActive ? "active" : ""}`}
                  onClick={() => setActiveConvo(convo)}
                >
                  <div className="avatarCircle itemAvatar">
                    {other.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="convoItemDetails">
                    <div className="convoItemHeader">
                      <span className="convoItemName">{other.name}</span>
                      <span className="convoItemTime">
                        {convo.lastMessageAt ? new Date(convo.lastMessageAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        }) : ""}
                      </span>
                    </div>
                    <div className="convoItemBody">
                      <span className="convoLastMsgText">
                        {convo.lastMessage || `Start chatting with @${other.uniqueId}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="emptyChatList">
              <p>No active chats yet.</p>
              <button onClick={() => setShowSearchModal(true)} className="startChatPromptBtn">
                Search and Add Users
              </button>
            </div>
          )}
        </div>

        {/* Floating Meet Button Menu */}
        <div className="fabWrapper">
          <button className="mainMeetFab" onClick={() => setShowMeetMenu(!showMeetMenu)} title="Call Dashboard">
            {showMeetMenu ? <CloseIcon /> : <AddIcon />}
          </button>
          {showMeetMenu && (
            <div className="meetFabMenu">
              <button className="fabMenuItem" onClick={handleStartInstantMeeting}>
                Instant Meeting
              </button>
              <div className="fabMenuDivider" />
              <div className="fabMenuJoinRow">
                <input
                  type="text"
                  placeholder="Join with code..."
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                />
                <button onClick={handleJoinVideoCall} disabled={joining || !meetingCode.trim()}>
                  Go
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className={`chatMainContent ${!activeConvo ? "hiddenOnMobile" : ""}`}>
        {activeConvo ? (
          <ChatView
            convo={activeConvo}
            socket={socketRef.current}
            onBack={() => setActiveConvo(null)}
          />
        ) : (
          <div className="chatHomeWelcomeArea">
            <div className="liveClockWidget homeClock">
              <div className="clockTime">{formattedTime}</div>
              <div className="clockDate">{formattedDate}</div>
              <div className="clockDivider" />
              <div className="connectionStatus">
                <span className="statusDot" />
                <span>Zoomify Node Secure</span>
              </div>
            </div>
            <h2>Zoomify Secure Messenger</h2>
            <p>Select a contact from the sidebar to chat, voice call, or video call. Or use the floating action button to spin up an instant WebRTC room.</p>
          </div>
        )}
      </div>

      {/* ── Search Users Modal ── */}
      {showSearchModal && (
        <SearchUsers
          onClose={() => setShowSearchModal(false)}
          onSelectConvo={(convo) => {
            setActiveConvo(convo);
            fetchConversationsList();
          }}
        />
      )}

      {/* ── Incoming Call Modal (WhatsApp Style) ── */}
      {incomingCall && (
        <div className="incomingCallOverlay">
          <div className="incomingCallCard">
            <div className="pulseRing" />
            <div className="avatarCircle incomingCallAvatar">
              {incomingCall.senderName.charAt(0).toUpperCase()}
            </div>
            <h2>{incomingCall.senderName}</h2>
            <p>{incomingCall.isVideo ? "Incoming Video Call..." : "Incoming Voice Call..."}</p>
            <div className="incomingCallActions">
              <button className="incomingCallBtn accept" onClick={handleAcceptCall} title="Accept Call">
                <PhoneInTalkIcon />
              </button>
              <button className="incomingCallBtn decline" onClick={handleRejectCall} title="Decline Call">
                <PhoneDisabledIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
