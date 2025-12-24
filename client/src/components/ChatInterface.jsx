import axios from "axios";
import { useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer"; // Add this
import { io } from "socket.io-client";
import { decryptData, deriveSecretKey, encryptData, importKey } from "../e2e";
import { sanitizeText } from "../utils/sanitize";
import "./ChatInterface.css";

// API configuration
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:5000";

// Configure axios defaults
axios.defaults.baseURL = API_URL;

function ChatInterface({ user, onLogout }) {
  const [sharedKeys, setSharedKeys] = useState({}); // Cache derived keys by userId

  // Set authorization header for all requests
  useEffect(() => {
    if (user?.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${user.token}`;
    }
  }, [user]);

  // --- HELPER: Get or Derive Secret Key ---
  const getSecretKey = async (contactId) => {
    // If we already have the derived key in memory, return it
    if (sharedKeys[contactId]) return sharedKeys[contactId];

    // 1. Get My Private Key from LocalStorage
    const myPrivateStr = localStorage.getItem("myPrivateKey");
    if (!myPrivateStr) return null;
    const myPrivateKey = await importKey(myPrivateStr, "private");

    // 2. Get Contact's Public Key
    // (We need to update the search/contact list to include publicKey)
    // For now, let's assume 'currentChat' or 'conversations' object has 'publicKey'
    let contactKeyStr = conversations.find(c => c.customId === contactId)?.publicKey;

    // If not in list, fetch it (for search results)
    if (!contactKeyStr) {
      const res = await axios.get(`/api/chat/user/${contactId}`);
      contactKeyStr = res.data.publicKey;
    }

    // Make sure we have the public key before trying to import
    if (!contactKeyStr) {
      console.error(`Could not find public key for user ${contactId}`);
      return null;
    }

    const contactPublicKey = await importKey(contactKeyStr, "public");

    // 3. Derive Secret
    const secret = await deriveSecretKey(myPrivateKey, contactPublicKey);

    // Cache it
    setSharedKeys(prev => ({ ...prev, [contactId]: secret }));
    return secret;
  };

  // 1. Initialize contacts from LocalStorage instead of empty array
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem("myContacts");
    return saved ? JSON.parse(saved) : [];
  });

  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [arrivalMessage, setArrivalMessage] = useState(null);
  const [typingUser, setTypingUser] = useState(null);
  const [error, setError] = useState(null);

  // Search State
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");

  // --- NEW STATE FOR AUDIO ---
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // --- VOIP STATE ---
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [stream, setStream] = useState(null);

  const myAudio = useRef();
  const userAudio = useRef();
  const connectionRef = useRef();

  const socket = useRef();
  const scrollRef = useRef();

  // --- Socket Logic (Same as before) ---
  useEffect(() => {
    console.log(user);
    socket.current = io(WS_URL, {
      auth: {
        token: user.token // <--- IMPORTANT
      }
    });

    socket.current.on("connect_error", (err) => {
      console.log("Socket Auth Error:", err.message);
      onLogout(); // Force logout so they can login again to get a new token
    });

    socket.current.emit("user_connected", user.customId);

    socket.current.on("receive_message", handleReceiveMessage);

    socket.current.on("display_typing", (data) => setTypingUser(data.isTyping ? data.senderId : null));

    // Update online status for contacts in our list
    socket.current.on("update_user_status", (data) => {
      setConversations(prev => {
        const updated = prev.map(u => u.customId === data.userId ? { ...u, isOnline: data.isOnline } : u);
        localStorage.setItem("myContacts", JSON.stringify(updated)); // Sync with local storage
        return updated;
      });
    });

    return () => {
      socket.current.off("receive_message", handleReceiveMessage);
    };
  }, [user]);

  useEffect(() => {
    // Listen for incoming calls
    if (socket.current) {
      socket.current.on("incoming_call", async (data) => {
        // DECRYPT SIGNAL
        const secret = await getSecretKey(data.from);
        const decryptedSignalStr = await decryptData(data.signal, secret);
        const signal = JSON.parse(decryptedSignalStr);

        setReceivingCall(true);
        setCaller(data.from);
        setCallerSignal(signal); // Pass decrypted signal to Peer
      });

      socket.current.on("call_ended", () => {
        setCallEnded(true);
        setCallAccepted(false);
        setReceivingCall(false);
        setCaller("");
        if (connectionRef.current) connectionRef.current.destroy();
        window.location.reload(); // Clean reset
      });
    }

  }, []);

  const callUser = (id) => {
    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((currentStream) => {
      setStream(currentStream);

      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: currentStream,
      });

      peer.on("signal", async (data) => {
        // ENCRYPT SIGNAL
        const secret = await getSecretKey(id);
        const encryptedSignal = await encryptData(JSON.stringify(data), secret);

        socket.current.emit("call_user", {
          userToCall: id,
          signalData: encryptedSignal, // Send Ciphertext
          fromId: user.customId,
        });
      });

      peer.on("stream", (remoteStream) => {
        if (userAudio.current) userAudio.current.srcObject = remoteStream;
      });

      // --- ADD THIS BLOCK ---
      peer.on("close", () => {
        socket.current.off("call_accepted");
        setCallEnded(true);
        setCallAccepted(false);
        setReceivingCall(false);
        window.location.reload();
      });

      peer.on("error", (err) => {
        console.log("Peer error:", err);
        window.location.reload();
      });

      socket.current.on("call_accepted", (signal) => {
        setCallAccepted(true);
        peer.signal(signal);
      });

      connectionRef.current = peer;
    });
  };

  const answerCall = () => {
    setCallAccepted(true);

    navigator.mediaDevices.getUserMedia({ video: false, audio: true }).then((currentStream) => {
      setStream(currentStream);

      const peer = new SimplePeer({
        initiator: false,
        trickle: false,
        stream: currentStream,
      });

      peer.on("signal", (data) => {
        socket.current.emit("answer_call", { signal: data, to: caller });
      });

      peer.on("stream", (remoteStream) => {
        if (userAudio.current) userAudio.current.srcObject = remoteStream;
      });

      peer.signal(callerSignal);
      connectionRef.current = peer;
    });
  };

  const leaveCall = () => {
    setCallEnded(true);

    // Notify the other user that we are hanging up
    if (currentChat?.customId || caller) {
      const targetId = currentChat?.customId || caller;
      socket.current.emit("end_call", { to: targetId });
    }

    if (connectionRef.current) connectionRef.current.destroy();

    // Stop local mic/cam
    if (stream) stream.getTracks().forEach(track => track.stop());

    // Reset UI
    setCallAccepted(false);
    setReceivingCall(false);
    setCaller("");
    window.location.reload();
  };

  // --- 2. START RECORDING ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = handleStopRecording;

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied.");
    }
  };

  // --- 3. STOP RECORDING & UPLOAD ---
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    // ... create blob ...
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const buffer = await audioBlob.arrayBuffer();

    // 1. Encrypt File Buffer
    const secret = await getSecretKey(currentChat.customId);
    const encryptedJson = await encryptData(buffer, secret); // This returns JSON string of {iv, content}

    // 2. Upload Encrypted JSON as a file
    const encryptedBlob = new Blob([encryptedJson], { type: "application/json" });
    const formData = new FormData();
    formData.append("audio", encryptedBlob, "secret_audio.json"); // Save as .json

    // ... upload via axios ...
    const res = await axios.post("/api/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // 3. Send
    socket.current.emit("send_message", {
      senderId: user.customId,
      receiverId: currentChat.customId,
      text: "", // Empty for audio
      type: "audio",
      fileUrl: res.data.fileUrl // This URL points to the encrypted JSON file
    });
  };

  // --- 4. RENDER MESSAGE (Text vs Audio) ---
  const renderMessageContent = (m) => {
    if (m.type === "audio") {
      return <EncryptedAudioPlayer url={m.fileUrl} senderId={m.senderId} />;
    }
    // Sanitize text before rendering to prevent XSS
    const safeText = sanitizeText(m.text);
    return <div className="message-text">{safeText}</div>;
  };

  // --- New Message Handling ---
  useEffect(() => {
    if (arrivalMessage) {
      // If message is from current chat, show it
      if (currentChat && arrivalMessage.senderId === currentChat.customId) {
        setMessages((prev) => [...prev, arrivalMessage]);
      }

      // OPTIONAL: If message is from someone NOT in contacts, auto-add them?
      // For now, we will stick to your "Manual Add" rule.
    }
  }, [arrivalMessage, currentChat]);

  // --- Fetch Chat History ---
  useEffect(() => {
    const getMessages = async () => {
      if (currentChat) {
        try {
          const res = await axios.get(
            `/api/chat/messages?user1=${user.customId}&user2=${currentChat.customId}`
          );

          const rawMessages = res.data;

          // A. Get the Shared Secret for this conversation
          const secret = await getSecretKey(currentChat.customId);

          if (!secret) {
            console.error("Could not derive shared secret for chat history");
            setMessages(rawMessages.map(msg => ({
              ...msg,
              text: msg.type === "text" ? "⚠️ Unable to decrypt (missing key)" : msg.text
            })));
            return;
          }

          // B. Decrypt all messages in parallel
          const decryptedHistory = await Promise.all(
            rawMessages.map(async (msg) => {
              try {
                // If it is a Text message, decrypt the content
                if (msg.type === "text") {
                  // Double check it looks like JSON before trying to decrypt
                  // (Handles cases where you might have old plain text messages in DB)
                  if (msg.text.startsWith("{") && msg.text.includes("iv")) {
                    const decryptedText = await decryptData(msg.text, secret);
                    return { ...msg, text: decryptedText };
                  }
                }

                // If it's Audio, we decrypt it on-the-fly when the user clicks Play
                // so we just return the message as is (with the encrypted file URL)
                return msg;

              } catch (err) {
                console.error("Failed to decrypt message:", err);
                return { ...msg, text: "⚠️ Decryption Error" };
              }
            })
          );

          setMessages(decryptedHistory);
        } catch (err) {
          console.log(err);
        }
      }
    };
    getMessages();
  }, [currentChat, user]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // --- Handlers ---

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError("");
    setSearchResult(null);

    // Prevent searching yourself
    if (searchId === user.customId) {
      setSearchError("You cannot add yourself.");
      return;
    }

    // Check if already in contacts
    if (conversations.some(c => c.customId === searchId)) {
      setSearchError("User already in contacts.");
      return;
    }

    try {
      const res = await axios.get(`/api/chat/user/${searchId}`);
      setSearchResult(res.data);
    } catch (err) {
      setSearchError("User not found.");
    }
  };

  const addContact = () => {
    if (searchResult) {
      const newContacts = [...conversations, searchResult];
      setConversations(newContacts);
      localStorage.setItem("myContacts", JSON.stringify(newContacts)); // Persist

      // Reset Search
      setSearchId("");
      setSearchResult(null);
    }
  };

  const handleReceiveMessage = async (data) => {
    try {
      // 1. Get the shared secret
      const secret = await getSecretKey(data.senderId);

      if (!secret) {
        console.error("Could not derive shared secret for sender:", data.senderId);
        // Still set the message but mark it as undecryptable
        setArrivalMessage({
          ...data,
          text: "⚠️ Unable to decrypt message (contact not found)",
          createdAt: Date.now()
        });
        return;
      }

      let decryptedContent = "";

      // 2. Decrypt if it's text
      if (data.type === "text") {
        decryptedContent = await decryptData(data.text, secret);
      } else {
        // For Audio/File, the URL is passed through, decryption happens on click
        decryptedContent = data.text || "";
      }

      // 3. Update State
      setArrivalMessage({
        ...data,
        text: decryptedContent,
        createdAt: Date.now()
      });
    } catch (err) {
      console.error("Decryption error:", err);
      setArrivalMessage({
        ...data,
        text: "⚠️ Decryption failed",
        createdAt: Date.now()
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage || !newMessage.trim()) return;

    // Sanitize and limit message length
    const sanitizedMessage = sanitizeText(newMessage.trim()).substring(0, 10000);

    if (!sanitizedMessage) {
      setError("Invalid message content");
      return;
    }

    try {
      // Encrypt Text
      const secret = await getSecretKey(currentChat.customId);

      if (!secret) {
        console.error("Cannot send message: Unable to derive shared secret");
        alert("Unable to encrypt message. Please try again.");
        return;
      }

      const encryptedText = await encryptData(sanitizedMessage, secret);

      const msg = {
        senderId: user.customId,
        receiverId: currentChat.customId,
        text: encryptedText, // SEND CIPHERTEXT
        type: "text"
      };

      socket.current.emit("send_message", msg);

      // For local display, we show the PLAIN text, but store encrypted in DB
      // Actually, to simulate real E2E, let's just push the plain text to UI state
      // but the 'msg' object sent to socket is encrypted.
      setMessages([...messages, { ...msg, text: sanitizedMessage, createdAt: Date.now() }]); // Store plain locally
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message. Please try again.");
    }
  };

  const EncryptedAudioPlayer = ({ url, senderId }) => {
    const [audioSrc, setAudioSrc] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadAudio = async () => {
      setLoading(true);
      try {
        // 1. Fetch encrypted JSON file
        const res = await fetch(url);
        const encryptedJson = await res.text();

        // 2. Decrypt
        const secret = await getSecretKey(senderId);

        if (!secret) {
          setError("Unable to decrypt audio (missing key)");
          return;
        }

        const decryptedBuffer = await decryptData(encryptedJson, secret, true);

        // 3. Create Blob URL
        const blob = new Blob([decryptedBuffer], { type: "audio/webm" });
        setAudioSrc(URL.createObjectURL(blob));
      } catch (e) {
        console.error(e);
        setError("Failed to decrypt audio");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="audio-player-container">
        {error ? (
          <div className="audio-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : !audioSrc ? (
          <button className="decrypt-audio-btn" onClick={loadAudio} disabled={loading}>
            {loading ? (
              <>
                <span>⏳</span>
                <span>Decrypting...</span>
              </>
            ) : (
              <>
                <span>🔓</span>
                <span>Play Audio</span>
              </>
            )}
          </button>
        ) : (
          <audio className="audio-player" controls src={audioSrc} />
        )}
      </div>
    );
  };

  return (
    <div className="chat-container">

      {/* 1. NAV RAIL */}
      <div className="nav-rail">
        <h2 className="nav-logo">Press Freely</h2>
        <div className="nav-spacer"></div>
        <div className="my-id-display">My ID: <br /><strong>{user.customId}</strong></div>
        <button onClick={onLogout} className="logout-btn">Logout</button>
      </div>

      {/* 2. CONTACT LIST + ADD USER */}
      <div className="contact-list-panel">

        {/* ADD USER SECTION */}
        <div className="add-user-section">
          <h4>Add Contact</h4>
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Enter ID"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
            />
            <button type="submit">🔍</button>
          </form>

          {searchResult && (
            <div className="search-result">
              <span>Found: <b>{searchResult.username}</b></span>
              <button onClick={addContact} className="add-btn">Add</button>
            </div>
          )}
          {searchError && <div className="search-error">{searchError}</div>}
        </div>

        {/* LIST SECTION */}
        <div className="conversations-list">
          {conversations.length === 0 && <p className="no-contacts">No contacts yet.</p>}

          {conversations.map((c) => (
            <div
              key={c.customId}
              className={`contact-item ${currentChat?.customId === c.customId ? "selected" : ""}`}
              onClick={() => setCurrentChat(c)}
            >
              <div className="avatar-wrapper">
                <div className="avatar">{c.username.charAt(0).toUpperCase()}</div>
                {c.isOnline && <span className="online-dot"></span>}
              </div>
              <span className="contact-name">{c.username}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. CHAT AREA (Same as before) */}
      <div className="chat-box">
        {receivingCall && !callAccepted ? (
          <div className="call-notification">
            <h3>Incoming Call from {caller}</h3>
            <div className="call-actions">
              <button className="answer-btn" onClick={answerCall}>Answer</button>
              <button className="reject-btn" onClick={() => setReceivingCall(false)}>Reject</button>
            </div>
          </div>
        ) : null}

        {/* Hidden Audio Element for Remote Stream */}
        <audio ref={userAudio} autoPlay />

        {/* Active Call UI */}
        {callAccepted && !callEnded ? (
          <div className="active-call-bar">
            <span>On Call with <b>{currentChat?.username || caller}</b></span>
            <button className="end-call-btn" onClick={leaveCall}>End Call</button>
          </div>
        ) : null}
        {currentChat ? (
          <>
            <div className="chat-header">
              <div className="header-info">To: <b>{currentChat.username}</b></div>

              <div className="header-actions">
                {/* CALL BUTTON */}
                <button className="call-btn" onClick={() => callUser(currentChat.customId)}>
                  📞 Call
                </button>
              </div>
            </div>

            <div className="chat-messages">
              {messages.map((m, index) => (
                <div key={index} ref={scrollRef} className={`message-wrapper ${m.senderId === user.customId ? "own" : "friend"}`}>
                  <div className="message-bubble">
                    {renderMessageContent(m)} {/* <--- Use Helper */}
                    <div className="message-time">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="chat-input-area">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
              />

              {/* MIC BUTTON */}
              <button
                className={`mic-btn ${isRecording ? "recording" : ""}`}
                onClick={isRecording ? stopRecording : startRecording}
                type="button"
              >
                {isRecording ? "⬛" : "🎤"}
              </button>

              <button onClick={handleSubmit} className="send-btn">Send</button>
            </div>
          </>
        ) : (
          <div className="no-chat">Select a contact to start chatting</div>
        )}
      </div>
    </div>
  );
}

export default ChatInterface;