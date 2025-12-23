const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    senderId: {
        type: String, // Refers to the customId, not the Mongo _id
        required: true
    },
    receiverId: {
        type: String, // Refers to the customId
        required: true
    },
    text: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true }); // Automatically adds createdAt (timestamp)

module.exports = mongoose.model("Message", MessageSchema);