const router = require("express").Router();
const User = require("../models/User");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

// Helper function: Hash string to SHA-256 Hex
const hashPassphrase = (input) => {
    return crypto.createHash("sha256").update(input).digest("hex");
};

// LOGIN / REGISTER Route
router.post("/login", async (req, res) => {
    try {
        const { username, passphrase, publicKey } = req.body;

        // Hash the incoming passphrase immediately
        const hashedPass = hashPassphrase(passphrase);

        // Check if user already exists
        let user = await User.findOne({ username });

        // --- GENERATE TOKEN ---
        // This token proves identity and cannot be forged
        const token = jwt.sign(
            { customId: user.customId, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        if (user) {
            // --- LOGIN LOGIC ---
            // Compare the HASHED input with the HASHED stored password
            if (user.passphrase !== hashedPass) {
                return res.status(400).json({ message: "Incorrect passphrase!" });
            }

            user.publicKey = publicKey;
            await user.save();

        } else {
            // --- REGISTER LOGIC ---
            // Create new user with the HASHED passphrase
            const newUser = new User({
                username,
                passphrase: hashedPass, // Store the hash, not the plain text
                publicKey: publicKey
            });

            user = await newUser.save();
        }

        let userData = user.toObject();
        delete userData.passphrase; // Remove passphrase from response

        userData.token = token;
        return res.status(200).json(userData);
    } catch (err) {
        console.error(err);
        res.status(500).json(err);
    }
});

module.exports = router;