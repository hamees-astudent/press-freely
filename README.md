# Press Freely - Real-Time Chat Application

A modern, real-time chat application built with React and Node.js, featuring instant messaging, online status tracking, and a clean user interface. Users authenticate with a username and passphrase, receive a unique ID, and can search and add contacts to start conversations.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-19.2.3-61dafb.svg)

## ✨ Features

- **Real-Time Messaging** - Instant message delivery using Socket.io
- **User Authentication** - Secure login/registration with SHA-256 hashed passphrases
- **Unique User IDs** - Auto-generated numeric IDs for each user
- **Contact Management** - Search and add users by their unique ID
- **Online Status** - Real-time online/offline status indicators
- **Typing Indicators** - See when the other person is typing
- **Message History** - Persistent chat history stored in MongoDB
- **Responsive Design** - Clean and modern UI with CSS styling
- **Local Storage** - Contact list persisted across sessions

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 19.2.3
- Socket.io Client 4.8.1
- Axios for HTTP requests
- CSS3 for styling

**Backend:**
- Node.js with Express 5.2.1
- Socket.io 4.8.1 for WebSocket connections
- MongoDB with Mongoose 9.0.2
- CORS enabled for cross-origin requests

### Project Structure

```
.
├── client/                  # React frontend
│   ├── public/             # Static files
│   └── src/
│       ├── components/     # React components
│       │   ├── ChatInterface.jsx
│       │   ├── ChatInterface.css
│       │   └── Login.jsx
│       ├── App.js          # Main app component
│       └── index.js        # Entry point
│
└── server/                 # Node.js backend
    ├── models/            # Mongoose schemas
    │   ├── User.js
    │   └── Message.js
    ├── routes/            # API routes
    │   ├── auth.js
    │   └── chat.js
    ├── server.js          # Express server setup
    └── socketHandler.js   # Socket.io event handlers
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/hamees-astudent/press-freely.git
   cd press-freely
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Configure environment variables**
   
   Create a `.env` file in the `server` directory:
   ```env
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/chat-app
   FRONTEND_URL=http://localhost:3000
   USER_ID_LENGTH=12
   ```

### Running the Application

1. **Start MongoDB**
   ```bash
   # If using local MongoDB
   mongod
   ```

2. **Start the backend server**
   ```bash
   cd server
   npm start
   ```
   Server will run on `http://localhost:5000`

3. **Start the frontend client** (in a new terminal)
   ```bash
   cd client
   npm start
   ```
   Client will run on `http://localhost:3000`

## 📖 Usage

### Creating an Account

1. Open the application at `http://localhost:3000`
2. Enter a username and a secret passphrase
3. Click "Login" - if the username doesn't exist, a new account will be created
4. You'll receive a unique numeric ID (e.g., `123456789012`)

### Adding Contacts

1. Share your unique ID with friends
2. Use the "Add Contact" section to search for users by their ID
3. Click the "+" button to add them to your contact list
4. Contacts are saved locally and persist across sessions

### Chatting

1. Click on a contact from your list to open the chat
2. Type your message in the input field
3. Press Enter or click Send to deliver the message
4. Messages are delivered instantly if the recipient is online
5. View online/offline status and typing indicators

## 🔐 Security Features

### Authentication & Authorization
- **JWT Authentication**: Secure token-based authentication with 7-day expiration
- **Password Hashing**: All passphrases are hashed using SHA-256 before storage
- **Socket Authentication**: WebSocket connections require valid JWT tokens
- **Authorization Checks**: Users can only access their own messages
- **No Plain Text Storage**: Passwords are never stored or transmitted in plain text

### Input Validation & Sanitization
- **Express Validator**: Server-side validation for all user inputs
- **DOMPurify**: Client-side XSS protection and HTML sanitization
- **MongoDB Injection Protection**: Query sanitization to prevent NoSQL injection
- **Parameter Pollution Prevention**: HTTP parameter pollution protection (HPP)

### Rate Limiting & DDoS Protection
- **API Rate Limiting**: 100 requests per 15 minutes per IP
- **Auth Rate Limiting**: 5 login attempts per 15 minutes per IP
- **Socket Event Rate Limiting**: 10 events per second per user
- **Message Size Limits**: 10,000 characters max per message
- **File Upload Limits**: 10MB max file size

### Security Headers
- **Helmet Integration**: Comprehensive security headers
- **Content Security Policy (CSP)**: Prevents XSS and injection attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Cross-Origin Resource Policy**: Controls resource sharing
- **Strict CORS Configuration**: Only allows specified origins

### File Upload Security
- **Type Validation**: Only audio and JSON files allowed
- **Size Restrictions**: 10MB maximum file size
- **Secure Filenames**: Cryptographically random filenames
- **Extension Validation**: Validates file extensions

### End-to-End Encryption (E2EE)
- **ECDH Key Exchange**: P-256 curve for key derivation
- **AES-GCM Encryption**: 256-bit encryption for messages
- **Client-Side Encryption**: Messages encrypted before transmission
- **Secure Key Storage**: Private keys never leave the client

