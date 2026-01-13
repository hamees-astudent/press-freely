# Press Freely (Data Communication & Networking II)

End-to-end encrypted (E2EE) chat application with real-time messaging, encrypted media sharing, and WebRTC voice calls.

- Frontend: React (Create React App)
- Backend: Node.js + Express + Socket.IO
- Database: MongoDB (Mongoose)
- Crypto: WebCrypto (ECDH P-256 + AES-GCM 256)

## Features

- Account creation/login via username + passphrase (server issues JWT)
- Real-time messaging (Socket.IO) with typing indicators and online status
- E2EE text messages (AES-GCM ciphertext stored in MongoDB)
- Encrypted media/files:
  - Client encrypts file bytes, uploads ciphertext JSON
  - Server stores ciphertext in `server/uploads/` and serves it back
- Image compression to WebP **before encryption**
- Voice calls using WebRTC (`simple-peer`) with call-quality monitoring and adaptive bitrate

## Repository structure

- `client/` — React app
- `server/` — Express + Socket.IO API server
- `server/models/` — Mongoose models (`User`, `Message`)
- `server/routes/` — REST routes (`auth`, `chat`, `upload`)
- `server/middleware/` — auth + rate limiting
- `DEPLOYMENT_GUIDE.md` — detailed deployment notes
- `PROJECT_WRITEUP.md` — architecture/protocols/research/performance report

## Quick start (local development)

### 1) Prerequisites

- Node.js 18+
- npm 9+
- MongoDB 6+

### 2) Install dependencies

```bash
# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 3) Configure environment variables

Create `server/.env`:

```bash
PORT=5000
MONGO_URI=mongodb://localhost:27017/press-freely
JWT_SECRET=change-me
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
SERVER_URL=http://localhost:5000
```

Create `client/.env`:

```bash
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=http://localhost:5000
```

Notes:

- The backend code expects `MONGO_URI` (not `MONGODB_URI`).
- Socket.IO authentication uses `JWT_SECRET`.
- If you deploy behind a domain, set `FRONTEND_URL` and `SERVER_URL` appropriately.

### 4) Run the app

In one terminal:

```bash
cd server
npm start
```

In a second terminal:

```bash
cd client
npm start
```

Open: http://localhost:3000

## How messaging and encryption work

### Key exchange

- Each contact pair uses ECDH P-256.
- Public keys are exchanged over Socket.IO events:
  - `request_key_exchange`
  - `respond_key_exchange`
- Keys are stored client-side in browser localStorage (`contactKeys`).

### Message encryption

- A shared AES-GCM (256-bit) key is derived from ECDH.
- Text messages are encrypted into JSON:
  - `{ "iv": [...], "content": [...] }`
- The server stores ciphertext as the message `text` field; it cannot decrypt.

### Encrypted uploads

- Files/audio are encrypted client-side (ArrayBuffer → AES-GCM → JSON).
- Ciphertext JSON is uploaded via `POST /api/upload` as `multipart/form-data`.
- Server saves the ciphertext blob into `server/uploads/` and returns a `fileUrl`.
- Receivers download the ciphertext and decrypt locally.

## Network design and protocols

- REST APIs over HTTP
  - `POST /api/auth/login`
  - `GET /api/chat/user/:customId`
  - `GET /api/chat/messages?user1=...&user2=...`
  - `PUT /api/chat/messages/:messageId` (re-encryption support)
  - `POST /api/upload`
- Real-time events over Socket.IO (WebSocket with fallback)
  - `send_message`, `receive_message`, `typing`, `update_user_status`, key exchange, call signaling
- WebRTC for voice calls
  - STUN: Google STUN servers are configured
  - Note: No TURN server is configured by default (calls may fail on restrictive NATs)

## Security notes (important)

- Use HTTPS/WSS in production so JWTs and metadata are encrypted in transit.
- This implementation provides E2EE for message content, but it does not implement strong identity verification (e.g., safety numbers/QR). A malicious relay could attempt a MITM during key exchange.
- Passphrases are hashed with SHA-256 on the server; for production-grade password storage, use a slow password hash (bcrypt/argon2) and a per-user salt.

## Scripts

### Server (`server/`)

- `npm start` — start dev server with nodemon
- `npm run start:prod` — start production server

### Client (`client/`)

- `npm start` — start React dev server
- `npm run build` — build production bundle
- `npm test` — run CRA tests

## Further documentation

- Deployment guide: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- Full report (architecture/protocols/research/performance): [PROJECT_WRITEUP.md](PROJECT_WRITEUP.md)
