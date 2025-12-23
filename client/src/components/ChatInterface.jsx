import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./ChatInterface.css";

function ChatInterface({ user, onLogout }) {
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

  // Search State
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");

  // --- NEW STATE FOR AUDIO ---
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const socket = useRef();
  const scrollRef = useRef();

  // --- Socket Logic (Same as before) ---
  useEffect(() => {
    socket.current = io("ws://localhost:5000");
    socket.current.emit("user_connected", user.customId);

    socket.current.on("receive_message", (data) => {
      setArrivalMessage({
        senderId: data.senderId,
        text: data.text,
        type: data.type,      // <--- New
        fileUrl: data.fileUrl, // <--- New
        createdAt: Date.now()
      });
    });

    socket.current.on("display_typing", (data) => setTypingUser(data.isTyping ? data.senderId : null));

    // Update online status for contacts in our list
    socket.current.on("update_user_status", (data) => {
      setConversations(prev => {
        const updated = prev.map(u => u.customId === data.userId ? { ...u, isOnline: data.isOnline } : u);
        localStorage.setItem("myContacts", JSON.stringify(updated)); // Sync with local storage
        return updated;
      });
    });
  }, [user]);

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
    // Create Blob from chunks
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

    // Create Form Data
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice-note.webm");

    try {
      // 1. Upload to Server
      const res = await axios.post("http://localhost:5000/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { fileUrl } = res.data;

      // 2. Send Socket Message with URL
      const msgData = {
        senderId: user.customId,
        receiverId: currentChat.customId,
        text: "", // Empty for audio
        type: "audio",
        fileUrl: fileUrl
      };

      socket.current.emit("send_message", msgData);

      // 3. Update UI
      setMessages((prev) => [...prev, { ...msgData, createdAt: Date.now() }]);

    } catch (err) {
      console.error("Upload failed", err);
    }
  };

  // --- 4. RENDER MESSAGE (Text vs Audio) ---
  const renderMessageContent = (m) => {
    if (m.type === "audio") {
      return (
        <audio controls src={m.fileUrl} className="audio-player">
          Your browser does not support the audio element.
        </audio>
      );
    }
    return <div className="message-text">{m.text}</div>;
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
          const res = await axios.get(`http://localhost:5000/api/chat/messages?user1=${user.customId}&user2=${currentChat.customId}`);
          setMessages(res.data);
        } catch (err) { console.log(err); }
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
      const res = await axios.get(`http://localhost:5000/api/chat/user/${searchId}`);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newMessage) return;
    const msg = { senderId: user.customId, receiverId: currentChat.customId, text: newMessage, type: "text" };
    socket.current.emit("send_message", msg);
    setMessages([...messages, { ...msg, createdAt: Date.now() }]);
    setNewMessage("");
  };

  return (
    <div className="chat-container">

      {/* 1. NAV RAIL */}
      <div className="nav-rail">
        <h2 className="nav-logo">My Chat</h2>
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
        {currentChat ? (
          <>
            <div className="chat-header">To: <b>{currentChat.username}</b></div>

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