### Error Handling & Monitoring
- **Production Error Handling**: Sanitized error messages in production
- **Process-Level Handlers**: Graceful shutdown on critical errors
- **Input Validation Errors**: Detailed validation error responses
- **Audit Logging**: Security events logged for monitoring

### Custom User IDs
- **Auto-generated IDs**: Prevents username enumeration attacks
- **Numeric IDs**: Random 12-digit unique identifiers

---

## 🛡️ Security Documentation

For detailed security information, see:
- **[SECURITY_AUDIT.md](./SECURITY_AUDIT.md)** - Complete security audit and patches applied
- **[SECURITY_GUIDE.md](./SECURITY_GUIDE.md)** - Security configuration and testing guide

### Running Security Audits

```bash
# Check for dependency vulnerabilities
cd server && npm run audit
cd client && npm run audit

# Fix non-breaking vulnerabilities
cd server && npm run audit:fix
cd client && npm run audit:fix
```

### Security Best Practices for Production

1. **Change JWT_SECRET** to a strong, random value (32+ characters)
2. **Enable HTTPS** with valid SSL/TLS certificates
3. **Configure MongoDB Authentication** and restrict network access
4. **Set NODE_ENV=production** to enable production security features
5. **Regular Security Updates** - Keep all dependencies up to date
6. **Implement Logging & Monitoring** for security events
7. **Regular Backups** of database and user data
8. **Penetration Testing** before production deployment
- **CORS Protection**: Configured to accept requests only from specified origins

## 🗄️ Database Schema

### User Model
```javascript
{
  customId: String,      // Auto-generated unique ID
  username: String,      // Unique username
  passphrase: String,    // SHA-256 hashed
  isOnline: Boolean,     // Current online status
  lastSeen: Date,        // Last activity timestamp
  timestamps: true       // createdAt, updatedAt
}
```

### Message Model
```javascript
{
  senderId: String,      // Sender's customId
  receiverId: String,    // Receiver's customId
  text: String,          // Message content
  isRead: Boolean,       // Read status
  timestamps: true       // createdAt, updatedAt
}
```

## 🔌 Socket.io Events

### Client to Server
- `user_connected` - User joins with their ID
- `send_message` - Send a message to another user
- `typing` - Notify typing status
- `disconnect` - User disconnects

### Server to Client
- `receive_message` - Receive incoming message
- `update_user_status` - User online/offline status update
- `display_typing` - Show typing indicator

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/login` - Login or register user

### Chat
- `GET /api/chat/user/:customId` - Search for user by ID
- `GET /api/chat/messages?user1=<id>&user2=<id>` - Get chat history

## 🧪 Development

### Available Scripts

**Server:**
```bash
npm start          # Start with nodemon (auto-restart)
npm test           # Run tests
```

**Client:**
```bash
npm start          # Start development server
npm build          # Build for production
npm test           # Run tests
npm eject          # Eject from Create React App
```

## 📝 Future Enhancements

- [ ] Group chat functionality
- [ ] File and image sharing (photos, documents)
- [ ] Push notifications
- [ ] Message deletion and editing
- [ ] User profiles with avatars
- [ ] Dark mode theme
- [ ] Mobile responsive improvements
- [ ] Read receipts
- [ ] Message search functionality
- [ ] Emoji reactions

## 🐛 Troubleshooting

### Common Issues

#### "Cannot set property query" error at login
**Issue:** Express 5.x made `req.query` read-only, causing compatibility issues with `express-mongo-sanitize`.

**Solution:** Already fixed! The `express-mongo-sanitize` is configured with `replaceWith: '_'` option in `server/server.js` for Express 5.x compatibility.

#### Port already in use
**Issue:** Another process is using port 5000 or 3000.

**Solution:**
```bash
# Find and kill the process using the port
lsof -ti:5000 | xargs kill -9  # For server
lsof -ti:3000 | xargs kill -9  # For client

# Or change the port in .env files
```

#### MongoDB connection failed
**Issue:** MongoDB is not running or connection URI is incorrect.

**Solution:**
```bash
# Start MongoDB
mongod

# Or check your MONGO_URI in server/.env
```

#### CORS errors
**Issue:** Frontend and backend origins don't match.

**Solution:** Ensure `FRONTEND_URL` in `server/.env` matches your client URL (default: http://localhost:3000)

#### JWT token errors
**Issue:** Token expired or JWT_SECRET not set.

**Solution:** 
- Ensure `JWT_SECRET` is set in `server/.env`
- Try logging out and logging back in to get a fresh token

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 👨‍💻 Author

**Hamees** - [GitHub Profile](https://github.com/hamees-astudent)

## 🙏 Acknowledgments

- Built as part of Data Communication and Networking II course
- Socket.io documentation and community
- React and Express.js communities
- MongoDB documentation

---

⭐ **Star this repo** if you find it helpful!

For questions or support, please open an issue on GitHub.
