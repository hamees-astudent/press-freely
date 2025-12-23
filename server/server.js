const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const socketHandler = require("./socketHandler");
require("dotenv").config();

const app = express();
const server = http.createServer(app); // Create HTTP server for Socket.io

// Middleware
app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/chat", require("./routes/chat"));

// Database Connection
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/chat-app", {})
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log(err));

// Socket.io Setup
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, // React frontend URL
        methods: ["GET", "POST"],
    },
});

socketHandler(io); // <--- Pass the 'io' instance to the handler

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});