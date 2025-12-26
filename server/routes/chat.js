const router = require("express").Router();
const User = require("../models/User");
const Message = require("../models/Message");
const { param, query, validationResult } = require("express-validator");
const authMiddleware = require("../middleware/auth");

// Apply authentication to all chat routes
router.use(authMiddleware);

// Validation for customId
const validateCustomId = param('customId')
    .trim()
    .isLength({ min: 10, max: 20 })
    .matches(/^[0-9]+$/)
    .withMessage('Invalid user ID format');

// Validation for query parameters
const validateMessageQuery = [
    query('user1')
        .trim()
        .notEmpty()
        .withMessage('user1 is required')
        .matches(/^[0-9]+$/)
        .withMessage('Invalid user1 ID format'),
    query('user2')
        .trim()
        .notEmpty()
        .withMessage('user2 is required')
        .matches(/^[0-9]+$/)
        .withMessage('Invalid user2 ID format')
];

// Search for a specific user by ID
router.get("/user/:customId", validateCustomId, async (req, res) => {
    try {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }

        const user = await User.findOne({ customId: req.params.customId }, "customId username isOnline");
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.status(200).json(user);
    } catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).json({ message: "Error fetching user" });
    }
});

// Get Chat History between two users
router.get("/messages", validateMessageQuery, async (req, res) => {
    try {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }

        const { user1, user2 } = req.query;

        // Security check: ensure authenticated user is one of the participants
        if (req.user.customId !== user1 && req.user.customId !== user2) {
            return res.status(403).json({ 
                message: "You can only access your own messages" 
            });
        }

        // Find messages where sender is user1 AND receiver is user2
        // OR sender is user2 AND receiver is user1
        const messages = await Message.find({
            $or: [
                { senderId: user1, receiverId: user2 },
                { senderId: user2, receiverId: user1 },
            ],
        })
        .sort({ createdAt: 1 }) // Sort by time (oldest first)
        .limit(1000); // Limit to prevent excessive data transfer

        res.status(200).json(messages);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).json({ message: "Error fetching messages" });
    }
});

// Update message content (for re-encryption)
router.put("/messages/:messageId", async (req, res) => {
    try {
        const { messageId } = req.params;
        const { text } = req.body;

        if (!text || typeof text !== 'string') {
            return res.status(400).json({ message: "Invalid text content" });
        }

        const message = await Message.findById(messageId);
        
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Security check: ensure authenticated user is sender or receiver
        if (req.user.customId !== message.senderId && req.user.customId !== message.receiverId) {
            return res.status(403).json({ 
                message: "You can only update your own messages" 
            });
        }

        message.text = text;
        await message.save();

        res.status(200).json({ message: "Message updated successfully" });
    } catch (err) {
        console.error("Error updating message:", err);
        res.status(500).json({ message: "Error updating message" });
    }
});

module.exports = router;