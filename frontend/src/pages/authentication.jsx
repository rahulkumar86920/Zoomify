import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";
import CloseIcon from "@mui/icons-material/Close";
import { AuthContext } from "../contexts/AuthContext";

// REPLACE THIS CLIENT ID WITH YOUR ACTUAL GOOGLE DEVELOPER CONSOLE CLIENT ID
const GOOGLE_CLIENT_ID = "220493047009-ossr269apmjt0feia1hm1cljkqu2ptli.apps.googleusercontent.com";

export default function Authentication() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [profilePic, setProfilePic] = useState("");
  const [sessionData, setSessionData] = useState(null);

  const { handleGoogleLogin, updateProfile } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("token")) {
      navigate("/home");
      return;
    }

    // Callback to process JWT response from Google Identity Services
    const handleGoogleCredentialResponse = async (response) => {
      setError("");
      setLoading(true);
      try {
        const data = await handleGoogleLogin(response.credential);
        if (data) {
          if (data.isNewUser) {
            // Succeeded but Google account has no profile picture
            setSessionData(data);
            setShowUploadForm(true);
          } else {
            // Already registered with profile photo, enter dashboard
            navigate("/home");
          }
        }
      } catch (err) {
        const msg = err?.response?.data?.message || "Google authentication failed.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    /* global google */
    if (window.google) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
      });

      google.accounts.id.renderButton(
        document.getElementById("google-login-btn"),
        { theme: "outline", size: "large", text: "signin_with", shape: "pill", width: "340", logo_alignment: "left" }
      );
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredentialResponse,
          });
          google.accounts.id.renderButton(
            document.getElementById("google-login-btn"),
            { theme: "outline", size: "large", text: "signin_with", shape: "pill", width: "340", logo_alignment: "left" }
          );
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [navigate, handleGoogleLogin]);

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

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    if (!profilePic) {
      setError("Please upload a profile picture.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await updateProfile(sessionData.name, sessionData.uniqueId, profilePic);
      navigate("/home");
    } catch (err) {
      setError("Failed to update profile image. Please try again.");
    } finally {
      setLoading(false);
    }
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
        <div className="authCard googleAuthCard">
          {!showUploadForm ? (
            <>
              <div className="cardBrandBadge">⚡ Zoomify</div>

              <h1 className="premiumAuthHeading">Sign in</h1>
              <p className="premiumAuthSubtext">
                Connect and collaborate instantly. Use your Google account to access Zoomify secure chats and video meetings.
              </p>

              {error && <p className="authError" style={{ marginBlock: "1rem" }}>⚠ {error}</p>}

              <div className="googleBtnContainer">
                <div id="google-login-btn"></div>
              </div>

              <div className="premiumAuthDisclaimer">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </div>
            </>
          ) : (
            <>
              <div className="cardBrandBadge">⚡ Zoomify</div>

              <h1 className="premiumAuthHeading">Upload Profile Picture</h1>
              <p className="premiumAuthSubtext">
                Your Google account doesn't have a public profile image. Please choose an avatar to finalize your registration.
              </p>

              <form onSubmit={handleCompleteRegistration}>
                <div className="authField" style={{ marginBottom: "1.5rem" }}>
                  <div className="fileUploadWrapper">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      id="signup-profile-pic"
                      style={{ display: "none" }}
                    />
                    <label htmlFor="signup-profile-pic" className="fileUploadLabel">
                      {profilePic ? (
                        <div className="avatarPreview">
                          <img src={profilePic} alt="Preview" />
                          <span>Change Photo</span>
                        </div>
                      ) : (
                        <div className="avatarPlaceholder">
                          <span>Select Profile Image</span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {error && <p className="authError" style={{ marginBlock: "1rem" }}>⚠ {error}</p>}

                <button
                  type="submit"
                  className="authSubmitBtn"
                  disabled={loading || !profilePic}
                  style={{ opacity: (loading || !profilePic) ? 0.7 : 1 }}
                >
                  {loading ? "Completing Setup..." : "Complete Registration →"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
