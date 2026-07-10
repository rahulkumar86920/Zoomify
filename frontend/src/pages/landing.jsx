import React from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";
import VideocamIcon from "@mui/icons-material/Videocam";
import SecurityIcon from "@mui/icons-material/Security";
import SpeedIcon from "@mui/icons-material/Speed";
import GroupsIcon from "@mui/icons-material/Groups";

export default function LandingPage() {
  const router = useNavigate();

  return (
    <div className="landingPageContainer">
      {/* ── Navigation ── */}
      <nav>
        <div className="navHeader">
          <h2>⚡ Zoomify</h2>
        </div>
        <div className="navlist">
          <p onClick={() => router("/guest-login")}>Guest</p>
          <p onClick={() => router("/auth")}>Register</p>
          <div
            role="button"
            onClick={() => router("/auth")}
          >
            <p>Login</p>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="landingMainContainer">
        <div className="heroContent">
          <div className="heroBadge">
            <span className="heroBadgeDot" />
            Now live · Free to use
          </div>

          <h1>
            <span className="accent">Connect</span>{" "}
            with your<br />loved ones 😊
          </h1>

          <p className="spam">
            Skip the travel, Zoomify the moment.
            <br />Crystal-clear video calls, zero friction.
          </p>

          <div role="button">
            <Link to="/auth">Get Started Free →</Link>
          </div>

          {/* Feature chips */}
          <div className="featureChips">
            <span className="chip">
              <VideocamIcon /> HD Video
            </span>
            <span className="chip">
              <SecurityIcon /> End-to-End
            </span>
            <span className="chip">
              <SpeedIcon /> Low Latency
            </span>
            <span className="chip">
              <GroupsIcon /> Group Calls
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
