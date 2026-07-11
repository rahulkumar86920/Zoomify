import React, { useContext, useState, useEffect } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import RestoreIcon from "@mui/icons-material/Restore";
import LogoutIcon from "@mui/icons-material/Logout";
import VideocamIcon from "@mui/icons-material/Videocam";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { AuthContext } from "../contexts/AuthContext";
import { IconButton } from "@mui/material";

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { addToUserHistory } = useContext(AuthContext);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleJoinVideoCall();
  };

  const userName = localStorage.getItem("name") || localStorage.getItem("username") || "User";
  const userInitial = userName.trim().charAt(0).toUpperCase();
  const profilePic = localStorage.getItem("profilePic") || "";

  const formattedTime = currentTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="dashboardWrapper">
      {/* ── Navbar ── */}
      <nav className="navBar">
        <span className="navBrand">⚡ Zoomify</span>
        <div className="navActions">
          <IconButton
            onClick={() => navigate("/history")}
            title="Meeting History"
            size="small"
          >
            <RestoreIcon fontSize="small" />
          </IconButton>
          <div className="userAvatar" title={userName}>
            {profilePic ? (
              <img src={profilePic} alt={userName} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              userInitial
            )}
          </div>
          <button
            className="navLogout"
            onClick={() => {
              localStorage.clear();
              navigate("/auth");
            }}
          >
            <LogoutIcon style={{ fontSize: "0.85rem", marginRight: 4 }} />
            Logout
          </button>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className="homePageContent">
        {/* Greeting */}
        <div className="homeGreeting">
          <div className="homeTimeLine">
            <span className="homeClockTime">{formattedTime}</span>
            <span className="homeClockDate">{formattedDate}</span>
          </div>
          <h1>Hey, {userName.split(" ")[0]} 👋</h1>
          <p>What would you like to do today?</p>
        </div>

        {/* Actions */}
        <div className="homeActions">
          {/* Chat */}
          <button className="homeActionItem" onClick={() => navigate("/chat")}>
            <div className="homeActionIcon chatIcon">
              <ChatBubbleOutlineIcon />
            </div>
            <div className="homeActionText">
              <span className="homeActionTitle">Messages</span>
              <span className="homeActionSub">Chat with your contacts</span>
            </div>
            <ArrowForwardIcon className="homeActionArrow" />
          </button>

          {/* Join with Code */}
          <div className="homeJoinSection">
            <label className="homeJoinLabel">Join a meeting</label>
            <div className="homeJoinRow">
              <VideocamIcon className="joinIcon" />
              <input
                type="text"
                placeholder="Enter meeting code"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                onKeyDown={handleKeyDown}
                className="homeJoinInput"
              />
              <button
                className="homeJoinBtn"
                onClick={handleJoinVideoCall}
                disabled={joining || !meetingCode.trim()}
              >
                {joining ? "..." : "Join"}
              </button>
            </div>
          </div>

          {/* History */}
          <button className="homeActionItem secondary" onClick={() => navigate("/history")}>
            <div className="homeActionIcon historyIcon">
              <RestoreIcon />
            </div>
            <div className="homeActionText">
              <span className="homeActionTitle">History</span>
              <span className="homeActionSub">View past meetings</span>
            </div>
            <ArrowForwardIcon className="homeActionArrow" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default withAuth(HomeComponent);
