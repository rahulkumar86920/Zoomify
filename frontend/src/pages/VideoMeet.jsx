import React, { useCallback, useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Badge, IconButton } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import styles from "../styles/videoComponent.module.css";
import server from "../environment";

const server_url = server;

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function VideoMeetComponent() {
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoref = useRef();
  const videoRef = useRef([]);

  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [video, setVideo] = useState(false);
  const [audio, setAudio] = useState(false);
  const [screen, setScreen] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [showModal, setModal] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState(() => {
    return localStorage.getItem("name") || localStorage.getItem("username") || "";
  });
  const [videos, setVideos] = useState([]);

  // Fullscreen overlay: { stream, label, isScreen }
  const [fullscreenVideo, setFullscreenVideo] = useState(null);

  const connections = useRef({}).current;
  const iceCandidatesQueue = useRef({}); // Queues remote ICE candidates during signaling handshake

  // ── Permissions ──────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Your browser does not support WebRTC. Please use Chrome, Firefox, or Edge.");
      return;
    }
    getPermissions();
  }, []);

  const getPermissions = async () => {
    try {
      const userMediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (userMediaStream) {
        const videoTracks = userMediaStream.getVideoTracks();
        const audioTracks = userMediaStream.getAudioTracks();

        setVideoAvailable(videoTracks.length > 0);
        setAudioAvailable(audioTracks.length > 0);
        setVideo(videoTracks.length > 0);
        setAudio(audioTracks.length > 0);

        window.localStream = userMediaStream;
        if (localVideoref.current) {
          localVideoref.current.srcObject = userMediaStream;
        }
      } else {
        setVideoAvailable(false);
        setAudioAvailable(false);
      }

      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setVideoAvailable(false);
      setAudioAvailable(false);
      alert("Failed to access camera or microphone. Please check permissions.");
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [video, audio]);

  useEffect(() => {
    if (screen !== undefined && screenAvailable) {
      if (screen) {
        getDisplayMedia();
      } else {
        // Screen sharing was turned off — restore camera stream
        switchBackToCamera();
      }
    }
  }, [screen]);

  // ── Replace tracks across all peer connections ───────────────
  // Uses replaceTrack (modern) instead of addStream (deprecated).
  // This is the key fix: avoids broken PeerConnection state that
  // prevented other participants from sharing after one person stopped.
  const replaceTracksInConnections = (newStream) => {
    for (const id in connections) {
      if (id === socketIdRef.current) continue;
      const senders = connections[id].getSenders();
      newStream.getTracks().forEach((newTrack) => {
        const sender = senders.find(
          (s) => s.track && s.track.kind === newTrack.kind
        );
        if (sender) {
          sender.replaceTrack(newTrack).catch((e) =>
            console.error("replaceTrack error:", e)
          );
        } else {
          connections[id].addTrack(newTrack, newStream);
          connections[id]
            .createOffer()
            .then((desc) => connections[id].setLocalDescription(desc))
            .then(() =>
              socketRef.current.emit(
                "signal",
                id,
                JSON.stringify({ sdp: connections[id].localDescription })
              )
            )
            .catch((e) => console.error("renegotiation error:", e));
        }
      });
    }
  };

  const getUserMedia = async () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: video && videoAvailable,
          audio: audio && audioAvailable,
        });
        getUserMediaSuccess(stream);
      } catch (e) {
        console.error("getUserMedia error:", e);
        alert("Failed to access camera or microphone.");
      }
    } else {
      try {
        if (window.localStream) {
          window.localStream.getTracks().forEach((t) => t.stop());
          window.localStream = null;
        }
        if (localVideoref.current) {
          localVideoref.current.srcObject = null;
        }
      } catch (e) {
        console.error("Error stopping tracks:", e);
      }
    }
  };

  const getDisplayMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      getDisplayMediaSuccess(stream);
    } catch (e) {
      console.error("getDisplayMedia error:", e);
      // Cancelled or failed — revert toggle without re-triggering effect
      setScreen(false);
    }
  };

  // Restores camera/mic after screen sharing stops
  const switchBackToCamera = async () => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((t) => t.stop());
        window.localStream = null;
      }
      if (localVideoref.current) {
        localVideoref.current.srcObject = null;
      }

      if ((video && videoAvailable) || (audio && audioAvailable)) {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: video && videoAvailable,
          audio: audio && audioAvailable,
        });
        window.localStream = camStream;
        if (localVideoref.current) {
          localVideoref.current.srcObject = camStream;
        }
        // Properly replace tracks so other peers get camera back
        replaceTracksInConnections(camStream);
      }
    } catch (e) {
      console.error("switchBackToCamera error:", e);
    }
  };

  const getUserMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {
      console.error("Error stopping previous tracks:", e);
    }

    window.localStream = stream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream;
    }

    if (Object.keys(connections).length > 0) {
      replaceTracksInConnections(stream);
    }
  };

  const getDisplayMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {
      console.error("Error stopping previous tracks:", e);
    }

    window.localStream = stream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream;
    }

    if (Object.keys(connections).length > 0) {
      replaceTracksInConnections(stream);
    }

    // When browser/OS "Stop sharing" button is pressed, sync React state
    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        setScreen(false); // triggers switchBackToCamera via useEffect
        if (socketRef.current) {
          socketRef.current.emit("screen-toggle", false);
        }
      };
    });
  };

  const createPeerConnection = (fromId) => {
    connections[fromId] = new RTCPeerConnection(peerConfigConnections);

    connections[fromId].onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state for ${fromId}:`, connections[fromId].connectionState);
    };

    connections[fromId].oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state for ${fromId}:`, connections[fromId].iceConnectionState);
    };

    connections[fromId].onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit(
          "signal",
          fromId,
          JSON.stringify({ ice: event.candidate })
        );
      }
    };

    connections[fromId].onaddstream = (event) => {
      console.log(`[WebRTC] Stream added from ${fromId}`);
      const videoExists = videoRef.current.find(
        (video) => video.socketId === fromId
      );

      if (videoExists) {
        setVideos((videos) =>
          videos.map((video) =>
            video.socketId === fromId
              ? { ...video, stream: event.stream }
              : video
          )
        );
      } else {
        const newVideo = {
          socketId: fromId,
          stream: event.stream,
          autoplay: true,
          playsinline: true,
        };
        setVideos((videos) => {
          const updatedVideos = [...videos, newVideo];
          videoRef.current = updatedVideos;
          return updatedVideos;
        });
      }
    };

    if (window.localStream) {
      connections[fromId].addStream(window.localStream);
    } else {
      window.localStream = new MediaStream([black(), silence()]);
      connections[fromId].addStream(window.localStream);
    }
  };

  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);

    if (fromId !== socketIdRef.current) {
      // Dynamic on-demand connection setup to prevent race conditions
      if (!connections[fromId]) {
        createPeerConnection(fromId);
      }

      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            // Process any queued ICE candidates for this peer
            const queue = iceCandidatesQueue.current[fromId] || [];
            queue.forEach((cand) => {
              connections[fromId]
                .addIceCandidate(new RTCIceCandidate(cand))
                .catch((e) => console.error("Error adding queued ICE candidate:", e));
            });
            iceCandidatesQueue.current[fromId] = [];

            if (signal.sdp.type === "offer") {
              connections[fromId]
                .createAnswer()
                .then((description) => {
                  connections[fromId]
                    .setLocalDescription(description)
                    .then(() => {
                      socketRef.current.emit(
                        "signal",
                        fromId,
                        JSON.stringify({ sdp: connections[fromId].localDescription })
                      );
                    })
                    .catch((e) => console.error("Error setting answer:", e));
                })
                .catch((e) => console.error("Error creating answer:", e));
            }
          })
          .catch((e) => console.error("Error setting remote description:", e));
      }

      if (signal.ice) {
        const pc = connections[fromId];
        // If the connection is ready with remote description, add the candidate directly
        if (pc && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(signal.ice))
            .catch((e) => console.error("Error adding ICE candidate:", e));
        } else {
          // Otherwise, queue it until setRemoteDescription completes
          if (!iceCandidatesQueue.current[fromId]) {
            iceCandidatesQueue.current[fromId] = [];
          }
          iceCandidatesQueue.current[fromId].push(signal.ice);
        }
      }
    }
  };

  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: true });

    socketRef.current.on("signal", gotMessageFromServer);

    socketRef.current.on("connect", () => {
      socketRef.current.emit("join-call", window.location.href);
      socketIdRef.current = socketRef.current.id;

      socketRef.current.on("chat-message", addMessage);

      socketRef.current.on("user-left", (id) => {
        setVideos((videos) => videos.filter((video) => video.socketId !== id));
        if (connections[id]) {
          try { connections[id].close(); } catch (_) {}
          delete connections[id];
        }
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          if (socketListId === socketIdRef.current) return;
          if (connections[socketListId]) return;

          createPeerConnection(socketListId);
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            connections[id2]
              .createOffer()
              .then((description) => {
                connections[id2]
                  .setLocalDescription(description)
                  .then(() => {
                    socketRef.current.emit(
                      "signal",
                      id2,
                      JSON.stringify({ sdp: connections[id2].localDescription })
                    );
                  })
                  .catch((e) => console.error("Error setting offer:", e));
              })
              .catch((e) => console.error("Error creating offer:", e));
          }
        }
      });
    });
  };

  const silence = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), { width, height });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    const stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  // ── Controls ─────────────────────────────────────────────────
  const handleVideo = () => {
    if (!videoAvailable) {
      alert("Camera is not available or permission was denied.");
      return;
    }
    setVideo((v) => !v);
  };

  const handleAudio = () => {
    if (!audioAvailable) {
      alert("Microphone is not available or permission was denied.");
      return;
    }
    setAudio((a) => !a);
  };

  const handleScreen = () => {
    if (!screenAvailable) {
      alert("Screen sharing is not supported in this browser.");
      return;
    }
    const next = !screen;
    setScreen(next);
    // Notify peers immediately so their UI can show "sharing" badge
    if (socketRef.current) {
      socketRef.current.emit("screen-toggle", next);
    }
  };

  const handleEndCall = () => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((t) => t.stop());
        window.localStream = null;
      }
      if (localVideoref.current) {
        localVideoref.current.srcObject = null;
      }
      for (const id in connections) {
        try { connections[id].close(); } catch (_) {}
        delete connections[id];
      }
    } catch (e) {
      console.error("Error ending call:", e);
    }
    if (localStorage.getItem("token")) {
      window.location.href = "/home";
    } else {
      window.location.href = "/";
    }
  };

  const openChat = () => {
    setModal((prev) => !prev);
    if (newMessages > 0) setNewMessages(0);
  };

  const handleMessage = (e) => setMessage(e.target.value);

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prev) => [...prev, { sender, data }]);
    if (socketIdSender !== socketIdRef.current) {
      setNewMessages((prev) => prev + 1);
    }
  };

  const sendMessage = () => {
    if (message.trim()) {
      socketRef.current.emit("chat-message", message, username);
      setMessage("");
    }
  };

  const connect = () => {
    if (!username.trim()) {
      alert("Please enter a username.");
      return;
    }
    setAskForUsername(false);
    connectToSocketServer();
  };

  // ── Fullscreen helpers ────────────────────────────────────────
  const openFullscreen = (stream, label = "Participant", isScreen = false) => {
    setFullscreenVideo({ stream, label, isScreen });
  };

  const closeFullscreen = useCallback(() => {
    setFullscreenVideo(null);
  }, []);

  // Assign localStream to localVideoref when lobby is closed
  useEffect(() => {
    if (!askForUsername && localVideoref.current && window.localStream) {
      localVideoref.current.srcObject = window.localStream;
      localVideoref.current.play().catch((err) => console.warn("Local video play interrupted:", err));
    }
  }, [askForUsername]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") closeFullscreen(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeFullscreen]);

  // ── KEY FIX: callback ref that assigns srcObject the instant the
  //    fullscreen <video> mounts. Avoids the blank-video bug caused by
  //    useEffect running after the browser paint cycle.
  const fullscreenVideoCallbackRef = useCallback(
    (node) => {
      if (node && fullscreenVideo?.stream) {
        node.srcObject = fullscreenVideo.stream;
        node.play().catch(() => {});
      }
    },
    [fullscreenVideo]
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      {askForUsername ? (
        <div className={styles.lobbyContainer}>
          <div className={styles.lobbyCard}>
            <h2>⚡ Join Meeting</h2>
            <video ref={localVideoref} autoPlay muted />
            {localStorage.getItem("token") ? (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBlock: "6px" }}>
                Joining as: <strong style={{ color: "var(--text-primary)" }}>{username}</strong>
              </p>
            ) : (
              <input
                id="lobby-username"
                className={styles.lobbyInput}
                placeholder="Enter your name…"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && connect()}
              />
            )}
            <button className={styles.lobbyConnectBtn} onClick={connect}>
              Join Call →
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {/* ── Chat panel ── */}
          {showModal && (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <h1>💬 Chat</h1>
                <div className={styles.chattingDisplay}>
                  {messages.length ? (
                    messages.map((item, index) => (
                      <div key={index}>
                        <p>{item.sender}</p>
                        <p>{item.data}</p>
                      </div>
                    ))
                  ) : (
                    <p className={styles.chatNoMsg}>No messages yet…</p>
                  )}
                </div>
                <div className={styles.chattingArea}>
                  <input
                    value={message}
                    onChange={handleMessage}
                    id="chat-input"
                    placeholder="Type a message…"
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <button className={styles.chatSendBtn} onClick={sendMessage}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Control buttons ── */}
          <div className={styles.buttonContainers}>
            <IconButton onClick={handleVideo} style={{ color: "white" }}>
              {video ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={handleAudio} style={{ color: "white" }}>
              {audio ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
            {screenAvailable && (
              <IconButton
                onClick={handleScreen}
                style={{ color: screen ? "#63b3ed" : "white" }}
                title={screen ? "Stop screen sharing" : "Share screen"}
              >
                {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            )}
            <Badge badgeContent={newMessages} max={999} color="error">
              <IconButton onClick={openChat} style={{ color: "white" }}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>

          {/* ── Local (self) video ── */}
          <div className={styles.localVideoWrapper}>
            <video
              className={styles.meetUserVideo}
              ref={localVideoref}
              autoPlay
              muted
            ></video>
            <button
              className={styles.localExpandBtn}
              title="View fullscreen"
              onClick={() =>
                openFullscreen(
                  window.localStream,
                  screen ? "Your Screen Share" : "You",
                  screen
                )
              }
            >
              <FullscreenIcon style={{ fontSize: "1.1rem" }} />
            </button>
          </div>

          {/* ── Remote videos grid ── */}
          <div className={styles.conferenceView}>
            {videos.map((vid) => (
              <div key={vid.socketId} className={styles.videoWrapper}>
                <video
                  data-socket={vid.socketId}
                  ref={(ref) => {
                    if (ref && vid.stream) {
                      ref.srcObject = vid.stream;
                      ref.play().catch((err) => console.warn("Video play interrupted:", err));
                    }
                  }}
                  autoPlay
                  playsInline
                ></video>
                <button
                  className={styles.expandBtn}
                  title="View fullscreen"
                  onClick={() => openFullscreen(vid.stream, "Participant", false)}
                >
                  <FullscreenIcon style={{ fontSize: "1.2rem" }} />
                </button>
              </div>
            ))}
          </div>

          {/* ── Fullscreen overlay ── */}
          {fullscreenVideo && (
            <div
              className={styles.fullscreenOverlay}
              onClick={(e) => {
                if (e.target === e.currentTarget) closeFullscreen();
              }}
            >
              <div className={styles.fullscreenVideoContainer}>
                {/* Top gradient bar */}
                <div className={styles.fullscreenTopBar}>
                  <span className={styles.fullscreenLabel}>
                    {fullscreenVideo.isScreen ? (
                      <>
                        <ScreenShareIcon />
                        <span className={styles.screenShareBadge}>
                          Screen Share
                        </span>
                      </>
                    ) : (
                      <>
                        <PersonIcon />
                        {fullscreenVideo.label}
                      </>
                    )}
                  </span>
                  <button
                    className={styles.closeFullscreenBtn}
                    onClick={closeFullscreen}
                    title="Exit fullscreen (Esc)"
                  >
                    <CloseIcon style={{ fontSize: "1.3rem" }} />
                  </button>
                </div>

                {/* Fullscreen video — callback ref fires on mount */}
                <video
                  className={styles.fullscreenVideo}
                  ref={fullscreenVideoCallbackRef}
                  autoPlay
                  playsInline
                  muted={
                    fullscreenVideo.label === "You" ||
                    fullscreenVideo.label === "Your Screen Share"
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
