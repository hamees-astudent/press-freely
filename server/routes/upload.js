const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types for security
const ALLOWED_MIME_TYPES = [
    'audio/webm',
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'application/json' // For encrypted files
];

// File filter for validation
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only audio files and encrypted JSON are allowed.'), false);
    }
};

// Configure Storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Secure filename: use crypto random string instead of Math.random
        const randomName = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname) || '.webm';
        cb(null, `audio-${Date.now()}-${randomName}${ext}`);
    },
});

// Configure multer with limits and validation
const upload = multer({ 
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
        files: 1 // Only 1 file per request
    }
});

// Upload Endpoint with error handling
router.post("/", (req, res) => {
    upload.single("audio")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer-specific errors
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
            }
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            // Other errors (like file type validation)
            return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        try {
            // Return the file URL using environment variable
            const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
            const fileUrl = `${serverUrl}/uploads/${req.file.filename}`;
            res.status(200).json({ fileUrl });
        } catch (err) {
            console.error('Upload error:', err);
            res.status(500).json({ message: 'Error processing upload' });
        }
    });
});

module.exports = router;