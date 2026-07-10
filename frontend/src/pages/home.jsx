import React, { useContext, useState } from "react";
import withAuth from "../utils/withAuth";
import { useNavigate } from "react-router-dom";
import "../App.css";
import RestoreIcon from "@mui/icons-material/Restore";
import LogoutIcon from "@mui/icons-material/Logout";
import { AuthContext } from "../contexts/AuthContext";
import { IconButton } from "@mui/material";

function HomeComponent() {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const [joining, setJoining] = useState(false);

  const { addToUserHistory } = useContext(AuthContext);

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

  return (
    <>
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
          <button
            className="navLogout"
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/auth");
            }}
          >
            <LogoutIcon style={{ fontSize: "0.85rem", marginRight: 4 }} />
            Logout
          </button>
        </div>
      </nav>

      {/* ── Meet area ── */}
      <div className="meetContainer">
        {/* Left: join card */}
        <div className="leftPanel">
          <h2>Built for Clarity.<br />Made for Connection.</h2>
          <p>Enter a meeting code to instantly join a call.</p>

          <div className="joinCard">
            <div className="joinInputRow">
              <input
                type="text"
                placeholder="Enter meeting code…"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.04)",
                  border: "1.5px solid rgba(255,255,255,0.1)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.75rem 1rem",
                  color: "var(--text-primary)",
                  fontSize: "0.95rem",
                  fontFamily: "'Inter', sans-serif",
                  outline: "none",
                  transition: "border-color 150ms ease, box-shadow 150ms ease",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--accent)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(124,110,240,0.2)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.1)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <button
                className="joinBtn"
                onClick={handleJoinVideoCall}
                disabled={joining}
                style={{
                  background: "linear-gradient(135deg, var(--accent), #9c6ef0)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "0.78rem 1.4rem",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  fontFamily: "'Inter', sans-serif",
                  cursor: joining ? "not-allowed" : "pointer",
                  opacity: joining ? 0.7 : 1,
                  boxShadow: "0 4px 24px rgba(124,110,240,0.35)",
                  transition: "transform 150ms ease, box-shadow 250ms ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (!joining) e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "translateY(0)";
                }}
              >
                {joining ? "Joining…" : "Join →"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: illustration */}
        <div className="rightPanel">
          <img src="/logo3.png" alt="Video call illustration" />
        </div>
      </div>
    </>
  );
}

export default withAuth(HomeComponent);
