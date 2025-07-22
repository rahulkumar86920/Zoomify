import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { Badge, IconButton, TextField, Button } from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import ChatIcon from "@mui/icons-material/Chat";
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
  const [username, setUsername] = useState("");
  const [videos, setVideos] = useState([]);

  const connections = useRef({}).current;

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert(
        "Your browser does not support WebRTC. Please use a compatible browser like Chrome, Firefox, or Edge."
      );
      setVideoAvailable(false);
      setAudioAvailable(false);
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

        console.log("Video permission granted:", videoTracks.length > 0);
        console.log("Audio permission granted:", audioTracks.length > 0);

        window.localStream = userMediaStream;
        if (localVideoref.current) {
          localVideoref.current.srcObject = userMediaStream;
        }
      } else {
        setVideoAvailable(false);
        setAudioAvailable(false);
        alert(
          "Unable to access camera or microphone. Please check permissions."
        );
      }

      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setVideoAvailable(false);
      setAudioAvailable(false);
      alert(
        "Failed to access camera or microphone. Please ensure they are available and permissions are granted."
      );
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [video, audio]);

  useEffect(() => {
    if (screen !== undefined && screenAvailable) {
      getDisplayMedia();
    }
  }, [screen]);

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
        alert(
          "Failed to access camera or microphone. Please check permissions or device availability."
        );
      }
    } else {
      try {
        if (window.localStream) {
          window.localStream.getTracks().forEach((track) => track.stop());
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
    if (screen && screenAvailable) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        getDisplayMediaSuccess(stream);
      } catch (e) {
        console.error("getDisplayMedia error:", e);
        setScreen(false);
        alert("Failed to start screen sharing. Please try again.");
      }
    }
  };

  const getUserMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {
      console.error("Error stopping previous tracks:", e);
    }

    window.localStream = stream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream;
      console.log(
        "Local video stream assigned:",
        stream.getVideoTracks().length > 0
      );
    }

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id]
        .createOffer()
        .then((description) => {
          connections[id]
            .setLocalDescription(description)
            .then(() => {
              socketRef.current.emit(
                "signal",
                id,
                JSON.stringify({ sdp: connections[id].localDescription })
              );
            })
            .catch((e) => console.error("Error setting offer:", e));
        })
        .catch((e) => console.error("Error creating offer:", e));
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false);
        setAudio(false);
        try {
          let tracks = localVideoref.current?.srcObject?.getTracks() || [];
          tracks.forEach((track) => track.stop());
          localVideoref.current.srcObject = null;
        } catch (e) {
          console.error("Error stopping tracks on end:", e);
        }
        window.localStream = new MediaStream([black(), silence()]);
        localVideoref.current.srcObject = window.localStream;

        for (let id in connections) {
          connections[id].addStream(window.localStream);
          connections[id]
            .createOffer()
            .then((description) => {
              connections[id]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit(
                    "signal",
                    id,
                    JSON.stringify({ sdp: connections[id].localDescription })
                  );
                })
                .catch((e) => console.error("Error setting offer:", e));
            })
            .catch((e) => console.error("Error creating offer:", e));
        }
      };
    });
  };

  const getDisplayMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {
      console.error("Error stopping previous tracks:", e);
    }

    window.localStream = stream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream;
    }

    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      connections[id].addStream(window.localStream);
      connections[id]
        .createOffer()
        .then((description) => {
          connections[id]
            .setLocalDescription(description)
            .then(() => {
              socketRef.current.emit(
                "signal",
                id,
                JSON.stringify({ sdp: connections[id].localDescription })
              );
            })
            .catch((e) => console.error("Error setting offer:", e));
        })
        .catch((e) => console.error("Error creating offer:", e));
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setScreen(false);
        try {
          let tracks = localVideoref.current?.srcObject?.getTracks() || [];
          tracks.forEach((track) => track.stop());
          localVideoref.current.srcObject = null;
        } catch (e) {
          console.error("Error stopping tracks on end:", e);
        }
        getUserMedia();
      };
    });
  };

  const gotMessageFromServer = (fromId, message) => {
    const signal = JSON.parse(message);

    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        connections[fromId]
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
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
                        JSON.stringify({
                          sdp: connections[fromId].localDescription,
                        })
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
        connections[fromId]
          .addIceCandidate(new RTCIceCandidate(signal.ice))
          .catch((e) => console.error("Error adding ICE candidate:", e));
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
      });

      socketRef.current.on("user-joined", (id, clients) => {
        clients.forEach((socketListId) => {
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnections
          );
          connections[socketListId].onicecandidate = (event) => {
            if (event.candidate) {
              socketRef.current.emit(
                "signal",
                socketListId,
                JSON.stringify({ ice: event.candidate })
              );
            }
          };

          connections[socketListId].onaddstream = (event) => {
            const videoExists = videoRef.current.find(
              (video) => video.socketId === socketListId
            );

            if (videoExists) {
              setVideos((videos) =>
                videos.map((video) =>
                  video.socketId === socketListId
                    ? { ...video, stream: event.stream }
                    : video
                )
              );
            } else {
              const newVideo = {
                socketId: socketListId,
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
            connections[socketListId].addStream(window.localStream);
          } else {
            window.localStream = new MediaStream([black(), silence()]);
            connections[socketListId].addStream(window.localStream);
          }
        });

        if (id === socketIdRef.current) {
          for (let id2 in connections) {
            if (id2 === socketIdRef.current) continue;
            try {
              connections[id2].addStream(window.localStream);
            } catch (e) {
              console.error("Error adding stream to connection:", e);
            }
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
    const canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    canvas.getContext("2d").fillRect(0, 0, width, height);
    const stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const handleVideo = () => {
    if (!videoAvailable) {
      alert("Camera is not available or permission was denied.");
      return;
    }
    setVideo(!video);
  };

  const handleAudio = () => {
    if (!audioAvailable) {
      alert("Microphone is not available or permission was denied.");
      return;
    }
    setAudio(!audio);
  };

  const handleScreen = () => {
    if (!screenAvailable) {
      alert("Screen sharing is not supported in this browser.");
      return;
    }
    setScreen(!screen);
  };

  const handleEndCall = () => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
        window.localStream = null;
      }
      if (localVideoref.current) {
        localVideoref.current.srcObject = null;
      }
    } catch (e) {
      console.error("Error ending call:", e);
    }
    window.location.href = "/";
  };

  const openChat = () => {
    setModal(true);
    setNewMessages(0);
  };

  const closeChat = () => {
    setModal(false);
  };

  const handleMessage = (e) => {
    setMessage(e.target.value);
  };

  const addMessage = (data, sender, socketIdSender) => {
    setMessages((prevMessages) => [...prevMessages, { sender, data }]);
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

  return (
    <div>
      {askForUsername ? (
        <div>
          <h2>Enter into Lobby</h2>
          <TextField
            id="outlined-basic"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
          />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>
          <div>
            <video ref={localVideoref} autoPlay muted></video>
          </div>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {showModal && (
            <div className={styles.chatRoom}>
              <div className={styles.chatContainer}>
                <h1>Chat</h1>
                <div className={styles.chattingDisplay}>
                  {messages.length ? (
                    messages.map((item, index) => (
                      <div style={{ marginBottom: "20px" }} key={index}>
                        <p style={{ fontWeight: "bold" }}>{item.sender}</p>
                        <p>{item.data}</p>
                      </div>
                    ))
                  ) : (
                    <p>No Messages Yet</p>
                  )}
                </div>
                <div className={styles.chattingArea}>
                  <TextField
                    value={message}
                    onChange={handleMessage}
                    id="outlined-basic"
                    label="Enter Your Chat"
                    variant="outlined"
                  />
                  <Button variant="contained" onClick={sendMessage}>
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}
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
              <IconButton onClick={handleScreen} style={{ color: "white" }}>
                {screen ? <ScreenShareIcon /> : <StopScreenShareIcon />}
              </IconButton>
            )}
            <Badge badgeContent={newMessages} max={999} color="orange">
              <IconButton onClick={openChat} style={{ color: "white" }}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>
          <video
            className={styles.meetUserVideo}
            ref={localVideoref}
            autoPlay
            muted
          ></video>
          <div className={styles.conferenceView}>
            {videos.map((video) => (
              <div key={video.socketId}>
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                  playsInline
                ></video>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
