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
import SettingsIcon from "@mui/icons-material/Settings";
import server from "../environment";
import "../App.css";
import { initNotifications, showLocalNotification } from "../utils/notifications";
import { playMessageSound, startRingtone, stopRingtone } from "../utils/sounds";

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

  // Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUniqueId, setEditUniqueId] = useState("");
  const [editProfilePic, setEditProfilePic] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [updating, setUpdating] = useState(false);

  const { getConversations, addToUserHistory, updateProfile } = useContext(AuthContext);

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

  useEffect(() => {
    if (showSettingsModal) {
      setEditName(localStorage.getItem("name") || "");
      setEditUniqueId(localStorage.getItem("uniqueId") || "");
      setEditProfilePic(localStorage.getItem("profilePic") || "");
      setSettingsError("");
      setSettingsSuccess("");
    }
  }, [showSettingsModal]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsError("");
    setSettingsSuccess("");
    setUpdating(true);
    try {
      await updateProfile(editName, editUniqueId, editProfilePic);
      setSettingsSuccess("Profile updated successfully!");
      setTimeout(() => {
        setShowSettingsModal(false);
        setSettingsSuccess("");
      }, 1000);
      fetchConversationsList();
    } catch (err) {
      setSettingsError(err?.response?.data?.message || "Failed to update profile.");
    } finally {
      setUpdating(false);
    }
  };

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

  // Auto-select active conversation if passed in URL query param (e.g. returning from call)
  useEffect(() => {
    const convoQueryId = new URLSearchParams(window.location.search).get("convo");
    if (convoQueryId && conversations.length > 0) {
      const matched = conversations.find(c => c._id === convoQueryId);
      if (matched) {
        setActiveConvo(matched);
        // Clear convo query param from address bar to prevent looping or stale selects on refresh
        navigate("/home", { replace: true });
      }
    }
  }, [conversations, navigate]);

  // Init notification permission & service worker once
  useEffect(() => {
    initNotifications();
  }, []);

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
      
      // Play pleasant Web Audio ping sound
      if (msg.senderUsername !== username) {
        playMessageSound();
      }

      // Show notification if tab/app is not focused
      if (document.hidden || !document.hasFocus()) {
        showLocalNotification(
          `New message from ${msg.senderName || msg.senderUsername || "Someone"}`,
          msg.content || "Sent you a message",
          { tag: "dm-" + msg.senderUsername, url: "/chat" }
        );
      }
    });

    // Handle Incoming Call Invite
    socketRef.current.on("call-invite-receive", (callData) => {
      setIncomingCall(callData);
      // Always notify for incoming calls
      showLocalNotification(
        `📞 Incoming ${callData.isVideo ? "Video" : "Audio"} Call`,
        `${callData.senderName || callData.senderUsername} is calling you`,
        { tag: "call-" + callData.meetingCode, url: "/chat" }
      );
    });

    // Handle Call Cancelled (caller hung up before accepted)
    socketRef.current.on("call-cancelled", (data) => {
      setIncomingCall((prev) => {
        if (prev && prev.meetingCode === data.meetingCode) {
          alert("Call cancelled by sender");
          return null; // Immediately closes incoming call card and stops ringtone!
        }
        return prev;
      });
    });

    // Handle user online/offline status changes
    socketRef.current.on("user-status-change", (data) => {
      setConversations((prev) =>
        prev.map((c) => {
          const updatedParticipants = c.participants.map((p) =>
            p.username === data.username
              ? { ...p, isOnline: data.isOnline, lastSeen: data.lastSeen }
              : p
          );
          return { ...c, participants: updatedParticipants };
        })
      );
      setActiveConvo((prev) => {
        if (!prev) return null;
        const updatedParticipants = prev.participants.map((p) =>
          p.username === data.username
            ? { ...p, isOnline: data.isOnline, lastSeen: data.lastSeen }
            : p
        );
        return { ...prev, participants: updatedParticipants };
      });
    });

    // Handle typing status inside sidebar list in real-time
    socketRef.current.on("dm-typing-receive", (data) => {
      setConversations((prev) =>
        prev.map((c) => {
          const other = c.participants.find((p) => p.username === data.senderUsername);
          if (other) {
            return { ...c, isTyping: data.isTyping };
          }
          return c;
        })
      );
    });

    socketRef.current.on("conversation-read-ack", (data) => {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === data.conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      stopRingtone();
    };
  }, [username]);

  // Handle ringtone audio play/stop
  useEffect(() => {
    if (incomingCall) {
      startRingtone();
    } else {
      stopRingtone();
    }
    return () => {
      stopRingtone();
    };
  }, [incomingCall]);

  const handleSelectActiveConvo = (convo) => {
    setActiveConvo(convo);
    // Mark as read in DB and trigger real-time unread ack
    if (socketRef.current) {
      socketRef.current.emit("read-conversation", {
        conversationId: convo._id,
        senderUsername: username
      });
    }
    // Set unread count to 0 in local state so the badge disappears instantly!
    setConversations((prev) =>
      prev.map((c) =>
        c._id === convo._id ? { ...c, unreadCount: 0 } : c
      )
    );
  };

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
    navigate(incomingCall.isVideo 
      ? `/${incomingCall.meetingCode}?to=${incomingCall.senderUsername}&convo=${incomingCall.conversationId}` 
      : `/${incomingCall.meetingCode}?audio=1&to=${incomingCall.senderUsername}&convo=${incomingCall.conversationId}`);
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
            <div className="avatarCircle headerAvatar">
              {localStorage.getItem("profilePic") ? (
                <img src={localStorage.getItem("profilePic")} alt={name} className="avatarImg" />
              ) : (
                userInitial
              )}
            </div>
            <div className="sidebarUserDetails">
              <span className="profileName">{name}</span>
              <span className="profileId">@{uniqueId}</span>
            </div>
          </div>
          <div className="sidebarActions">
            <button onClick={() => setShowSearchModal(true)} title="Search and Start Chat">
              <SearchIcon fontSize="small" />
            </button>
            <button onClick={() => setShowSettingsModal(true)} title="Account Settings">
              <SettingsIcon fontSize="small" />
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
                  onClick={() => handleSelectActiveConvo(convo)}
                >
                  <div className="avatarCircle itemAvatar">
                    {other.profilePic ? (
                      <img src={other.profilePic} alt={other.name} className="avatarImg" />
                    ) : (
                      other.name.charAt(0).toUpperCase()
                    )}
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
                    <div className="convoItemBody" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {convo.isTyping ? (
                        <span className="convoLastMsgText" style={{ flex: 1, minWidth: 0, color: "#00a884", fontWeight: "600" }}>
                          typing...
                        </span>
                      ) : (
                        <span className="convoLastMsgText" style={{ flex: 1, minWidth: 0 }}>
                          {convo.lastMessage || `Start chatting with @${other.uniqueId}`}
                        </span>
                      )}
                      {convo.unreadCount > 0 && (
                        <span className="convoUnreadBadge">
                          {convo.unreadCount}
                        </span>
                      )}
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

        {/* Floating Meet Button — Join with Code only */}
        <div className="fabWrapper">
          <button className="mainMeetFab" onClick={() => setShowMeetMenu(!showMeetMenu)} title="Join Meeting">
            {showMeetMenu ? <CloseIcon /> : <AddIcon />}
          </button>
          {showMeetMenu && (
            <div className="meetFabMenu">
              <div className="fabMenuJoinRow">
                <input
                  type="text"
                  placeholder="Enter meeting code..."
                  value={meetingCode}
                  onChange={(e) => setMeetingCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinVideoCall()}
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

      {/* ── Settings Modal ── */}
      {showSettingsModal && (
        <div className="searchModalOverlay">
          <div className="searchModal settingsModal">
            <div className="searchModalHeader">
              <h3>Account Settings</h3>
              <button className="closeModalBtn" onClick={() => setShowSettingsModal(false)}>
                <CloseIcon />
              </button>
            </div>
            
            {/* Live Preview Avatar */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBlock: "1rem" }}>
              <div className="avatarCircle" style={{ width: "80px", height: "80px", fontSize: "2rem" }}>
                {editProfilePic ? (
                  <img src={editProfilePic} alt="Preview" className="avatarImg" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  (editName || "U").charAt(0).toUpperCase()
                )}
              </div>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>Avatar Preview</span>
            </div>

            <form onSubmit={handleSaveSettings} className="settingsForm">
              <div className="authField" style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.82rem", marginBottom: "4px", color: "var(--text-secondary)" }}>Profile Photo</label>
                <div className="fileUploadWrapper">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          alert("Image size should be less than 2MB.");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setEditProfilePic(reader.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    id="edit-profile-pic-upload"
                    style={{ display: "none" }}
                  />
                  <label htmlFor="edit-profile-pic-upload" className="fileUploadLabel">
                    <div className="avatarPlaceholder" style={{ padding: "0.55rem" }}>
                      <span>Click to Upload New Photo</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="authField" style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.82rem", marginBottom: "4px", color: "var(--text-secondary)" }}>Display Name</label>
                <input
                  type="text"
                  placeholder="Rahul Sah"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--glass-border)", color: "white" }}
                />
              </div>

              <div className="authField" style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.82rem", marginBottom: "4px", color: "var(--text-secondary)" }}>Unique Username / ID</label>
                <input
                  type="text"
                  placeholder="rahul_sah"
                  value={editUniqueId}
                  onChange={(e) => setEditUniqueId(e.target.value)}
                  required
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "8px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--glass-border)", color: "white" }}
                />
              </div>

              {settingsError && <p className="authError" style={{ marginBlock: "0.5rem" }}>⚠ {settingsError}</p>}
              {settingsSuccess && <p style={{ color: "var(--teal)", fontSize: "0.85rem", marginBlock: "0.5rem", textAlign: "center" }}>✓ {settingsSuccess}</p>}

              <button
                type="submit"
                className="authSubmitBtn"
                disabled={updating}
                style={{ width: "100%", marginTop: "0.5rem", padding: "0.6rem" }}
              >
                {updating ? "Saving Changes..." : "Save Settings →"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
