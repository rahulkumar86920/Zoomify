import { Server } from "socket.io"
import { User } from "../models/user.model.js"
import { Conversation } from "../models/conversation.model.js"
import { Message } from "../models/message.model.js"

let connections = {}
let messages = {}
let timeOnline = {}
let socketToCall = {}

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
        console.log("SOMETHING CONNECTED")

        socket.on("join-call", (path) => {
            if (connections[path] === undefined) {
                connections[path] = []
            }
            connections[path].push(socket.id)

            timeOnline[socket.id] = new Date();

            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a]).emit("user-joined", socket.id, connections[path])
            }

            if (messages[path] !== undefined) {
                for (let a = 0; a < messages[path].length; ++a) {
                    io.to(socket.id).emit("chat-message", messages[path][a]['data'],
                        messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
                }
            }
        })

        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        })

        // ── Screen share toggle notification ─────────────────────
        socket.on("screen-toggle", (isSharing) => {
            let room
            for (const [k, v] of Object.entries(connections)) {
                if (v.includes(socket.id)) {
                    room = k
                    break
                }
            }
            if (room && connections[room]) {
                connections[room].forEach(elem => {
                    if (elem !== socket.id) {
                        io.to(elem).emit("peer-screen-toggle", socket.id, isSharing);
                    }
                });
            }
        })

        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections)
                .reduce(([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.includes(socket.id)) {
                        return [roomKey, true];
                    }
                    return [room, isFound];
                }, ['', false]);

            if (found === true) {
                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = []
                }

                messages[matchingRoom].push({ 'sender': sender, "data": data, "socket-id-sender": socket.id })
                console.log("message", matchingRoom, ":", sender, data)

                connections[matchingRoom].forEach((elem) => {
                    io.to(elem).emit("chat-message", data, sender, socket.id)
                })
            }
        })

        // ── Direct Messaging events ──────────────────────────────
        socket.on("join-dm-lobby", async (username) => {
            socket.join(username);
            socket.username = username; // Store on socket object to track on disconnect
            console.log(`[Socket] User ${username} joined their DM lobby`);
            try {
                const user = await User.findOneAndUpdate({ username }, { isOnline: true });
                if (user) {
                    // Mark all messages sent to B (not from B) as delivered
                    const convos = await Conversation.find({ participants: user._id });
                    const convoIds = convos.map(c => c._id);
                    await Message.updateMany(
                        { conversationId: { $in: convoIds }, sender: { $ne: user._id }, delivered: false },
                        { $set: { delivered: true } }
                    );
                    
                    // Notify any conversational partners that user is online
                    io.emit("user-status-change", { username, isOnline: true });
                    
                    // Notify senders that their messages are now delivered
                    convos.forEach(c => {
                        const other = c.participants.find(p => !p.equals(user._id));
                        if (other) {
                            User.findById(other).then(oUser => {
                                if (oUser) {
                                    io.to(oUser.username).emit("messages-delivered", { conversationId: c._id });
                                }
                            });
                        }
                    });
                }
            } catch (e) {
                console.error("Error setting online status:", e);
            }
        })

        socket.on("send-dm", async (payload) => {
            const { senderUsername, recipientUsername, text, conversationId } = payload;
            try {
                const senderUser = await User.findOne({ username: senderUsername });
                const recipientUser = await User.findOne({ username: recipientUsername });

                if (senderUser && recipientUser) {
                    // Check if recipient is online in their lobby room
                    const recipientRooms = io.sockets.adapter.rooms.get(recipientUsername);
                    const isOnline = recipientRooms && recipientRooms.size > 0;

                    // Create new message in database
                    const msg = new Message({
                        conversationId,
                        sender: senderUser._id,
                        text,
                        delivered: isOnline,
                        read: false,
                    });
                    await msg.save();

                    // Update last message in Conversation
                    await Conversation.findByIdAndUpdate(conversationId, {
                        lastMessage: text,
                        lastMessageAt: new Date(),
                    });

                    const populatedMsg = {
                        _id: msg._id,
                        conversationId,
                        text,
                        createdAt: msg.createdAt,
                        delivered: msg.delivered,
                        read: msg.read,
                        sender: {
                            _id: senderUser._id,
                            name: senderUser.name,
                            username: senderUser.username,
                            uniqueId: senderUser.uniqueId,
                        }
                    };

                    // Broadcast to both participants
                    io.to(senderUsername).to(recipientUsername).emit("dm-receive", populatedMsg);
                }
            } catch (e) {
                console.error("Error sending DM over socket:", e);
            }
        })

        socket.on("typing-dm", (payload) => {
            const { senderUsername, recipientUsername, isTyping } = payload;
            io.to(recipientUsername).emit("dm-typing-receive", { senderUsername, isTyping });
        })

        socket.on("read-conversation", async (payload) => {
            const { conversationId, senderUsername } = payload;
            try {
                const user = await User.findOne({ username: senderUsername });
                if (user) {
                    await Message.updateMany(
                        { conversationId, sender: { $ne: user._id } },
                        { $set: { delivered: true, read: true } }
                    );

                    const convo = await Conversation.findById(conversationId).populate("participants", "username");
                    if (convo) {
                        const otherParticipant = convo.participants.find(p => p.username !== senderUsername);
                        if (otherParticipant) {
                            io.to(otherParticipant.username).emit("conversation-read-ack", { conversationId });
                        }
                    }
                    io.to(senderUsername).emit("conversation-read-ack", { conversationId });
                }
            } catch (e) {
                console.error("Error marking messages as read:", e);
            }
        })

        // ── WhatsApp-style Call Invitations ─────────────────────
        socket.on("call-invite", (payload) => {
            const { senderName, senderUsername, recipientUsername, meetingCode, isVideo } = payload;
            console.log(`[Socket] Call invitation from ${senderUsername} to ${recipientUsername}`);
            io.to(recipientUsername).emit("call-invite-receive", {
                senderName,
                senderUsername,
                meetingCode,
                isVideo
            });
        })

        socket.on("register-call", (payload) => {
            const { recipientUsername, meetingCode } = payload;
            socketToCall[socket.id] = { recipientUsername, meetingCode };
            console.log(`[Socket] Registered call invite: code ${meetingCode} to ${recipientUsername}`);
        })

        socket.on("call-cancel", (payload) => {
            const { recipientUsername, meetingCode } = payload;
            io.to(recipientUsername).emit("call-cancelled", { meetingCode });
            console.log(`[Socket] Call cancelled: code ${meetingCode}`);
        })

        socket.on("call-accept", (payload) => {
            const { recipientUsername, senderUsername, meetingCode } = payload;
            io.to(senderUsername).emit("call-accept-receive", { recipientUsername, meetingCode });
        })

        socket.on("call-reject", (payload) => {
            const { recipientUsername, senderUsername } = payload;
            io.to(senderUsername).emit("call-reject-receive", { recipientUsername });
        })

        socket.on("disconnect", async () => {
            // Update user status to offline
            if (socket.username) {
                try {
                    const now = new Date();
                    await User.findOneAndUpdate({ username: socket.username }, { isOnline: false, lastSeen: now });
                    io.emit("user-status-change", { username: socket.username, isOnline: false, lastSeen: now });
                } catch (e) {
                    console.error("Error setting offline status:", e);
                }
            }

            // Immediate cancel if caller disconnected before accept
            if (socketToCall[socket.id]) {
                const { recipientUsername, meetingCode } = socketToCall[socket.id];
                io.to(recipientUsername).emit("call-cancelled", { meetingCode });
                delete socketToCall[socket.id];
            }

            var diffTime = Math.abs(timeOnline[socket.id] - new Date())
            var key

            for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
                for (let a = 0; a < v.length; ++a) {
                    if (v[a] === socket.id) {
                        key = k

                        for (let a = 0; a < connections[key].length; ++a) {
                            io.to(connections[key][a]).emit('user-left', socket.id)
                        }

                        var index = connections[key].indexOf(socket.id)
                        connections[key].splice(index, 1)

                        if (connections[key].length === 0) {
                            delete connections[key]
                        }
                    }
                }
            }
        })
    })

    return io;
}


