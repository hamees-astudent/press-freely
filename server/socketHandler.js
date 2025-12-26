const User = require("./models/User");
const Message = require("./models/Message");
const jwt = require("jsonwebtoken");

// Keep the online users state isolated in this module
let onlineUsers = {};

// Rate limiting for socket events
const eventRateLimits = new Map();
const MAX_EVENTS_PER_SECOND = 10;

const checkRateLimit = (userId, eventType) => {
    const key = `${userId}-${eventType}`;
    const now = Date.now();
    const userLimit = eventRateLimits.get(key) || { count: 0, resetTime: now + 1000 };
    
    if (now > userLimit.resetTime) {
        eventRateLimits.set(key, { count: 1, resetTime: now + 1000 });
        return true;
    }
    
    if (userLimit.count >= MAX_EVENTS_PER_SECOND) {
        return false;
    }
    
    userLimit.count++;
    eventRateLimits.set(key, userLimit);
    return true;
};

module.exports = (io) => {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error: Invalid token"));
      }

      // Validate decoded token structure
      if (!decoded.customId || !decoded.username) {
        return next(new Error("Authentication error: Invalid token payload"));
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

    // Automatically mark as online
    onlineUsers[userId] = socket.id;
    
    try {
      await User.findOneAndUpdate(
        { customId: userId }, 
        { isOnline: true },
        { runValidators: true }
      );
      io.emit("update_user_status", { userId, isOnline: true });
    } catch (err) {
      console.error("Error updating user online status:", err);
    }

    // --- SOCKET EVENTS ---

    socket.on("send_message", async (data) => {
      try {
        // Rate limiting check
        if (!checkRateLimit(userId, 'send_message')) {
          socket.emit("error", { message: "Rate limit exceeded" });
          return;
        }

        // Security Check: Ensure the sender is actually the person connected
        if (!data.senderId || data.senderId !== userId) {
          console.warn(`Unauthorized message attempt from ${userId}`);
          return;
        }

        // Validate message data
        if (!data.receiverId || typeof data.receiverId !== 'string') {
          return;
        }

        // Validate message type
        if (!['text', 'audio'].includes(data.type)) {
          return;
        }

        // Validate content based on type
        if (data.type === 'text' && (!data.text || data.text.length > 10000)) {
          return;
        }

        if (data.type === 'audio' && (!data.fileUrl || !data.fileUrl.startsWith(process.env.SERVER_URL || 'http://localhost:5000'))) {
          return;
        }

        const newMessage = new Message({
          senderId: userId, // Use verified userId
          receiverId: data.receiverId,
          text: data.text || "",
          type: data.type || "text",
          fileUrl: data.fileUrl || null
        });
        
        await newMessage.save();

        const receiverSocketId = onlineUsers[data.receiverId];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", {
            senderId: userId,
            receiverId: data.receiverId,
            text: data.text,
            type: data.type,
            fileUrl: data.fileUrl,
            createdAt: newMessage.createdAt
          });
        }
      } catch (err) {
        console.error("Error sending message:", err);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Typing Indicator
    socket.on("typing", ({ receiverId, isTyping }) => {
      try {
        // Rate limiting check
        if (!checkRateLimit(userId, 'typing')) {
          return;
        }

        if (!receiverId || typeof receiverId !== 'string') {
          return;
        }

        if (typeof isTyping !== 'boolean') {
          return;
        }

        const receiverSocketId = onlineUsers[receiverId];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("display_typing", { 
            userId, 
            isTyping,
            senderId: userId 
          });
        }
      } catch (err) {
        console.error("Error handling typing event:", err);
      }
    });

    // Key Exchange Request
    socket.on("request_key_exchange", ({ targetUserId, publicKey }) => {
      try {
        // Rate limiting check
        if (!checkRateLimit(userId, 'request_key_exchange')) {
          socket.emit("error", { message: "Rate limit exceeded" });
          return;
        }

        if (!targetUserId || typeof targetUserId !== 'string') {
          return;
        }

        if (!publicKey || typeof publicKey !== 'string') {
          return;
        }

        const targetSocketId = onlineUsers[targetUserId];
        if (targetSocketId) {
          io.to(targetSocketId).emit("key_exchange_request", {
            fromUserId: userId,
            publicKey: publicKey
          });
        }
      } catch (err) {
        console.error("Error handling key exchange request:", err);
      }
    });

    // Key Exchange Response
    socket.on("respond_key_exchange", ({ targetUserId, publicKey, accepted }) => {
      try {
        // Rate limiting check
        if (!checkRateLimit(userId, 'respond_key_exchange')) {
          socket.emit("error", { message: "Rate limit exceeded" });
          return;
        }

        if (!targetUserId || typeof targetUserId !== 'string') {
          return;
        }

        if (typeof accepted !== 'boolean') {
          return;
        }

        const targetSocketId = onlineUsers[targetUserId];
        if (targetSocketId) {
          io.to(targetSocketId).emit("key_exchange_response", {
            fromUserId: userId,
            publicKey: publicKey,
            accepted: accepted
          });
        }
      } catch (err) {
        console.error("Error handling key exchange response:", err);
      }
    });

    // Call User
    socket.on("call_user", ({ userToCall, signalData }) => {
      try {
        // Rate limiting check
        if (!checkRateLimit(userId, 'call_user')) {
          socket.emit("error", { message: "Rate limit exceeded" });
          return;
        }

        if (!userToCall || typeof userToCall !== 'string') {
          return;
        }

        if (!signalData) {
          return;
        }

        const receiverSocketId = onlineUsers[userToCall];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("incoming_call", {
            signal: signalData,
            from: userId // Trust the token, not the client payload
          });
        }
      } catch (err) {
        console.error("Error handling call:", err);
      }
    });

    // Answer Call
    socket.on("answer_call", (data) => {
      try {
        if (!data.to || !data.signal) {
          return;
        }

        const callerSocketId = onlineUsers[data.to];
        if (callerSocketId) {
          io.to(callerSocketId).emit("call_accepted", data.signal);
        }
      } catch (err) {
        console.error("Error handling answer call:", err);
      }
    });

    // End Call
    socket.on("end_call", ({ to }) => {
      try {
        if (!to || typeof to !== 'string') {
          return;
        }

        const receiverSocketId = onlineUsers[to];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("call_ended");
        }
      } catch (err) {
        console.error("Error handling end call:", err);
      }
    });

    // ICE Candidate Exchange
    socket.on("ice_candidate", ({ target, candidate }) => {
      try {
        if (!target || !candidate) {
          return;
        }

        const targetSocketId = onlineUsers[target];
        if (targetSocketId) {
          io.to(targetSocketId).emit("receive_ice_candidate", candidate);
        }
      } catch (err) {
        console.error("Error handling ICE candidate:", err);
      }
    });

    // Disconnect
    socket.on("disconnect", async () => {
      try {
        delete onlineUsers[userId];
        await User.findOneAndUpdate(
          { customId: userId }, 
          { isOnline: false, lastSeen: Date.now() }
        );
        io.emit("update_user_status", { userId, isOnline: false });
        console.log(`User Disconnected: ${userId}`);
      } catch (err) {
        console.error("Error handling disconnect:", err);
      }
    });
  });
};