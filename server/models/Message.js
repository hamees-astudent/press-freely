const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    senderId: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v) {
                return /^[0-9]+$/.test(v);
            },
            message: 'Sender ID must contain only numbers'
        }
    },
    receiverId: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v) {
                return /^[0-9]+$/.test(v);
            },
            message: 'Receiver ID must contain only numbers'
        }
    },
    text: { 
        type: String,
        maxlength: 10000 // Limit message size
    },
    type: {
        type: String,
        enum: ["text", "audio"],
        default: "text"
    },
    fileUrl: { 
        type: String,
        validate: {
            validator: function(v) {
                if (!v) return true;
                // Validate URL format if fileUrl is provided
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Invalid file URL format'
        }
    },
    isRead: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

// Indexes for faster queries
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ receiverId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);