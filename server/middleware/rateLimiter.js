const rateLimit = require("express-rate-limit");

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false
});

// Authentication rate limiter (stricter)
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60, // 60 login attempts per 1 minute
    message: "Too many login attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false
});

// Upload rate limiter
const uploadLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20, // 20 uploads per minute
    message: "Too many uploads, please try again later.",
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    apiLimiter,
    authLimiter,
    uploadLimiter
};
