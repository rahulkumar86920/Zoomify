import { Server } from "socket.io"

let connections = {}
let messages = {}
let timeOnline = {}

export const connectToSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log(`[Socket] Connected: ${socket.id}`);

        // ── Join a call room ──────────────────────────────────────
        socket.on("join-call", (path) => {
            if (!connections[path]) {
                connections[path] = [];
            }

            connections[path].push(socket.id);
            timeOnline[socket.id] = new Date();

            console.log(`[Socket] ${socket.id} joined room: ${path} (${connections[path].length} members)`);

            // Notify everyone in the room (including the new joiner) about the updated list
            connections[path].forEach(elem => {
                io.to(elem).emit("user-joined", socket.id, connections[path]);
            });

            // Replay chat history for the new joiner
            if (messages[path]) {
                messages[path].forEach(msg => {
                    io.to(socket.id).emit(
                        "chat-message",
                        msg.data,
                        msg.sender,
                        msg["socket-id-sender"]
                    );
                });
            }
        });

        // ── WebRTC signalling relay ───────────────────────────────
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        // ── Screen share toggle notification ─────────────────────
        // Broadcast to all peers in the room so they can update UI
        socket.on("screen-toggle", (isSharing) => {
            const room = findRoom(socket.id);
            if (!room) return;

            connections[room].forEach(elem => {
                if (elem !== socket.id) {
                    io.to(elem).emit("peer-screen-toggle", socket.id, isSharing);
                }
            });
        });

        // ── Chat messages ─────────────────────────────────────────
        socket.on("chat-message", (data, sender) => {
            const room = findRoom(socket.id);
            if (!room) return;

            if (!messages[room]) messages[room] = [];
            messages[room].push({
                sender,
                data,
                "socket-id-sender": socket.id
            });

            console.log(`[Chat] ${room} | ${sender}: ${data}`);

            connections[room].forEach(elem => {
                io.to(elem).emit("chat-message", data, sender, socket.id);
            });
        });

        // ── Disconnect ────────────────────────────────────────────
        socket.on("disconnect", () => {
            const elapsed = Math.abs(timeOnline[socket.id] - new Date());
            console.log(`[Socket] Disconnected: ${socket.id} (was online ${Math.round(elapsed / 1000)}s)`);
            delete timeOnline[socket.id];

            const room = findRoom(socket.id);
            if (!room) return;

            // Notify all remaining peers
            connections[room].forEach(elem => {
                io.to(elem).emit("user-left", socket.id);
            });

            // Remove from room
            connections[room] = connections[room].filter(id => id !== socket.id);

            // Clean up empty rooms to prevent memory leaks
            if (connections[room].length === 0) {
                delete connections[room];
                delete messages[room];
                console.log(`[Socket] Room cleaned up: ${room}`);
            }
        });
    });

    return io;
};

// ── Helper: find which room a socket belongs to ───────────────
function findRoom(socketId) {
    for (const [room, members] of Object.entries(connections)) {
        if (members.includes(socketId)) return room;
    }
    return null;
}


