# Security Configuration Quick Reference

## Environment Variables Required

### Server (.env)
```bash
PORT=5000
MONGO_URI=mongodb://localhost:27017/chat-app
FRONTEND_URL=http://localhost:3000
USER_ID_LENGTH=12
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
SERVER_URL=http://localhost:5000
NODE_ENV=development
```

### Client (.env)
```bash
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
```

## Security Features Enabled

### 1. Rate Limiting
- **General API**: 100 requests per 15 minutes per IP
- **Auth Endpoint**: 5 attempts per 15 minutes per IP
- **Socket Events**: 10 events per second per user

### 2. Input Validation
- Username: 3-30 characters, alphanumeric + underscore/hyphen only
- Passphrase: 8-128 characters minimum
- Message: Max 10,000 characters
- File uploads: Max 10MB, audio and JSON only

### 3. Security Headers (Helmet)
- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- Strict-Transport-Security
- Cross-Origin-Resource-Policy

### 4. Authentication
- JWT tokens with 7-day expiration
- Socket.io authentication required
- Protected routes require Bearer token
- Authorization checks for message access

### 5. Data Protection
- MongoDB injection prevention (express-mongo-sanitize)
- XSS protection (DOMPurify)
- Parameter pollution prevention (HPP)
- Password hashing (SHA-256)
- Passphrase field not returned in queries

### 6. Error Handling
- Production mode hides error details
- Development mode shows full stack traces
- Process-level handlers for unhandled errors
- Graceful shutdown on critical errors

## Testing Security

### Test Rate Limiting
```bash
# Test API rate limit
for i in {1..105}; do curl http://localhost:5000/api/chat/user/123456789012; done

# Test auth rate limit
for i in {1..6}; do curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"username":"test","passphrase":"test"}'; done
```

### Test File Upload Restrictions
```bash
# Should fail - file too large
curl -X POST http://localhost:5000/api/upload -F "audio=@largefile.mp3"

# Should fail - wrong file type
curl -X POST http://localhost:5000/api/upload -F "audio=@malicious.exe"
```

### Test Authentication
```bash
# Should fail - no token
curl http://localhost:5000/api/chat/messages?user1=123&user2=456

# Should succeed - with token
curl http://localhost:5000/api/chat/messages?user1=123&user2=456 -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Input Validation
```bash
# Should fail - invalid username
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"username":"ab","passphrase":"testtest"}'

# Should fail - short passphrase
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"username":"testuser","passphrase":"short"}'
```

## Production Checklist

- [ ] Change JWT_SECRET to a strong random value
- [ ] Set NODE_ENV=production
- [ ] Configure HTTPS/SSL certificates
- [ ] Set up MongoDB authentication
- [ ] Configure proper CORS origins
- [ ] Set up logging and monitoring
- [ ] Configure backup strategy
- [ ] Review and adjust rate limits
- [ ] Set up DDoS protection
- [ ] Regular security updates
- [ ] Code review and security audit
- [ ] Penetration testing
- [ ] Set up intrusion detection

## Security Monitoring

### Key Metrics to Monitor
- Failed authentication attempts
- Rate limit violations
- File upload rejections
- Invalid input attempts
- Error rates
- Unusual traffic patterns

### Log Files to Review
- Application errors
- Authentication events
- Rate limit triggers
- File upload attempts
- Database queries
- Socket connections

## Incident Response

### If Security Breach Detected:
1. Immediately revoke all JWT tokens (change JWT_SECRET)
2. Review logs for breach scope
3. Notify affected users
4. Patch vulnerability
5. Conduct security audit
6. Update passwords/secrets
7. Monitor for continued attacks

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [React Security](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [Socket.io Security](https://socket.io/docs/v4/server-socket-instance/)
