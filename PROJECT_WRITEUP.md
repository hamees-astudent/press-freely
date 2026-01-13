# Press Freely — Project Write‑Up (Jan 14, 2026)

This document describes the implemented system architecture, network design, protocols, research answers, and a lightweight performance analysis for the **Press Freely** end‑to‑end encrypted chat application.

---

## System architecture

### High-level components

- **Client (React / CRA)**
  - Location: `client/`
  - Primary UI: `ChatInterface` (contacts, chat history, media messages, voice calling)
  - Uses **Axios** for REST APIs and **Socket.IO client** for real-time events.
  - Implements **client-side encryption**:
    - Key agreement: ECDH P‑256
    - Message/file encryption: AES‑GCM 256-bit
  - Implements **media capture + pre-processing**:
    - Audio recording via `MediaRecorder` with Opus-preferred MIME types
    - Image compression to WebP using Canvas API prior to encryption
    - WebRTC call quality monitoring and adaptive bitrate

- **Server (Node.js + Express + Socket.IO)**
  - Location: `server/`
  - REST APIs:
    - `/api/auth/*` — login/register
    - `/api/chat/*` — user lookup, chat history, message update (re-encryption support)
    - `/api/upload/*` — encrypted file upload
  - Real-time messaging/calls:
    - Socket.IO for presence, messaging, typing indicator, key exchange signaling, and call signaling
  - Persistence:
    - MongoDB via Mongoose for users and messages
    - Local disk storage for uploaded encrypted blobs (`server/uploads/`)

- **Database (MongoDB)**
  - Users: `customId`, `username`, `passphrase` hash, `isOnline`, `lastSeen`
  - Messages: `senderId`, `receiverId`, `type`, `text` (encrypted JSON for text), optional `fileUrl`

### Core flows

#### 1) Authentication & session

- Client sends username + passphrase to `/api/auth/login`.
- Server:
  - Validates input.
  - Hashes passphrase with SHA‑256 and stores/compares hash.
  - Returns a JWT containing `{ customId, username }`.
- Client stores the returned user object in localStorage and sets `Authorization: Bearer <token>` for subsequent API requests.

#### 2) Contact discovery and chat history

- Client can fetch a user by `customId` via `/api/chat/user/:customId`.
- For a selected contact, client fetches history via `/api/chat/messages?user1=<me>&user2=<them>`.
- Server enforces that the authenticated user is either `user1` or `user2`.

#### 3) End-to-end encryption for chats and uploads

- Per-contact keys are stored locally in the browser (`contactKeys` in localStorage).
- Key exchange occurs over Socket.IO:
  - `request_key_exchange` and `respond_key_exchange` transfer ECDH public keys.
- Once both sides have (my private key, their public key):
  - Client derives an AES‑GCM key using ECDH.
  - Text messages are encrypted into a JSON payload `{ iv: [...], content: [...] }`.
- Media/files:
  - Client encrypts file bytes (ArrayBuffer) into JSON, then uploads JSON as a file.
  - Server stores and serves the encrypted JSON blob; recipients download and decrypt client-side.

#### 4) Real-time messaging

- Sender emits `send_message` over Socket.IO with metadata:
  - `type: text | audio | image | video | file`
  - `text` (encrypted JSON for text) or `fileUrl` (points to encrypted blob)
- Server verifies sender identity from JWT used in Socket handshake.
- Server stores the message in MongoDB and forwards it to the receiver if online.

#### 5) Voice calls (WebRTC)

- Call signaling uses Socket.IO (`call_user`, `incoming_call`, `answer_call`, `call_accepted`, `end_call`, `call_ended`).
- Important implementation detail:
  - The **initiator encrypts signaling data** before sending `call_user`.
  - WebRTC media itself is handled by the browser (DTLS‑SRTP).
- The client monitors WebRTC stats every 2 seconds and applies adaptive bitrate.

---

## Network design

### Topology

- **Browser clients** connect to:
  - **HTTP(S) REST** for auth/chat history/upload
  - **Socket.IO (WebSocket with fallback)** for real-time chat, presence, key exchange, and call signaling
