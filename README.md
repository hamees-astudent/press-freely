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

- **Password Hashing**: All passphrases are hashed using SHA-256 before storage
- **No Plain Text Storage**: Passwords are never stored in plain text
- **Custom User IDs**: Auto-generated IDs prevent username enumeration
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
- [ ] File and image sharing
- [ ] Message encryption (E2E)
- [ ] Push notifications
- [ ] Voice/video calling
- [ ] Message deletion and editing
- [ ] User profiles with avatars
- [ ] Dark mode theme
- [ ] Mobile responsive improvements
- [ ] Read receipts

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
