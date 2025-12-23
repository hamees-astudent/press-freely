const router = require("express").Router();
const User = require("../models/User");
const crypto = require("crypto");

// Helper function: Hash string to SHA-256 Hex
const hashPassphrase = (input) => {
    return crypto.createHash("sha256").update(input).digest("hex");
};

// LOGIN / REGISTER Route
router.post("/login", async (req, res) => {
    try {
        const { username, passphrase } = req.body;

        // Hash the incoming passphrase immediately
        const hashedPass = hashPassphrase(passphrase);

        // Check if user already exists
        const user = await User.findOne({ username });

        if (user) {
            // --- LOGIN LOGIC ---
            // Compare the HASHED input with the HASHED stored password
            if (user.passphrase !== hashedPass) {
                return res.status(400).json({ message: "Incorrect passphrase!" });
            }

            return res.status(200).json(user);

        } else {
            // --- REGISTER LOGIC ---
            // Create new user with the HASHED passphrase
            const newUser = new User({
                username,
                passphrase: hashedPass, // Store the hash, not the plain text
            });

            const savedUser = await newUser.save();
            return res.status(200).json(savedUser);
        }

    } catch (err) {
        console.error(err);
        res.status(500).json(err);
    }
});

module.exports = router;