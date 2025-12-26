# Quick Reference - Key Management API

## LocalStorage Structure

### Contact Keys
```javascript
// Get all keys
const allKeys = JSON.parse(localStorage.getItem("contactKeys") || "{}");

// Get specific contact keys
const keys = allKeys[contactId];
// Returns: { myPrivateKey, myPublicKey, theirPublicKey }

// Save contact keys
allKeys[contactId] = { myPrivateKey, myPublicKey, theirPublicKey };
localStorage.setItem("contactKeys", JSON.stringify(allKeys));
```

### Contact List
```javascript
// Get contacts
const contacts = JSON.parse(localStorage.getItem("myContacts") || "[]");

// Contact structure
{
  customId: "123456789012",
  username: "alice",
  isOnline: true,
  hasKeys: false  // true after key exchange
}
```

## Socket Events

### Client → Server

#### Request Key Exchange
```javascript
socket.emit("request_key_exchange", {
  targetUserId: "123456789012",
  publicKey: "..." // JWK string
});
```

#### Respond to Key Exchange
```javascript
socket.emit("respond_key_exchange", {
  targetUserId: "123456789012",
  publicKey: "...", // JWK string (null if rejected)
  accepted: true    // boolean
});
```

### Server → Client

#### Receive Key Exchange Request
```javascript
socket.on("key_exchange_request", ({ fromUserId, publicKey }) => {
  // Show modal to user
  // Save request in state
});
```

#### Receive Key Exchange Response
```javascript
socket.on("key_exchange_response", ({ fromUserId, publicKey, accepted }) => {
  if (accepted) {
    // Save their public key
    // Mark contact as hasKeys: true
  } else {
    // Show rejection message
  }
});
```

## Cryptographic Functions

### Generate Key Pair
```javascript
import { generateKeyPair, exportKey } from "../e2e";

const keyPair = await generateKeyPair();
const privateKeyJwk = await exportKey(keyPair.privateKey);
const publicKeyJwk = await exportKey(keyPair.publicKey);
```

### Derive Shared Secret
```javascript
import { importKey, deriveSecretKey } from "../e2e";

const myPrivateKey = await importKey(privateKeyJwk, "private");
const theirPublicKey = await importKey(theirPublicKeyJwk, "public");
const sharedSecret = await deriveSecretKey(myPrivateKey, theirPublicKey);
```

### Encrypt Message
```javascript
import { encryptData } from "../e2e";

const encryptedText = await encryptData(plainText, sharedSecret);
// Returns: JSON string with { iv, content }
```

### Decrypt Message
```javascript
import { decryptData } from "../e2e";

const plainText = await decryptData(encryptedJson, sharedSecret);
// For files: await decryptData(encryptedJson, sharedSecret, true)
```

## Component Methods

### ChatInterface Key Management

#### Get Contact Keys
```javascript
const getContactKeys = (contactId) => {
  const allKeys = JSON.parse(localStorage.getItem("contactKeys") || "{}");
  return allKeys[contactId] || null;
};
```

#### Save Contact Keys
```javascript
const saveContactKeys = (contactId, keys) => {
  const allKeys = JSON.parse(localStorage.getItem("contactKeys") || "{}");
  allKeys[contactId] = keys;
  localStorage.setItem("contactKeys", JSON.stringify(allKeys));
};
```

#### Get or Derive Secret Key (with caching)
```javascript
const getSecretKey = async (contactId) => {
  // Check cache
  if (sharedKeys[contactId]) return sharedKeys[contactId];
  
  // Get stored keys
  const keys = getContactKeys(contactId);
  if (!keys || !keys.myPrivateKey || !keys.theirPublicKey) {
    return null;
  }
  
  // Import and derive
  const myPrivateKey = await importKey(keys.myPrivateKey, "private");
  const theirPublicKey = await importKey(keys.theirPublicKey, "public");
  const secret = await deriveSecretKey(myPrivateKey, theirPublicKey);
  
  // Cache it
  setSharedKeys(prev => ({ ...prev, [contactId]: secret }));
  return secret;
};
```

### Key Exchange Flow

#### Initiate Key Exchange
```javascript
const initiateKeyExchange = async (contactId) => {
  // 1. Generate new key pair
  const keyPair = await generateKeyPair();
  const myPrivateKey = await exportKey(keyPair.privateKey);
  const myPublicKey = await exportKey(keyPair.publicKey);
  
  // 2. Save our keys (without their public key yet)
  saveContactKeys(contactId, {
    myPrivateKey,
    myPublicKey,
    theirPublicKey: null
  });
  
  // 3. Send request
  socket.current.emit("request_key_exchange", {
    targetUserId: contactId,
    publicKey: myPublicKey
  });
};
```

