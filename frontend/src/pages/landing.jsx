import React from "react";
import "../App.css";
import { Link, useNavigate } from "react-router-dom";
export default function LandingPage() {
  const router = useNavigate();

  return (
    <div className="landingPageContainer">
      <nav>
        <div className="navHeader">
          <h2>Zoomify Video Call</h2>
        </div>
        <div className="navlist">
          <p
            onClick={() => {
              /* router("/aljk23"); */
              router("/guest-login");
            }}
          >
            Join as Guest
          </p>
          <p
            onClick={() => {
              router("/auth");
            }}
          >
            Register
          </p>
          <div
            onClick={() => {
              router("/auth");
            }}
            role="button"
          >
            <p>Login</p>
          </div>
        </div>
      </nav>

      <div className="landingMainContainer">
        <div>
          <h1>
            {" "}
            {/* this is for the headline  */}
            <span style={{ color: "orange" }}>Connect</span> with your <br />
            loved Ones😊
          </h1>
          {/* tag line  */}
          <p className="spam">Skip the travel, Zoomify the moment</p>

          <div role="button">
            <Link to={"/auth"}>Get Started</Link>
          </div>
        </div>
        <div>{/*   <img src="/mobile.png" alt="" /> */}</div>
      </div>
    </div>
  );
}
