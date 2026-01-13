import axios from "axios";
import { useEffect, useRef, useState } from "react";
import SimplePeer from "simple-peer";
import { io } from "socket.io-client";
import { decryptData, deriveSecretKey, encryptData, exportKey, generateKeyPair, importKey } from "../e2e";
import { sanitizeText } from "../utils/sanitize";
import { compressImage, getAudioConstraints, getMediaRecorderOptions, getCompressionStrategy } from "../utils/compression";
import { getPeerConnectionConfig, getCallMediaConstraints, calculateNetworkQuality, getRecommendedBitrate, formatNetworkQuality, applyAdaptiveBitrate, NetworkQuality } from "../utils/webrtc";
import "./ChatInterface.css";

// API configuration
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const WS_URL = process.env.REACT_APP_WS_URL || "ws://localhost:5000";

// Configure axios defaults
axios.defaults.baseURL = API_URL;

function ChatInterface({ user, onLogout }) {
  // Per-contact key storage structure in localStorage:
  // "contactKeys": {
  //   "contactId1": {
  //     "myPrivateKey": "...",
  //     "myPublicKey": "...",
  //     "theirPublicKey": "..."
  //   },
  //   "contactId2": { ... }
  // }

  const [sharedKeys, setSharedKeys] = useState({}); // Cache derived keys by userId

  // Set authorization header for all requests
  useEffect(() => {
    if (user?.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${user.token}`;
      
      // Add response interceptor to handle auth errors
      const interceptor = axios.interceptors.response.use(
        (response) => response,
        (error) => {
          // Don't logout on upload errors or network errors
          if (error.response?.status === 401 && !error.config?.url?.includes('/upload')) {
            console.error("Authentication error:", error);
            // Only logout if it's not an upload-related error
            if (!error.config?._isRetry) {
              localStorage.removeItem("chatUser");
              window.location.reload();
            }
          }
          return Promise.reject(error);
        }
      );

      // Cleanup interceptor on unmount
      return () => {
        axios.interceptors.response.eject(interceptor);
      };
    }
  }, [user]);

  // --- HELPER: Get Contact Keys from LocalStorage ---
  const getContactKeys = (contactId) => {
    const allKeys = JSON.parse(localStorage.getItem("contactKeys") || "{}");
    return allKeys[contactId] || null;
  };

  // --- HELPER: Save Contact Keys to LocalStorage ---
  const saveContactKeys = (contactId, keys) => {
    const allKeys = JSON.parse(localStorage.getItem("contactKeys") || "{}");
    allKeys[contactId] = keys;
    localStorage.setItem("contactKeys", JSON.stringify(allKeys));
  };

  // --- HELPER: Get or Derive Secret Key ---
  const getSecretKey = async (contactId) => {
    // If we already have the derived key in memory, return it
    if (sharedKeys[contactId]) return sharedKeys[contactId];

    // Get keys for this contact
    const keys = getContactKeys(contactId);
    if (!keys || !keys.myPrivateKey || !keys.theirPublicKey) {
      console.error(`Missing keys for contact ${contactId}`);
      return null;
    }

    try {
      // Import keys
      const myPrivateKey = await importKey(keys.myPrivateKey, "private");
      const theirPublicKey = await importKey(keys.theirPublicKey, "public");

      // Derive secret
      const secret = await deriveSecretKey(myPrivateKey, theirPublicKey);

      // Cache it
      setSharedKeys(prev => ({ ...prev, [contactId]: secret }));
      return secret;
    } catch (err) {
      console.error("Error deriving secret key:", err);
      return null;
    }
  };

  // --- HELPER: Refresh Messages ---
  const refreshMessages = async (contactId) => {
    try {
      const res = await axios.get(
        `/api/chat/messages?user1=${user.customId}&user2=${contactId}`
      );

      const rawMessages = res.data;
      const secret = await getSecretKey(contactId);

      if (!secret) {
        console.error("Could not derive shared secret for chat history");
        setMessages(rawMessages.map(msg => ({
          ...msg,
          text: msg.type === "text" ? "⚠️ Unable to decrypt (missing key)" : msg.text
        })));
        return;
      }

      const decryptedHistory = await Promise.all(
        rawMessages.map(async (msg) => {
          try {
            if (msg.type === "text") {
              if (msg.text.startsWith("{") && msg.text.includes("iv")) {
                const decryptedText = await decryptData(msg.text, secret);
                return { ...msg, text: decryptedText };
              }
            }
            return msg;
          } catch (err) {
            console.error("Failed to decrypt message:", err);
            return { ...msg, text: "⚠️ Decryption Error" };
          }
        })
      );

      setMessages(decryptedHistory);
      console.log("Messages refreshed successfully");
    } catch (err) {
      console.error("Error refreshing messages:", err);
    }
  };

  // --- HELPER: Re-encrypt old messages with new keys ---
  const reEncryptOldMessages = async (contactId, oldKeys, newSecret) => {
    try {
      // Validate we have complete old keys (both public and private with theirPublicKey)
      if (!oldKeys || !oldKeys.myPrivateKey || !oldKeys.theirPublicKey) {
        console.log("No complete old keys available - skipping re-encryption (this is normal for first key exchange)");
        return;
      }

      // Fetch all messages with this contact
      const res = await axios.get(
        `/api/chat/messages?user1=${user.customId}&user2=${contactId}`
      );

      const oldMessages = res.data;
      
      if (oldMessages.length === 0) {
        console.log("No old messages to re-encrypt");
        return;
      }

      console.log(`Found ${oldMessages.length} messages, attempting to re-encrypt...`);

      // Try to derive old secret key
      let oldSecret = null;
      try {
        const oldPrivateKey = await importKey(oldKeys.myPrivateKey, "private");
        const oldPublicKey = await importKey(oldKeys.theirPublicKey, "public");
        oldSecret = await deriveSecretKey(oldPrivateKey, oldPublicKey);
        console.log("Successfully derived old secret key");
      } catch (err) {
        console.error("Could not derive old secret key:", err);
        console.log("Skipping re-encryption - old keys incompatible");
        return;
      }

      if (!oldSecret) {
        console.log("Failed to derive old secret key - skipping re-encryption");
        return;
      }

      setKeyExchangeStatus(`Re-encrypting ${oldMessages.length} messages...`);

      // Re-encrypt each text message
      let reEncryptedCount = 0;
      let skippedCount = 0;
      
      for (const msg of oldMessages) {
        // Only process text messages that appear to be encrypted
        if (msg.type === "text" && msg.text && msg.text.includes("iv") && msg.text.includes("content")) {
          try {
            // Decrypt with old key
            const decryptedText = await decryptData(msg.text, oldSecret);
            
            // Verify decryption was successful
            if (!decryptedText || decryptedText.includes("⚠️")) {
              console.log(`Skipping message ${msg._id} - decryption returned error`);
              skippedCount++;
              continue;
            }
            
            // Re-encrypt with new key
            const reEncryptedText = await encryptData(decryptedText, newSecret);
            
            // Update on server
            await axios.put(`/api/chat/messages/${msg._id}`, {
              text: reEncryptedText
            });
            
            reEncryptedCount++;
            console.log(`Re-encrypted message ${msg._id} successfully`);
          } catch (err) {
            console.error(`Failed to re-encrypt message ${msg._id}:`, err.message);
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      }

      console.log(`Re-encryption complete: ${reEncryptedCount} successful, ${skippedCount} skipped`);
      
      if (reEncryptedCount > 0) {
        setKeyExchangeStatus(`Re-encrypted ${reEncryptedCount} messages successfully!`);
        setTimeout(() => setKeyExchangeStatus(""), 3000);
        
        // Refresh messages to show re-encrypted content
        await refreshMessages(contactId);
      } else {
        console.log("No messages were re-encrypted - they may not be encrypted or keys don't match");
      }
    } catch (err) {
      console.error("Error re-encrypting messages:", err);
      setKeyExchangeStatus("Re-encryption failed");
      setTimeout(() => setKeyExchangeStatus(""), 3000);
    }
  };

  // Initialize contacts from LocalStorage
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

  // Settings State
  const [showSettings, setShowSettings] = useState(false);

  // Search State
  const [searchId, setSearchId] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");

  // Key Exchange State
  const [pendingKeyRequest, setPendingKeyRequest] = useState(null);
  const [keyExchangeStatus, setKeyExchangeStatus] = useState("");

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // VOIP State
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [stream, setStream] = useState(null);
  const [networkQuality, setNetworkQuality] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  const myAudio = useRef();
  const userAudio = useRef();
  const connectionRef = useRef();
  const typingTimeoutRef = useRef(null);
  const qualityMonitorRef = useRef(null);

  const socket = useRef();
  const scrollRef = useRef();

  // --- Key Exchange Handlers (defined before useEffect) ---
  const handleKeyExchangeRequest = async ({ fromUserId, publicKey }) => {
    console.log("Received key exchange request from:", fromUserId);
    setPendingKeyRequest({ fromUserId, publicKey });
  };

  const handleKeyExchangeResponse = async ({ fromUserId, publicKey, accepted }) => {
    if (!accepted) {
      setKeyExchangeStatus(`User ${fromUserId} declined key exchange`);
      setTimeout(() => setKeyExchangeStatus(""), 3000);
      return;
    }

    // Get our keys for this contact (before updating)
    const oldKeys = getContactKeys(fromUserId);
    if (!oldKeys) {
      console.error("No keys found for contact");
      return;
    }

    // Save a copy of old keys for re-encryption (if they're complete)
    const keysBeforeUpdate = oldKeys.theirPublicKey ? { ...oldKeys } : null;
    console.log("Old keys before update:", keysBeforeUpdate ? "complete" : "incomplete");

    // Save their public key
    oldKeys.theirPublicKey = publicKey;
    saveContactKeys(fromUserId, oldKeys);

    // Clear cached secret key so we derive a fresh one
    setSharedKeys(prev => {
      const updated = { ...prev };
      delete updated[fromUserId];
      return updated;
    });

    // Derive new secret key
    const newSecret = await getSecretKey(fromUserId);

    setKeyExchangeStatus(`Key exchange with ${fromUserId} completed!`);
    setTimeout(() => setKeyExchangeStatus(""), 3000);

    // Mark contact as having keys
    setConversations(prev => {
      const updated = prev.map(c =>
        c.customId === fromUserId ? { ...c, hasKeys: true } : c
      );
      localStorage.setItem("myContacts", JSON.stringify(updated));
      return updated;
    });

    // Update currentChat if this is the active chat
    setCurrentChat(prev => {
      if (prev && prev.customId === fromUserId) {
        return { ...prev, hasKeys: true };
      }
      return prev;
    });

    // Re-encrypt old messages only if we had complete old keys (key rotation scenario)
    if (newSecret && keysBeforeUpdate) {
      console.log("Initiating re-encryption (key rotation detected)");
      reEncryptOldMessages(fromUserId, keysBeforeUpdate, newSecret);
    } else {
      console.log("Skipping re-encryption (first key exchange)");
    }
  };

  const acceptKeyExchange = async () => {
    if (!pendingKeyRequest) return;

    const { fromUserId, publicKey } = pendingKeyRequest;

    // Get old keys if they exist (for re-encryption)
    const oldKeys = getContactKeys(fromUserId);
    const keysBeforeUpdate = (oldKeys && oldKeys.theirPublicKey) ? { ...oldKeys } : null;
    console.log("Old keys before accepting exchange:", keysBeforeUpdate ? "complete" : "incomplete");

    // Generate new key pair for this contact
    const keyPair = await generateKeyPair();
    const myPrivateKey = await exportKey(keyPair.privateKey);
    const myPublicKey = await exportKey(keyPair.publicKey);

    // Save keys
    saveContactKeys(fromUserId, {
      myPrivateKey,
      myPublicKey,
      theirPublicKey: publicKey
    });

    // Clear cached secret key so we derive a fresh one
    setSharedKeys(prev => {
      const updated = { ...prev };
      delete updated[fromUserId];
      return updated;
    });

    // Derive new secret key
    const newSecret = await getSecretKey(fromUserId);

    // Send response with our public key
    socket.current.emit("respond_key_exchange", {
      targetUserId: fromUserId,
      publicKey: myPublicKey,
      accepted: true
    });

    setPendingKeyRequest(null);
    setKeyExchangeStatus(`Key exchange accepted with ${fromUserId}`);
    setTimeout(() => setKeyExchangeStatus(""), 3000);

    // Update contact list to show keys are established
    setConversations(prev => {
      const updated = prev.map(c =>
        c.customId === fromUserId ? { ...c, hasKeys: true } : c
      );
      localStorage.setItem("myContacts", JSON.stringify(updated));
      return updated;
    });

    // Update currentChat if this is the active chat
    setCurrentChat(prev => {
      if (prev && prev.customId === fromUserId) {
        return { ...prev, hasKeys: true };
      }
      return prev;
    });

    // Re-encrypt old messages only if we had complete old keys (key rotation scenario)
    if (newSecret && keysBeforeUpdate) {
      console.log("Initiating re-encryption (key rotation detected)");
      reEncryptOldMessages(fromUserId, keysBeforeUpdate, newSecret);
    } else {
      console.log("Skipping re-encryption (first key exchange)");
    }
  };

  const rejectKeyExchange = () => {
    if (!pendingKeyRequest) return;

    socket.current.emit("respond_key_exchange", {
      targetUserId: pendingKeyRequest.fromUserId,
      publicKey: null,
      accepted: false
    });

    setPendingKeyRequest(null);
  };

  const initiateKeyExchange = async (contactId) => {
    // Generate new key pair for this contact
    const keyPair = await generateKeyPair();
    const myPrivateKey = await exportKey(keyPair.privateKey);
    const myPublicKey = await exportKey(keyPair.publicKey);

    // Save our keys (without their public key yet)
    saveContactKeys(contactId, {
      myPrivateKey,
      myPublicKey,
      theirPublicKey: null
    });

    // Clear cached secret key
    setSharedKeys(prev => {
      const updated = { ...prev };
      delete updated[contactId];
      return updated;
    });

    // Send request
    socket.current.emit("request_key_exchange", {
      targetUserId: contactId,
      publicKey: myPublicKey
    });

    setKeyExchangeStatus(`Key exchange request sent to ${contactId}`);
    setTimeout(() => setKeyExchangeStatus(""), 3000);
  };

  // --- Call Handlers (defined before useEffect) ---
  const handleIncomingCall = async (data) => {
    const secret = await getSecretKey(data.from);
    if (!secret) {
      console.error("Cannot decrypt call signal - missing keys");
      return;
    }

    const decryptedSignalStr = await decryptData(data.signal, secret);
    const signal = JSON.parse(decryptedSignalStr);

    setReceivingCall(true);
    setCaller(data.from);
    setCallerSignal(signal);
  };

  const handleCallEnded = () => {
    setCallEnded(true);
    setCallAccepted(false);
    setReceivingCall(false);
    setCaller("");
    if (connectionRef.current) connectionRef.current.destroy();
    window.location.reload();
  };



  // --- Socket Logic ---
  useEffect(() => {
    socket.current = io(WS_URL, {
      auth: {
        token: user.token
      }
    });

    socket.current.on("connect_error", (err) => {
      console.log("Socket Auth Error:", err.message);
      onLogout();
    });

    socket.current.emit("user_connected", user.customId);

    socket.current.on("receive_message", handleReceiveMessage);

    socket.current.on("display_typing", (data) => setTypingUser(data.isTyping ? data.senderId : null));

    // Update online status for contacts
    socket.current.on("update_user_status", (data) => {
      setConversations(prev => {
        const updated = prev.map(u => u.customId === data.userId ? { ...u, isOnline: data.isOnline } : u);
        localStorage.setItem("myContacts", JSON.stringify(updated));
        return updated;
      });
    });

    // Key Exchange Listeners
    socket.current.on("key_exchange_request", handleKeyExchangeRequest);
    socket.current.on("key_exchange_response", handleKeyExchangeResponse);

    // Call listeners
    socket.current.on("incoming_call", handleIncomingCall);
    socket.current.on("call_ended", handleCallEnded);

    return () => {
      socket.current.off("receive_message", handleReceiveMessage);
      socket.current.off("key_exchange_request", handleKeyExchangeRequest);
      socket.current.off("key_exchange_response", handleKeyExchangeResponse);
      socket.current.off("incoming_call", handleIncomingCall);
      socket.current.off("call_ended", handleCallEnded);
    };
  }, [user]);

  // Synchronize hasKeys flags with actual key existence on mount
  useEffect(() => {
    const syncHasKeysFlags = () => {
      const savedContacts = localStorage.getItem("myContacts");
      if (!savedContacts) return;

      const contacts = JSON.parse(savedContacts);
      let needsUpdate = false;
      
      const updatedContacts = contacts.map(contact => {
        const keys = getContactKeys(contact.customId);
        const hasCompleteKeys = keys && keys.myPrivateKey && keys.myPublicKey && keys.theirPublicKey;
        
        // Only update if there's a mismatch
        if (contact.hasKeys !== hasCompleteKeys) {
          needsUpdate = true;
          return { ...contact, hasKeys: hasCompleteKeys };
        }
        return contact;
      });

      if (needsUpdate) {
        console.log("Synchronizing hasKeys flags with imported keys");
        setConversations(updatedContacts);
        localStorage.setItem("myContacts", JSON.stringify(updatedContacts));
        
        // Also update currentChat if it's affected
        setCurrentChat(prev => {
          if (!prev) return prev;
          const keys = getContactKeys(prev.customId);
          const hasCompleteKeys = keys && keys.myPrivateKey && keys.myPublicKey && keys.theirPublicKey;
          if (prev.hasKeys !== hasCompleteKeys) {
            return { ...prev, hasKeys: hasCompleteKeys };
          }
          return prev;
        });
      }
    };

    syncHasKeysFlags();
  }, []);

  // Monitor network quality during calls
  const startQualityMonitoring = (peerConnection) => {
    if (qualityMonitorRef.current) {
      clearInterval(qualityMonitorRef.current);
    }

    qualityMonitorRef.current = setInterval(async () => {
      try {
        const stats = await peerConnection.getStats();
        const metrics = calculateNetworkQuality(stats);
        setNetworkQuality(metrics);

        // Apply adaptive bitrate based on quality
        const recommendedBitrate = getRecommendedBitrate(metrics.quality);
        await applyAdaptiveBitrate(peerConnection, recommendedBitrate);
      } catch (err) {
        console.error('Quality monitoring error:', err);
      }
    }, 2000); // Check every 2 seconds
  };

  const stopQualityMonitoring = () => {
    if (qualityMonitorRef.current) {
      clearInterval(qualityMonitorRef.current);
      qualityMonitorRef.current = null;
    }
    setNetworkQuality(null);
  };

  const callUser = (id) => {
    const constraints = getCallMediaConstraints('high');
    navigator.mediaDevices.getUserMedia(constraints).then((currentStream) => {
      setStream(currentStream);

      const peer = new SimplePeer({
        initiator: true,
        trickle: false,
        stream: currentStream,
      });

      peer.on("signal", async (data) => {
        const secret = await getSecretKey(id);
        if (!secret) {
          console.error("Cannot encrypt call signal - missing keys");
          return;
        }
        const encryptedSignal = await encryptData(JSON.stringify(data), secret);

        socket.current.emit("call_user", {
          userToCall: id,
          signalData: encryptedSignal,
          fromId: user.customId,
        });
      });

      peer.on("stream", (remoteStream) => {
        if (userAudio.current) userAudio.current.srcObject = remoteStream;
      });

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

    const constraints = getCallMediaConstraints('high');
    navigator.mediaDevices.getUserMedia(constraints).then((currentStream) => {
      setStream(currentStream);

      const peerConfig = getPeerConnectionConfig();
      const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        stream: currentStream,
        config: peerConfig
      });

      peer.on("signal", (data) => {
        socket.current.emit("answer_call", { signal: data, to: caller });
      });

      peer.on("stream", (remoteStream) => {
        if (userAudio.current) userAudio.current.srcObject = remoteStream;
      });

      peer.on("connect", () => {
        console.log('Peer connected, starting quality monitoring');
        if (peer._pc) {
          startQualityMonitoring(peer._pc);
        }
      });

      peer.signal(callerSignal);
      connectionRef.current = peer;
    }).catch((err) => {
      console.error("Media access error:", err);
      alert("Could not access microphone. Please check permissions.");
    });
  };

  const leaveCall = () => {
    setCallEnded(true);
    stopQualityMonitoring();

    if (currentChat?.customId || caller) {
      const targetId = currentChat?.customId || caller;
      socket.current.emit("end_call", { to: targetId });
    }

    if (connectionRef.current) connectionRef.current.destroy();
    if (stream) stream.getTracks().forEach(track => track.stop());

    setCallAccepted(false);
    setReceivingCall(false);
    setCaller("");
    window.location.reload();
  };

  // --- Audio Recording ---
  const startRecording = async () => {
    try {
      const constraints = getAudioConstraints('medium');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const options = getMediaRecorderOptions();
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = handleStopRecording;

      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log('Recording started with optimized audio settings');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    const buffer = await audioBlob.arrayBuffer();

    const secret = await getSecretKey(currentChat.customId);
    if (!secret) {
      alert("Cannot send audio - encryption keys not established");
      return;
    }

    const encryptedJson = await encryptData(buffer, secret);

    const encryptedBlob = new Blob([encryptedJson], { type: "application/json" });
    const formData = new FormData();
    formData.append("file", encryptedBlob, "secret_audio.json");

    const res = await axios.post("/api/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const audioMsg = {
      senderId: user.customId,
      receiverId: currentChat.customId,
      text: "",
      type: "audio",
      fileUrl: res.data.fileUrl,
      createdAt: Date.now()
    };

    socket.current.emit("send_message", audioMsg);

    // Add to local messages immediately
    setMessages(prev => [...prev, audioMsg]);
  };

  // --- File Upload ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      alert("File too large. Maximum size is 50MB.");
      e.target.value = "";
      return;
    }

    try {
      const secret = await getSecretKey(currentChat.customId);
      if (!secret) {
        alert("Cannot send file - encryption keys not established");
        e.target.value = "";
        return;
      }

      // Check compression strategy
      const strategy = getCompressionStrategy(file);
      let fileToUpload = file;
      
      setUploadProgress({ status: 'compressing', progress: 0 });

      // Compress images before encryption
      if (strategy.shouldCompress && strategy.method === 'image') {
        const shouldCompress = file.size > 1024 * 1024 ? 
          window.confirm(
            `This image is ${(file.size / 1024 / 1024).toFixed(2)}MB. ` +
            `Compress to ~${(strategy.estimatedSize / 1024 / 1024).toFixed(2)}MB before uploading?`
          ) : true;
        
        if (shouldCompress) {
          try {
            const compressedBlob = await compressImage(file);
            fileToUpload = new File([compressedBlob], file.name, { type: 'image/webp' });
            console.log(`Compression saved ${((file.size - fileToUpload.size) / 1024 / 1024).toFixed(2)}MB`);
          } catch (err) {
            console.error('Compression failed, using original:', err);
          }
        }
      }

      // Warn about large files
      if (fileToUpload.size > 10 * 1024 * 1024) {
        const proceed = window.confirm(
          `This file is ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB. Large files may take longer to encrypt and upload. Continue?`
        );
        if (!proceed) {
          setUploadProgress(null);
          e.target.value = "";
          return;
        }
      }

      setUploadProgress({ status: 'encrypting', progress: 0 });
      console.log(`Encrypting ${fileToUpload.name}...`);

      // Read file as ArrayBuffer
      const buffer = await fileToUpload.arrayBuffer();

      // Encrypt the file
      const encryptedJson = await encryptData(buffer, secret);

      setUploadProgress({ status: 'uploading', progress: 0 });
      console.log(`Uploading encrypted ${fileToUpload.name}...`);

      // Create encrypted blob
      const encryptedBlob = new Blob([encryptedJson], { type: "application/json" });
      const formData = new FormData();
      formData.append("file", encryptedBlob, `encrypted_${fileToUpload.name}.json`);

      // Upload encrypted file with progress tracking
      const res = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress({ status: 'uploading', progress: percentCompleted });
        }
      });

      // Determine file type
      let messageType = "file";
      if (file.type.startsWith("image/")) {
        messageType = "image";
      } else if (file.type.startsWith("video/")) {
        messageType = "video";
      } else if (file.type.startsWith("audio/")) {
        messageType = "audio";
      }

      const fileMsg = {
        senderId: user.customId,
        receiverId: currentChat.customId,
        text: "",
        type: messageType,
        fileUrl: res.data.fileUrl,
        fileName: file.name,
        createdAt: Date.now()
      };

      socket.current.emit("send_message", fileMsg);
      setMessages(prev => [...prev, fileMsg]);
      
      setUploadProgress(null);
      e.target.value = "";
    } catch (err) {
      console.error('Upload error:', err);
      setUploadProgress(null);
      alert(err.response?.data?.message || "Failed to upload file. Please try again.");
      e.target.value = "";
    }
  };
        senderId: user.customId,
        receiverId: currentChat.customId,
        text: "",
        type: messageType,
        fileUrl: res.data.fileUrl,
        fileName: file.name,
        createdAt: Date.now()
      };

      console.log(`Sending ${messageType} message:`, {
        type: fileMsg.type,
        fileUrl: fileMsg.fileUrl,
        fileName: fileMsg.fileName
      });

      socket.current.emit("send_message", fileMsg);

      // Add to local messages immediately
      setMessages(prev => [...prev, fileMsg]);
      
      console.log(`${file.name} sent successfully!`);
      
      // Clear the file input
      e.target.value = "";
    } catch (err) {
      console.error("File upload error:", err);
      
      // Provide specific error messages
      let errorMessage = "Failed to upload file. Please try again.";
      
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMessage = "Upload timed out. The file might be too large or your connection is slow.";
      } else if (err.response?.status === 413) {
        errorMessage = "File is too large for the server to handle.";
      } else if (err.response?.status === 400) {
        errorMessage = err.response.data?.message || "Invalid file type or format.";
      } else if (!navigator.onLine) {
        errorMessage = "No internet connection. Please check your network.";
      }
      
      alert(errorMessage);
      
      // Clear the file input
      e.target.value = "";
    }
  };

  // --- Message Rendering ---
  const renderMessageContent = (m) => {
    // Determine the contact ID (the other person in the conversation)
    const contactId = m.senderId === user.customId ? m.receiverId : m.senderId;
    
    if (m.type === "audio") {
      return <EncryptedAudioPlayer url={m.fileUrl} contactId={contactId} />;
    }
    if (m.type === "image") {
      return <EncryptedImageViewer url={m.fileUrl} contactId={contactId} />;
    }
    if (m.type === "video") {
      return <EncryptedVideoPlayer url={m.fileUrl} contactId={contactId} />;
    }
    if (m.type === "file") {
      return <EncryptedFileDownload url={m.fileUrl} contactId={contactId} fileName={m.fileName} />;
    }
    const safeText = sanitizeText(m.text);
    return <div className="message-text">{safeText}</div>;
  };

  const EncryptedAudioPlayer = ({ url, contactId }) => {
    const [audioSrc, setAudioSrc] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadAudio = async () => {
      setLoading(true);
      try {
        const res = await fetch(url);
        const encryptedJson = await res.text();

        const secret = await getSecretKey(contactId);

        if (!secret) {
          setError("Unable to decrypt audio (missing key)");
          return;
        }

        const decryptedBuffer = await decryptData(encryptedJson, secret, true);

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

  // --- Encrypted Image Viewer ---
  const EncryptedImageViewer = ({ url, contactId }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadImage = async () => {
      setLoading(true);
      try {
        const res = await fetch(url);
        const encryptedJson = await res.text();

        const secret = await getSecretKey(contactId);

        if (!secret) {
          setError("Unable to decrypt image (missing key)");
          return;
        }

        const decryptedBuffer = await decryptData(encryptedJson, secret, true);

        const blob = new Blob([decryptedBuffer], { type: "image/jpeg" });
        setImageSrc(URL.createObjectURL(blob));
      } catch (e) {
        console.error(e);
        setError("Failed to decrypt image");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="media-container">
        {error ? (
          <div className="media-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : !imageSrc ? (
          <button className="decrypt-media-btn" onClick={loadImage} disabled={loading}>
            {loading ? (
              <>
                <span>⏳</span>
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>🖼️</span>
                <span>View Image</span>
              </>
            )}
          </button>
        ) : (
          <img className="media-image" src={imageSrc} alt="Encrypted content" />
        )}
      </div>
    );
  };

  // --- Encrypted Video Player ---
  const EncryptedVideoPlayer = ({ url, contactId }) => {
    const [videoSrc, setVideoSrc] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadVideo = async () => {
      setLoading(true);
      try {
        const res = await fetch(url);
        const encryptedJson = await res.text();

        const secret = await getSecretKey(contactId);

        if (!secret) {
          setError("Unable to decrypt video (missing key)");
          return;
        }

        const decryptedBuffer = await decryptData(encryptedJson, secret, true);

        const blob = new Blob([decryptedBuffer], { type: "video/mp4" });
        setVideoSrc(URL.createObjectURL(blob));
      } catch (e) {
        console.error(e);
        setError("Failed to decrypt video");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="media-container">
        {error ? (
          <div className="media-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : !videoSrc ? (
          <button className="decrypt-media-btn" onClick={loadVideo} disabled={loading}>
            {loading ? (
              <>
                <span>⏳</span>
                <span>Loading...</span>
              </>
            ) : (
              <>
                <span>🎥</span>
                <span>Play Video</span>
              </>
            )}
          </button>
        ) : (
          <video className="media-video" controls src={videoSrc} />
        )}
      </div>
    );
  };

  // --- Encrypted File Download ---
  const EncryptedFileDownload = ({ url, contactId, fileName }) => {
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const downloadFile = async () => {
      setLoading(true);
      try {
        const res = await fetch(url);
        const encryptedJson = await res.text();

        const secret = await getSecretKey(contactId);

        if (!secret) {
          setError("Unable to decrypt file (missing key)");
          return;
        }

        const decryptedBuffer = await decryptData(encryptedJson, secret, true);

        const blob = new Blob([decryptedBuffer]);
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName || 'decrypted_file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      } catch (e) {
        console.error(e);
        setError("Failed to decrypt file");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="file-container">
        {error ? (
          <div className="media-error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        ) : (
          <button className="decrypt-file-btn" onClick={downloadFile} disabled={loading}>
            {loading ? (
              <>
                <span>⏳</span>
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>{fileName || 'Download File'}</span>
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  // --- Message Handling ---
  useEffect(() => {
    if (arrivalMessage) {
      if (currentChat && arrivalMessage.senderId === currentChat.customId) {
        setMessages((prev) => [...prev, arrivalMessage]);
      }
    }
  }, [arrivalMessage, currentChat]);

  // --- Fetch Chat History ---
  useEffect(() => {
    if (currentChat) {
      refreshMessages(currentChat.customId);
    }
  }, [currentChat, user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup typing timeout when chat changes or unmounts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [currentChat]);

  // --- Handlers ---
  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError("");
    setSearchResult(null);

    if (searchId === user.customId) {
      setSearchError("You cannot add yourself.");
      return;
    }

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
      const newContact = { ...searchResult, hasKeys: false };
      const newContacts = [...conversations, newContact];
      setConversations(newContacts);
      localStorage.setItem("myContacts", JSON.stringify(newContacts));

      setSearchId("");
      setSearchResult(null);
    }
  };

  const handleReceiveMessage = async (data) => {
    try {
      const secret = await getSecretKey(data.senderId);

      if (!secret) {
        console.error("Could not derive shared secret for sender:", data.senderId);
        setArrivalMessage({
          ...data,
          text: "⚠️ Unable to decrypt message (keys not exchanged)",
          createdAt: Date.now()
        });
        return;
      }

      let decryptedContent = "";

      if (data.type === "text") {
        decryptedContent = await decryptData(data.text, secret);
      } else {
        decryptedContent = data.text || "";
      }

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

    const sanitizedMessage = sanitizeText(newMessage.trim()).substring(0, 10000);

    if (!sanitizedMessage) {
      setError("Invalid message content");
      return;
    }

    // Stop typing indicator when message is sent
    socket.current.emit("typing", { receiverId: currentChat.customId, isTyping: false });

    try {
      const secret = await getSecretKey(currentChat.customId);

      if (!secret) {
        console.error("Cannot send message: Unable to derive shared secret");
        alert("Unable to encrypt message. Please exchange keys first.");
        return;
      }

      const encryptedText = await encryptData(sanitizedMessage, secret);

      const msg = {
        senderId: user.customId,
        receiverId: currentChat.customId,
        text: encryptedText,
        type: "text"
      };

      socket.current.emit("send_message", msg);

      setMessages([...messages, { ...msg, text: sanitizedMessage, createdAt: Date.now() }]);
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message. Please try again.");
    }
  };

  // Handle typing indicator
  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!currentChat || !socket.current) return;
    
    const isTyping = e.target.value.length > 0;
    
    // Send typing indicator
    socket.current.emit("typing", { receiverId: currentChat.customId, isTyping });
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator after 2 seconds of inactivity
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        socket.current.emit("typing", { receiverId: currentChat.customId, isTyping: false });
      }, 2000);
    }
  };

  // --- Export/Import Keys ---
  const exportKeys = () => {
    const allKeys = localStorage.getItem("contactKeys") || "{}";
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(allKeys);
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "encryption_keys_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importKeys = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        localStorage.setItem("contactKeys", JSON.stringify(imported));
        
        // Update hasKeys flags for all contacts that now have complete keys
        const contactIds = Object.keys(imported);
        const savedContacts = localStorage.getItem("myContacts");
        if (savedContacts) {
          const contacts = JSON.parse(savedContacts);
          const updatedContacts = contacts.map(contact => {
            const keys = imported[contact.customId];
            const hasCompleteKeys = keys && keys.myPrivateKey && keys.myPublicKey && keys.theirPublicKey;
            return { ...contact, hasKeys: hasCompleteKeys };
          });
          localStorage.setItem("myContacts", JSON.stringify(updatedContacts));
        }
        
        alert("Keys imported successfully!");
        window.location.reload();
      } catch (err) {
        alert("Failed to import keys. Invalid file format.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="chat-container" role="main">
      {/* Key Exchange Request Modal */}
      {pendingKeyRequest && (
        <div className="modal-overlay" role="dialog" aria-labelledby="key-exchange-title" aria-modal="true">
          <div className="modal-content">
            <h3 id="key-exchange-title">Key Exchange Request</h3>
            <p>User <strong>{pendingKeyRequest.fromUserId}</strong> wants to establish encrypted communication.</p>
            <div className="modal-actions">
              <button onClick={acceptKeyExchange} className="accept-btn" aria-label="Accept key exchange request">Accept</button>
              <button onClick={rejectKeyExchange} className="reject-btn" aria-label="Reject key exchange request">Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" role="dialog" aria-labelledby="settings-title" aria-modal="true">
          <div className="modal-content">
            <h3 id="settings-title">Settings</h3>
            <div className="settings-section">
              <h4>Encryption Keys</h4>
              <p>Backup and restore your encryption keys to access encrypted messages on other devices.</p>
              <div className="key-management">
                <button onClick={exportKeys} className="key-btn" aria-label="Export encryption keys">📥 Export Keys</button>
                <label className="key-btn" style={{ cursor: 'pointer' }} aria-label="Import encryption keys">
                  📤 Import Keys
                  <input type="file" accept=".json" onChange={importKeys} style={{ display: 'none' }} aria-label="Choose key file" />
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowSettings(false)} className="accept-btn" aria-label="Close settings">Close</button>
            </div>
          </div>
        </div>
      )}
                <label className="key-btn" style={{ cursor: 'pointer' }}>
                  📤 Import Keys
                  <input type="file" accept=".json" onChange={importKeys} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowSettings(false)} className="accept-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {keyExchangeStatus && (
        <div className="status-banner">{keyExchangeStatus}</div>
      )}

      {/* NAV RAIL */}
      <nav className="nav-rail" aria-label="Main navigation">
        <h2 className="nav-logo">Press Freely</h2>
        <div className="nav-spacer"></div>
        <div className="my-id-display" role="status" aria-label="Your user ID">My ID: <br /><strong>{user.customId}</strong></div>
        <button onClick={() => setShowSettings(true)} className="settings-btn" aria-label="Open settings">⚙️ Settings</button>
        <button onClick={onLogout} className="logout-btn" aria-label="Logout from application">Logout</button>
      </nav>

      {/* Upload Progress Indicator */}
      {uploadProgress && (
        <div className="upload-progress-overlay" role="alert" aria-live="polite">
          <div className="upload-progress-card">
            <h4>
              {uploadProgress.status === 'compressing' && '📦 Compressing...'}
              {uploadProgress.status === 'encrypting' && '🔐 Encrypting...'}
              {uploadProgress.status === 'uploading' && `📤 Uploading... ${uploadProgress.progress}%`}
            </h4>
            {uploadProgress.status === 'uploading' && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress.progress}%` }}></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTACT LIST + ADD USER */}
      <aside className="contact-list-panel" aria-label="Contact list">
        <div className="add-user-section">
          <h4>Add Contact</h4>
          <form onSubmit={handleSearch} className="search-form" aria-label="Search for contact">
            <input
              type="text"
              placeholder="Enter ID"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              aria-label="Enter contact ID"
            />
            <button type="submit" aria-label="Search contact">🔍</button>
          </form>

          {searchResult && (
            <div className="search-result" role="status">
              <span>Found: <b>{searchResult.username}</b></span>
              <button onClick={addContact} className="add-btn" aria-label={`Add ${searchResult.username} to contacts`}>Add</button>
            </div>
          )}
          {searchError && <div className="search-error" role="alert">{searchError}</div>}
        </div>

        <div className="conversations-list" role="list" aria-label="Your contacts">
          {conversations.length === 0 && <p className="no-contacts">No contacts yet.</p>}

          {conversations.map((c) => (
            <div
              key={c.customId}
              className={`contact-item ${currentChat?.customId === c.customId ? "selected" : ""}`}
              onClick={() => setCurrentChat(c)}
              role="listitem"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCurrentChat(c);
                }
              }}
              aria-label={`Chat with ${c.username}${c.isOnline ? ' (online)' : ' (offline)'}${!c.hasKeys ? ' - keys not exchanged' : ''}`}
            >
              <div className="avatar-wrapper">
                <div className="avatar" aria-hidden="true">{c.username.charAt(0).toUpperCase()}</div>
                {c.isOnline && <span className="online-dot" aria-label="Online"></span>}
                {!c.hasKeys && <span className="no-key-indicator" title="Keys not exchanged" aria-label="Keys not exchanged">🔒</span>}
              </div>
              <span className="contact-name">{c.username}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* CHAT AREA */}
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

        <audio ref={userAudio} autoPlay />

        {callAccepted && !callEnded ? (
          <div className="active-call-bar" role="status" aria-live="polite">
            <div className="call-info">
              <span>On Call with <b>{currentChat?.username || caller}</b></span>
              {networkQuality && (
                <span className="network-quality" title={formatNetworkQuality(networkQuality)}>
                  {networkQuality.quality === NetworkQuality.EXCELLENT && '🟢 Excellent'}
                  {networkQuality.quality === NetworkQuality.GOOD && '🟡 Good'}
                  {networkQuality.quality === NetworkQuality.FAIR && '🟠 Fair'}
                  {networkQuality.quality === NetworkQuality.POOR && '🔴 Poor'}
                </span>
              )}
            </div>
            <button className="end-call-btn" onClick={leaveCall} aria-label="End call">End Call</button>
          </div>
        ) : null}

        {currentChat ? (
          <>
            <div className="chat-header">
              <div className="header-info">
                To: <b>{currentChat.username}</b>
                {!currentChat.hasKeys && (
                  <button
                    onClick={() => initiateKeyExchange(currentChat.customId)}
                    className="exchange-keys-btn"
                    title="Exchange encryption keys"
                  >
                    🔑 Exchange Keys
                  </button>
                )}
              </div>

              <div className="header-actions">
                {currentChat.hasKeys && (
                  <button className="call-btn" onClick={() => callUser(currentChat.customId)}>
                    📞 Call
                  </button>
                )}
              </div>
            </div>

            <div className="chat-messages">
              {messages.map((m, index) => (
                <div key={index} ref={scrollRef} className={`message-wrapper ${m.senderId === user.customId ? "own" : "friend"}`}>
                  <div className="message-bubble">
                    {renderMessageContent(m)}
                    <div className="message-time">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
              {typingUser === currentChat?.customId && (
                <div className="typing-indicator">
                  <div className="typing-bubble">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              )}
            </div>

            {currentChat.hasKeys ? (
              <div className="chat-input-area" role="form" aria-label="Message input">
                <input
                  type="file"
                  id="file-upload"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
                  aria-label="Upload file"
                />
                <button
                  className="file-btn"
                  onClick={() => document.getElementById('file-upload').click()}
                  type="button"
                  title="Attach file"
                  aria-label="Attach file"
                >
                  📎
                </button>

                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                  aria-label="Type your message"
                />

                <button
                  className={`mic-btn ${isRecording ? "recording" : ""}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  type="button"
                  title={isRecording ? "Stop recording" : "Record audio"}
                  aria-label={isRecording ? "Stop audio recording" : "Start audio recording"}
                >
                  {isRecording ? "⬛" : "🎤"}
                </button>

                <button onClick={handleSubmit} className="send-btn" aria-label="Send message">Send</button>
              </div>
            ) : (
              <div className="no-keys-warning" role="alert">
                🔒 Exchange encryption keys to start messaging
              </div>
            )}
          </>
        ) : (
          <div className="no-chat">Select a contact to start chatting</div>
        )}
      </div>
    </div>
  );
}

export default ChatInterface;
