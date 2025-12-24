import DOMPurify from 'dompurify';

/**
 * Sanitize user input to prevent XSS attacks
 * @param {string} text - The text to sanitize
 * @returns {string} - Sanitized text
 */
export const sanitizeText = (text) => {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    // Configure DOMPurify to strip all HTML tags
    return DOMPurify.sanitize(text, { 
        ALLOWED_TAGS: [], // No HTML tags allowed
        ALLOWED_ATTR: [] // No attributes allowed
    });
};

/**
 * Escape HTML special characters
 * @param {string} text - The text to escape
 * @returns {string} - Escaped text
 */
export const escapeHtml = (text) => {
    if (!text || typeof text !== 'string') {
        return '';
    }
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
    };
    
    return text.replace(/[&<>"'/]/g, (char) => map[char]);
};

/**
 * Validate and sanitize username
 * @param {string} username - The username to validate
 * @returns {string} - Sanitized username
 */
export const sanitizeUsername = (username) => {
    if (!username || typeof username !== 'string') {
        return '';
    }
    
    // Only allow alphanumeric, underscore, and hyphen
    return username.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30);
};

/**
 * Validate URL to prevent open redirect vulnerabilities
 * @param {string} url - The URL to validate
 * @param {string} baseUrl - The base URL to check against
 * @returns {boolean} - Whether the URL is safe
 */
export const isUrlSafe = (url, baseUrl) => {
    if (!url || typeof url !== 'string') {
        return false;
    }
    
    try {
        const urlObj = new URL(url);
        const baseUrlObj = new URL(baseUrl);
        
        // Check if URL is from the same origin
        return urlObj.origin === baseUrlObj.origin;
    } catch (e) {
        return false;
    }
};
