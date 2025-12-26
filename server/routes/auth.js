const router = require("express").Router();
const User = require("../models/User");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error("JWT_SECRET must be defined in environment variables");
}

// Helper function: Hash string to SHA-256 Hex
const hashPassphrase = (input) => {
    return crypto.createHash("sha256").update(input).digest("hex");
};

// Validation rules
const loginValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be between 3 and 30 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores and hyphens'),
    body('passphrase')
        .isLength({ min: 8, max: 128 })
        .withMessage('Passphrase must be between 8 and 128 characters')
];

// LOGIN / REGISTER Route
router.post("/login", loginValidation, async (req, res) => {
    try {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                message: 'Validation failed', 
                errors: errors.array() 
            });
        }

        const { username, passphrase } = req.body;

        // Hash the incoming passphrase immediately
        const hashedPass = hashPassphrase(passphrase);

        // Check if user already exists
        let user = await User.findOne({ username }).select('+passphrase');

        if (user) {
            // --- LOGIN LOGIC ---
            // Compare the HASHED input with the HASHED stored password
            if (user.passphrase !== hashedPass) {
                return res.status(400).json({ message: "Incorrect passphrase!" });
            }

        } else {
            // --- REGISTER LOGIC ---
            // Create new user with the HASHED passphrase
            const newUser = new User({
                username,
                passphrase: hashedPass // Store the hash, not the plain text
            });

            user = await newUser.save();
        }

        // --- GENERATE TOKEN ---
        // This token proves identity and cannot be forged
        const token = jwt.sign(
            { customId: user.customId, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        let userData = user.toObject();
        delete userData.passphrase; // Remove passphrase from response

        userData.token = token;
        return res.status(200).json(userData);
    } catch (err) {
        console.error("Auth error:", err);
        
        // Handle duplicate username error
        if (err.code === 11000) {
            return res.status(400).json({ 
                message: "Username already exists" 
            });
        }
        
        res.status(500).json({ 
            message: "An error occurred during authentication" 
        });
    }
});

module.exports = router;