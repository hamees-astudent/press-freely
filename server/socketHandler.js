const User = require("./models/User");
const Message = require("./models/Message");
const jwt = require("jsonwebtoken"); //

// Keep the online users state isolated in this module
let onlineUsers = {};

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error: " + err.message));
      }

      // Attach the trusted user ID to the socket object
      socket.user = decoded;
      next(); // Allow connection
    });
  });

  io.on("connection", async (socket) => {
    // We now TRUST socket.user.customId because it came from the token
    const userId = socket.user.customId;

    console.log(`User Verified & Connected: ${userId}`);

    // Automatically mark as online (No need to wait for 'user_connected' event)
    onlineUsers[userId] = socket.id;
    await User.findOneAndUpdate({ customId: userId }, { isOnline: true });
    io.emit("update_user_status", { userId, isOnline: true });

    // --- SOCKET EVENTS ---

    // (We no longer strictly need 'user_connected', but keeping it won't hurt)
    socket.on("user_connected", () => { /* Redundant now, but harmless */ });

    socket.on("send_message", async (data) => {
      // Security Check: Ensure the sender is actually the person connected
      if (data.senderId !== userId) return;

      const newMessage = new Message(data);
      await newMessage.save();

      const receiverSocketId = onlineUsers[data.receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receive_message", data);
      }
    });

    // --- 3. Typing Indicator ---
    socket.on("typing", ({ receiverId, senderId, isTyping }) => {
      const receiverSocketId = onlineUsers[receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("display_typing", { userId, isTyping });
      }
    });

    // Disconnect
    socket.on("disconnect", async () => {
      delete onlineUsers[userId];
      await User.findOneAndUpdate({ customId: userId }, { isOnline: false, lastSeen: Date.now() });
      io.emit("update_user_status", { userId, isOnline: false });
    });

    socket.on("call_user", ({ userToCall, signalData }) => {
      const receiverSocketId = onlineUsers[userToCall];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("incoming_call", {
          signal: signalData,
          from: userId // Trust the token, not the client payload
        });
      }
    });

    // Receiver answers the call
    socket.on("answer_call", (data) => {
      const callerSocketId = onlineUsers[data.to];
      if (callerSocketId) {
        io.to(callerSocketId).emit("call_accepted", data.signal);
      }
    });

    socket.on("end_call", ({ to }) => {
      const receiverSocketId = onlineUsers[to];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call_ended");
      }
    });

    // Exchange Network Candidates (ICE)
    socket.on("ice_candidate", ({ target, candidate }) => {
      const targetSocketId = onlineUsers[target];
      if (targetSocketId) {
        io.to(targetSocketId).emit("receive_ice_candidate", candidate);
      }
    });
  });
};