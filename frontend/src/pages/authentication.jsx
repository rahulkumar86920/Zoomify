import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CloseIcon from "@mui/icons-material/Close";
import { AuthContext } from "../contexts/AuthContext";

export default function Authentication() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName]         = useState("");
  const [profilePic, setProfilePic] = useState(""); // base64 representation of uploaded image
  const [error, setError]       = useState("");
  const [message, setMessage]   = useState("");
  const [formState, setFormState] = useState(0); // 0 = login, 1 = register
  const [showPass, setShowPass] = useState(false);
  const [showSnack, setShowSnack] = useState(false);
  const [loading, setLoading]   = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image size should be less than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const { handleRegister, handleLogin } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("token")) {
      navigate("/home");
    }
  }, [navigate]);

  useEffect(() => {
    if (showSnack) {
      const t = setTimeout(() => setShowSnack(false), 3500);
      return () => clearTimeout(t);
    }
  }, [showSnack]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (formState === 0) {
        await handleLogin(username, password);
      } else {
        const result = await handleRegister(name, username, password, profilePic);
        setMessage(result || "Account created! Please sign in.");
        setShowSnack(true);
        setFormState(0);
        setUsername("");
        setPassword("");
        setName("");
        setProfilePic("");
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setFormState(tab);
    setError("");
  };

  return (
    <div className="authPage">
      {/* Nav */}
      <nav className="authNav">
        <span
          className="authNavBrand"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >
          ⚡ Zoomify
        </span>
        <button
          className="authCloseBtn"
          onClick={() => navigate("/")}
          title="Back to home"
        >
          <CloseIcon style={{ fontSize: "1.2rem" }} />
        </button>
      </nav>

      {/* Card */}
      <div className="authContent">
        <div className="authCard">
          {/* Icon */}
          <div className="authIconWrapper">
            <LockOutlinedIcon />
          </div>

          <h1>{formState === 0 ? "Welcome back" : "Create account"}</h1>
          <p>
            {formState === 0
              ? "Sign in to your Zoomify account"
              : "Join Zoomify — it's free"}
          </p>

          {/* Tabs */}
          <div className="authTabs">
            <button
              type="button"
              className={`authTab ${formState === 0 ? "active" : ""}`}
              onClick={() => switchTab(0)}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`authTab ${formState === 1 ? "active" : ""}`}
              onClick={() => switchTab(1)}
            >
              Sign Up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} noValidate>
            {formState === 1 && (
              <>
                <div className="authField">
                  <label htmlFor="full-name">Full Name</label>
                  <input
                    id="full-name"
                    type="text"
                    placeholder="Rahul Sah"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="authField">
                  <label>Profile Photo</label>
                  <div className="fileUploadWrapper">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      id="profile-pic-upload"
                      style={{ display: "none" }}
                    />
                    <label htmlFor="profile-pic-upload" className="fileUploadLabel">
                      {profilePic ? (
                        <div className="avatarPreview">
                          <img src={profilePic} alt="Preview" />
                          <span>Change Photo</span>
                        </div>
                      ) : (
                        <div className="avatarPlaceholder">
                          <span>Click to Upload Photo</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </>
            )}

            <div className="authField">
              <label htmlFor="auth-username">Username</label>
              <input
                id="auth-username"
                type="text"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="authField" style={{ position: "relative" }}>
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={formState === 0 ? "current-password" : "new-password"}
                style={{ paddingRight: "2.8rem" }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "2.25rem",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                }}
                tabIndex={-1}
              >
                {showPass ? (
                  <VisibilityOffIcon style={{ fontSize: "1.1rem" }} />
                ) : (
                  <VisibilityIcon style={{ fontSize: "1.1rem" }} />
                )}
              </button>
            </div>

            {error && <p className="authError">⚠ {error}</p>}

            <button
              type="submit"
              className="authSubmitBtn"
              disabled={loading}
              style={{ opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading
                ? "Please wait…"
                : formState === 0
                ? "Sign In →"
                : "Create Account →"}
            </button>
          </form>
        </div>
      </div>

      {/* Success snackbar */}
      {showSnack && (
        <div className="authSnackbar">✓ {message}</div>
      )}
    </div>
  );
}
