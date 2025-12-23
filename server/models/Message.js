const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    text: { type: String }, // Optional now, since it might be audio

    // New Fields for Audio
    type: {
        type: String,
        enum: ["text", "audio"],
        default: "text"
    },
    fileUrl: { type: String }, // Path to the audio file

    isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Message", MessageSchema);