- **Server** connects to:
  - **MongoDB** for users/messages
  - **Local disk** for storing uploaded encrypted blobs
- **Peer-to-peer media path**:
  - Voice calls use **WebRTC** between the two browsers.
  - NAT traversal uses **STUN** servers (Google STUN list); no TURN server is configured by default.

### Ports and endpoints (development defaults)

- Client: `http://localhost:3000`
- Server: `http://localhost:5000`
- REST endpoints:
  - `POST /api/auth/login`
  - `GET /api/chat/user/:customId`
  - `GET /api/chat/messages?user1=...&user2=...`
  - `PUT /api/chat/messages/:messageId`
  - `POST /api/upload`
- Static encrypted uploads:
  - `GET /uploads/<filename>`

### Trust boundaries

- **Server is trusted for authentication and message routing** (JWT verification, rate limits, persistence).
- **Server is not trusted with plaintext message content**:
  - Text content can be encrypted at the client and stored as ciphertext.
  - Uploaded blobs are ciphertext JSON.
- **Key material stays on clients** (stored in the browser), but key exchange occurs over the server relay.

---

## Protocols used

### Application layer

- **HTTP/1.1 (or HTTP/2 when deployed behind a proxy)**
  - REST API calls via Axios
  - File upload using `multipart/form-data`

- **WebSocket (Socket.IO)**
  - Real-time events for chat and signaling
  - Authenticated socket connection using JWT passed in `handshake.auth.token`

- **WebRTC**
  - Peer-to-peer voice calls via `simple-peer`
  - NAT traversal via ICE and STUN servers
  - Media security via DTLS-SRTP (browser-managed)

### Security/crypto primitives

- **JWT** (JSON Web Token)
  - Used for HTTP API authentication and Socket.IO authentication

- **ECDH P‑256** (WebCrypto)
  - Per-contact key agreement

- **AES‑GCM 256-bit** (WebCrypto)
  - Encrypts text messages and file bytes client-side
  - Random 12-byte IV per encryption

### Media formats and codecs

- **Audio recording**: prefers `audio/webm;codecs=opus` (fallbacks: Ogg/Opus, WebM, Ogg)
- **Image compression**: WebP via Canvas

---

## Answers to research questions

### 1) What design elements and navigation features enhance usability and accessibility for users with varying levels of technological proficiency?

**Most effective elements (and why they work):**

- **Single-entry flow (Login → Chat)**: A simple two-state UI reduces cognitive load.
- **Clear primary actions**: “Add contact”, “Send”, “Upload”, “Record”, “Call”, “Logout” should be visually distinct and consistently placed.
- **Progressive disclosure**:
  - Hide advanced features (key exchange, network quality, compression prompts) behind optional prompts or a settings panel.
- **Immediate feedback and recoverability**:
  - Typing indicator, upload progress states (compressing/encrypting/uploading), clear error messages.
- **Accessibility fundamentals**:
  - Keyboard navigability (tab order), visible focus states, and ARIA labels for icon buttons.
  - Color contrast and non-color indicators (e.g., text labels for online status, not only color).

**Applied to this project (concrete examples already present):**

- Auth state is straightforward (localStorage + conditional rendering).
- Upload flow includes user warnings for large files and a progress indicator state machine.
- Input sanitization prevents unexpected rendering of content.

**Recommended refinements (if you want to improve accessibility further):**

- Provide “Beginner mode” defaults (auto-compress images, hide network metrics).
- Add accessible call controls (large buttons, tooltips, and ARIA).
- Add “key exchange status” as a clear banner with plain-language guidance.

### 2) What are the optimal compression technologies and methods for multimedia files that balance file size and quality?

**Goal:** compress *before* encryption (encrypted data is incompressible).

- **Voice audio (recorded clips)**
  - Best general choice: **Opus** (in WebM or Ogg container).
  - Why: excellent speech quality at low bitrates; resilient under packet loss.
  - Practical settings for chat voice notes:
    - 16–32 kbps mono for speech
    - 16–24 kHz sample rate for “medium” quality (good voice clarity, smaller size)

