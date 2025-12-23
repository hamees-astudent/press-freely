const User = require("./models/User");
const Message = require("./models/Message");

// Keep the online users state isolated in this module
let onlineUsers = {};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`Socket Connected: ${socket.id}`);

    // --- 1. User Connects ---
    socket.on("user_connected", async (userId) => {
      onlineUsers[userId] = socket.id;

      // Update DB status to Online
      await User.findOneAndUpdate({ customId: userId }, { isOnline: true });

      // Broadcast to everyone
      io.emit("update_user_status", { userId, isOnline: true });
    });

    // --- 2. Send Message ---
    socket.on("send_message", async (data) => {
      const { senderId, receiverId, text } = data;

      // Save message to DB
      const newMessage = new Message(data);
      await newMessage.save();

      // Check if receiver is online
      const receiverSocketId = onlineUsers[receiverId];

      if (receiverSocketId) {
        // Send directly to that specific user
        io.to(receiverSocketId).emit("receive_message", data);
      }
    });

    // --- 3. Typing Indicator ---
    socket.on("typing", ({ receiverId, senderId, isTyping }) => {
      const receiverSocketId = onlineUsers[receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("display_typing", { senderId, isTyping });
      }
    });

    // --- 4. Disconnect ---
    socket.on("disconnect", async () => {
      // Find the userId associated with this socket
      const userId = Object.keys(onlineUsers).find(key => onlineUsers[key] === socket.id);

      if (userId) {
        delete onlineUsers[userId];

        // Update DB
        await User.findOneAndUpdate({ customId: userId }, { isOnline: false, lastSeen: Date.now() });

        // Broadcast offline status
        io.emit("update_user_status", { userId, isOnline: false });
      }
    });

    // Caller starts a call
    socket.on("call_user", ({ userToCall, signalData, fromId }) => {
      const receiverSocketId = onlineUsers[userToCall];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("incoming_call", {
          signal: signalData,
          from: fromId
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