const router = require("express").Router();
const User = require("../models/User");
const Message = require("../models/Message");

// [CHANGED] Search for a specific user by ID
router.get("/user/:customId", async (req, res) => {
    try {
        const user = await User.findOne({ customId: req.params.customId }, "customId username isOnline publicKey");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(user);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 2. Get Chat History between two users
router.get("/messages", async (req, res) => {
    try {
        const { user1, user2 } = req.query;

        // Find messages where sender is user1 AND receiver is user2
        // OR sender is user2 AND receiver is user1
        const messages = await Message.find({
            $or: [
                { senderId: user1, receiverId: user2 },
                { senderId: user2, receiverId: user1 },
            ],
        }).sort({ createdAt: 1 }); // Sort by time (oldest first)

        res.status(200).json(messages);
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = router;