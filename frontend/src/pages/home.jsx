import React, { useContext, useState, useEffect } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import RestoreIcon from "@mui/icons-material/Restore";
import LogoutIcon from "@mui/icons-material/Logout";
import VideocamIcon from "@mui/icons-material/Videocam";
import KeyboardIcon from "@mui/icons-material/Keyboard";
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

  const handleJoinVideoCall = async (codeToJoin) => {
    const targetCode = codeToJoin || meetingCode;
    if (!targetCode.trim()) return;
    setJoining(true);
    try {
      await addToUserHistory(targetCode.trim());
      navigate(`/${targetCode.trim()}`);
    } catch {
      setJoining(false);
    }
  };

  const handleStartInstantMeeting = () => {
    // Generate random meeting code: xxx-xxxx-xxx format
    const part1 = Math.random().toString(36).substring(2, 5);
    const part2 = Math.random().toString(36).substring(2, 6);
    const part3 = Math.random().toString(36).substring(2, 5);
    const generatedCode = `${part1}-${part2}-${part3}`;
    handleJoinVideoCall(generatedCode);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleJoinVideoCall();
  };

  const userName = localStorage.getItem("name") || localStorage.getItem("username") || "User";
  const userInitial = userName.trim().charAt(0).toUpperCase();

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
            {userInitial}
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

      {/* ── Main Dashboard Layout ── */}
      <div className="meetContainer">
        {/* Left column: Welcome & quick actions */}
        <div className="leftPanel">
          <div className="welcomeHeader">
            <h2>Welcome back, {userName}</h2>
            <p>Ready to start a high-quality connection?</p>
          </div>

          <div className="dashboardActionsGrid">
            {/* Quick action 1: Instant meeting */}
            <div className="actionCard instantMeeting" onClick={handleStartInstantMeeting}>
              <div className="cardIcon">
                <VideocamIcon style={{ fontSize: "2rem" }} />
              </div>
              <div className="cardText">
                <h3>New Meeting</h3>
                <p>Start an instant call and invite others</p>
              </div>
            </div>

            {/* Quick action 2: Join card */}
            <div className="actionCard joinMeeting">
              <div className="cardIcon secondary">
                <KeyboardIcon style={{ fontSize: "1.8rem" }} />
              </div>
              <div className="cardText">
                <h3>Join with code</h3>
                <p>Enter code to participate in a call</p>
                <div className="dashboardJoinRow">
                  <input
                    type="text"
                    placeholder="abc-defg-hij"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    onClick={() => handleJoinVideoCall()}
                    disabled={joining || !meetingCode.trim()}
                  >
                    {joining ? "Joining" : "Join"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: live widget */}
        <div className="rightPanel">
          <div className="liveClockWidget">
            <div className="clockTime">{formattedTime}</div>
            <div className="clockDate">{formattedDate}</div>
            <div className="clockDivider" />
            <div className="connectionStatus">
              <span className="statusDot" />
              <span>Zoomify WebRTC Node Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(HomeComponent);

