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
    // Audio
    'audio/webm',
    'audio/wav',
    'audio/mpeg',
    'audio/mp3',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
    // Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Videos
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-rar-compressed',
    'application/json' // For encrypted files
];

// File filter for validation
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Please upload a supported file format.'), false);
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
        const ext = path.extname(file.originalname) || '.dat';
        const prefix = file.mimetype.startsWith('audio/') ? 'audio' : 
                      file.mimetype.startsWith('image/') ? 'image' :
                      file.mimetype.startsWith('video/') ? 'video' : 'file';
        cb(null, `${prefix}-${Date.now()}-${randomName}${ext}`);
    },
});

// Configure multer with limits and validation
const upload = multer({ 
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 1 // Only 1 file per request
    }
});

// Upload Endpoint with error handling
router.post("/", (req, res) => {
    const uploadStartTime = Date.now();
    
    upload.single("file")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer-specific errors
            console.error('Multer error:', err.code, err.message);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ message: 'File too large. Maximum size is 50MB.' });
            }
            return res.status(400).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            // Other errors (like file type validation)
            console.error('Upload validation error:', err.message);
            return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        try {
            const uploadTime = Date.now() - uploadStartTime;
            console.log(`File uploaded successfully: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)}MB in ${uploadTime}ms)`);
            
            // Return the file URL using environment variable
            const serverUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
            const fileUrl = `${serverUrl}/uploads/${req.file.filename}`;
            res.status(200).json({ 
                fileUrl, 
                fileName: req.file.originalname,
                mimeType: req.file.mimetype
            });
        } catch (err) {
            console.error('Upload error:', err);
            res.status(500).json({ message: 'Error processing upload' });
        }
    });
});

module.exports = router;