- **Images**
  - Best general choice: **WebP** (or AVIF when available and CPU allows).
  - Method:
    - Resize large images to a max dimension (e.g., 1920px)
    - Encode at quality ~0.8–0.9 for good visual fidelity

- **Video**
  - Best general choices:
    - **H.264/AVC** (compatibility)
    - **H.265/HEVC** or **AV1** (better compression; heavier CPU / compatibility tradeoffs)
  - In-browser compression is difficult without heavy tooling. Options:
    - Client-side: FFmpeg WASM (high CPU), or rely on device’s capture defaults.
    - Server-side: transcode with FFmpeg (but plaintext is unavailable if you keep strict E2EE).

**What this project already does:**

- Audio: chooses Opus-capable MediaRecorder MIME types and sets ~32 kbps.
- Images: compresses to WebP via Canvas before encrypting and uploading.

### 3) What are the most effective strategies for optimizing media transmission to maintain call quality across varying network conditions?

**Key strategies (industry-standard):**

- **Use adaptive bitrate and congestion control**
  - Monitor RTT, jitter, packet loss via `getStats()`.
  - Adjust sender bitrate caps (e.g., `RTCRtpSender.setParameters`).

- **Prefer voice-optimized codecs and constraints**
  - Opus for audio.
  - Mono audio and lower sample rates on poor networks.

- **Reduce overhead in the connection**
  - Bundle ICE/DTLS (`bundlePolicy: max-bundle`) and require RTCP mux.

- **Improve NAT traversal reliability**
  - Add a **TURN server** for restrictive NATs/firewalls (critical for real-world reliability).

**What this project already implements:**

- WebRTC quality monitoring every 2 seconds + adaptive bitrate decisions.
- Audio constraints presets (`high/medium/low`) that reduce sample rate.
- STUN server configuration and RTCP mux policy.

---

## Performance analysis

This section summarizes practical performance considerations based on the current implementation.

### Backend constraints and safeguards

- **Rate limiting (HTTP)**
  - General API: 100 requests/min/IP
  - Auth: 60 requests/min/IP
  - Upload: 20 requests/min/IP

- **Rate limiting (Socket events)**
  - Basic per-user per-event limiting: 10 events/second (e.g., `send_message`, `typing`, key exchange events)

- **Payload limits**
  - REST body parser: 60 MB
  - Upload size: 50 MB/file
  - Socket.IO max message buffer: 1 MB (`maxHttpBufferSize`)

- **Database query limits**
  - Chat history endpoint returns up to 1000 messages, sorted chronologically.

### Client-side costs and user-perceived performance

- **Encryption cost scales with payload size**
  - AES-GCM on large files is fast but still noticeable on low-power devices.
  - The UI mitigates this by warning on large files and showing progress states.

- **Compression reduces upload time and bandwidth**
  - WebP compression for images can provide large size reductions.
  - Audio Opus reduces voice note size significantly compared to raw PCM.

- **Call quality adaptation**
  - Monitoring stats every 2 seconds is lightweight and allows bitrate tuning.
  - Adaptive bitrate improves robustness under variable RTT and packet loss.

### Expected bottlenecks

- **Uploads of large encrypted JSON blobs**: JSON expansion overhead (ciphertext stored as arrays) increases size compared to binary.
- **No TURN server**: some users will fail to connect peer-to-peer calls.
- **In-memory online user map on server**: works for single-instance deployments; multi-instance needs shared state (e.g., Redis adapter).

### Measurable metrics you can collect (recommended)

- API latency: p50/p95 for `/api/chat/messages`, `/api/upload`.
- Upload throughput and failure rates by file size.
- Call stats: RTT, jitter, packet loss, bitrate over time (already computed on client).

---

### Notes / assumptions

- All real-world deployments should use **HTTPS/WSS** (TLS) so JWTs and metadata are protected in transit.
- The current key exchange is “opportunistic” (no out-of-band fingerprint verification). For strong E2EE against active MITM, add key verification (QR code, safety number, or signed identity keys).
