import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import "../App.css";
import HomeIcon from "@mui/icons-material/Home";
import HistoryIcon from "@mui/icons-material/History";
import VideocamIcon from "@mui/icons-material/Videocam";
import { IconButton } from "@mui/material";

export default function History() {
  const { getHistoryOfUser } = useContext(AuthContext);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getHistoryOfUser();
        setMeetings(history || []);
      } catch {
        /* silently fail */
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <>
      {/* Navbar */}
      <nav className="navBar">
        <span className="navBrand">⚡ Zoomify</span>
        <div className="navActions">
          <IconButton
            onClick={() => navigate("/home")}
            title="Home"
            size="small"
          >
            <HomeIcon fontSize="small" />
          </IconButton>
        </div>
      </nav>

      <div className="historyContainer">
        {/* Header */}
        <div className="historyHeader">
          <HistoryIcon style={{ color: "var(--accent-light)", fontSize: "1.6rem" }} />
          <h2>Meeting History</h2>
        </div>

        {loading ? (
          <div className="emptyState">
            <p style={{ color: "var(--text-muted)" }}>Loading…</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="emptyState">
            <VideocamIcon />
            <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
              No meetings yet
            </p>
            <p style={{ fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Join a call and it will show up here
            </p>
          </div>
        ) : (
          <div className="meetingGrid">
            {meetings.map((meeting, i) => (
              <div key={i} className="meetingCard" style={{
                background: "var(--glass)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-md)",
                padding: "1rem 1.1rem",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                cursor: "pointer",
                transition: "transform 250ms ease, box-shadow 250ms ease, border-color 250ms ease",
              }}
                onClick={() => navigate(`/${meeting.meetingCode}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 32px rgba(124,110,240,0.15)";
                  e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.borderColor = "var(--glass-border)";
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                  marginBottom: "0.5rem",
                }}>
                  <VideocamIcon style={{ color: "var(--accent-light)", fontSize: "1.1rem" }} />
                  <span className="meetingCode" style={{
                    fontFamily: "'Space Grotesk', monospace",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}>
                    {meeting.meetingCode}
                  </span>
                </div>
                <p className="meetingDate" style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                }}>
                  {formatDate(meeting.date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
