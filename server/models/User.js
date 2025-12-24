const mongoose = require("mongoose");

const generateCustomId = () => {
    const idLength = parseInt(process.env.USER_ID_LENGTH) || 12;

    // Validate idLength
    if (idLength < 8 || idLength > 20) {
        throw new Error("USER_ID_LENGTH must be between 8 and 20");
    }

    let customId = "";

    for (let i = 0; i < idLength; i++) {
        customId = customId.concat(Math.floor(Math.random() * 10).toString());
    }

    return customId;
};

const UserSchema = new mongoose.Schema({
    customId: {
        type: String,
        default: generateCustomId,
        unique: true,
        required: true,
        index: true,
        validate: {
            validator: function(v) {
                return /^[0-9]+$/.test(v);
            },
            message: 'Custom ID must contain only numbers'
        }
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30,
        validate: {
            validator: function(v) {
                return /^[a-zA-Z0-9_-]+$/.test(v);
            },
            message: 'Username can only contain letters, numbers, underscores and hyphens'
        }
    },
    passphrase: {
        type: String,
        required: true,
        select: false // Don't return passphrase by default
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    },
    publicKey: { 
        type: String, 
        required: true 
    },
}, { timestamps: true });

// Index for faster queries
UserSchema.index({ customId: 1 });
UserSchema.index({ username: 1 });

module.exports = mongoose.model("User", UserSchema);