#### Accept Key Exchange
```javascript
const acceptKeyExchange = async () => {
  const { fromUserId, publicKey } = pendingKeyRequest;
  
  // 1. Generate new key pair
  const keyPair = await generateKeyPair();
  const myPrivateKey = await exportKey(keyPair.privateKey);
  const myPublicKey = await exportKey(keyPair.publicKey);
  
  // 2. Save all keys
  saveContactKeys(fromUserId, {
    myPrivateKey,
    myPublicKey,
    theirPublicKey: publicKey
  });
  
  // 3. Send response
  socket.current.emit("respond_key_exchange", {
    targetUserId: fromUserId,
    publicKey: myPublicKey,
    accepted: true
  });
  
  // 4. Update UI
  setPendingKeyRequest(null);
  // Mark contact as hasKeys: true
};
```

### Export/Import

#### Export Keys
```javascript
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
```

#### Import Keys
```javascript
const importKeys = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      localStorage.setItem("contactKeys", JSON.stringify(imported));
      alert("Keys imported successfully!");
      window.location.reload();
    } catch (err) {
      alert("Failed to import keys. Invalid file format.");
    }
  };
  reader.readAsText(file);
};
```

## UI Components

### Key Exchange Modal
```jsx
{pendingKeyRequest && (
  <div className="modal-overlay">
    <div className="modal-content">
      <h3>Key Exchange Request</h3>
      <p>User <strong>{pendingKeyRequest.fromUserId}</strong> wants to establish encrypted communication.</p>
      <div className="modal-actions">
        <button onClick={acceptKeyExchange} className="accept-btn">Accept</button>
        <button onClick={rejectKeyExchange} className="reject-btn">Reject</button>
      </div>
    </div>
  </div>
)}
```

### Status Banner
```jsx
{keyExchangeStatus && (
  <div className="status-banner">{keyExchangeStatus}</div>
)}
```

### Exchange Keys Button
```jsx
{!currentChat.hasKeys && (
  <button 
    onClick={() => initiateKeyExchange(currentChat.customId)} 
    className="exchange-keys-btn"
  >
    🔑 Exchange Keys
  </button>
)}
```

### No Keys Indicator
```jsx
{!contact.hasKeys && (
  <span className="no-key-indicator" title="Keys not exchanged">🔒</span>
)}
```

## Common Patterns

### Check if Keys Exist Before Action
```javascript
const handleAction = async () => {
  const secret = await getSecretKey(contactId);
  if (!secret) {
    alert("Please exchange keys first");
    return;
  }
  // Proceed with action
};
```

### Update Contact hasKeys Flag
```javascript
setConversations(prev => {
  const updated = prev.map(c => 
    c.customId === contactId ? { ...c, hasKeys: true } : c
  );
  localStorage.setItem("myContacts", JSON.stringify(updated));
  return updated;
});
```

### Show Decryption Error
```javascript
try {
  const decrypted = await decryptData(encrypted, secret);
  return decrypted;
} catch (err) {
  console.error("Decryption failed:", err);
  return "⚠️ Unable to decrypt";
}
```

## Troubleshooting

### Keys Not Found
```javascript
const keys = getContactKeys(contactId);
if (!keys) {
  console.error("No keys for contact:", contactId);
  // Prompt user to exchange keys
}
```

### Missing Public Key
```javascript
if (!keys.theirPublicKey) {
  console.error("Key exchange not completed");
  // Re-initiate key exchange
}
```

### Decryption Failed
```javascript
try {
  const plaintext = await decryptData(ciphertext, secret);
} catch (err) {
  console.error("Decryption error:", err);
  // Show error message to user
  // Possible causes:
  // - Wrong keys
  // - Corrupted data
  // - Key exchange not completed
}
```

## Security Notes

1. **Never send private keys** over the network
2. **Always validate** keys exist before encryption
3. **Cache derived secrets** for performance
4. **Clear sensitive data** from memory when done
5. **Validate file uploads** when importing keys
6. **Use HTTPS** in production to prevent MITM
7. **Rate limit** key exchange requests

## Performance Tips

1. Cache derived secrets in component state
2. Generate keys on background thread if available
3. Batch key imports/exports
4. Clear unused keys from cache periodically
5. Use lazy loading for key derivation
