const mongoose = require("mongoose");

const generateCustomId = () => {
    const idLength = process.env.USER_ID_LENGTH || 12;

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
        index: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    passphrase: { // Simple secret for auth as requested
        type: String,
        required: true
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);