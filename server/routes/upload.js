const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        // Unique filename: audio-TIMESTAMP-RANDOM.webm
        cb(null, `audio-${Date.now()}-${Math.round(Math.random() * 1E9)}.webm`);
    },
});

const upload = multer({ storage });

// Upload Endpoint
router.post("/", upload.single("audio"), (req, res) => {
    try {
        // Return the file URL that the frontend can use
        const fileUrl = `http://localhost:5000/uploads/${req.file.filename}`;
        res.status(200).json({ fileUrl });
    } catch (err) {
        res.status(500).json(err);
    }
});

module.exports = router;