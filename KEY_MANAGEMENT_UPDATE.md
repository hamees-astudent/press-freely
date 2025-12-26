# Key Management System Update

## Overview

This update implements a per-contact key management system with end-to-end encryption. Each contact relationship now uses a unique public-private key pair, and keys are exchanged through a secure handshake mechanism.

## Key Changes

### 1. **Per-Contact Key Pairs**

- **Previous:** One global key pair generated during login
- **New:** A unique key pair is generated for each contact relationship
- **Storage:** All key pairs are stored in localStorage under `contactKeys`:

```json
{
  "contactId1": {
    "myPrivateKey": "...",
    "myPublicKey": "...",
    "theirPublicKey": "..."
  },
  "contactId2": { ... }
}
```

### 2. **Key Exchange Handshake**

Users must explicitly exchange keys before they can communicate:

1. User A clicks "Exchange Keys" button on User B's chat
2. User A generates a new key pair and sends their public key to User B
3. User B receives a modal prompt to accept or reject
4. If accepted, User B generates their own key pair and sends their public key back
5. Both users now have each other's public keys and can derive a shared secret

**Socket Events:**
- `request_key_exchange` - Initiates key exchange
- `respond_key_exchange` - Responds to key exchange request
- `key_exchange_request` - Received by target user
- `key_exchange_response` - Received by initiating user

### 3. **No Server-Side Key Storage**

- **Removed:** `publicKey` field from User model
- **Removed:** Public key validation and storage in auth routes
- Public keys are never sent to or stored on the server
- Keys are only exchanged peer-to-peer through socket connections

### 4. **No Key Generation During Login**

- Login/registration no longer generates cryptographic keys
- Users can log in and out without affecting their encryption keys
- Keys are only generated when establishing contact with someone

### 5. **Export/Import Functionality**

Users can now:
- **Export Keys:** Download all key pairs as `encryption_keys_backup.json`
- **Import Keys:** Upload a previously exported backup to restore keys

This allows users to:
- Backup their encryption keys
- Transfer keys between devices
- Recover keys after clearing browser data

## File Changes

### Backend

1. **`server/models/User.js`**
   - Removed `publicKey` field from schema

2. **`server/routes/auth.js`**
   - Removed `publicKey` validation
   - Removed public key storage during login/registration
   - Simplified authentication flow

3. **`server/routes/chat.js`**
   - Removed `publicKey` from user search results

4. **`server/socketHandler.js`**
   - Added `request_key_exchange` event handler
   - Added `respond_key_exchange` event handler
   - Added rate limiting for key exchange events

### Frontend

1. **`client/src/components/Login.jsx`**
   - Removed key generation during login
   - Removed public key transmission to server
   - Simplified login flow

2. **`client/src/components/ChatInterface.jsx`**
   - Complete rewrite with per-contact key management
   - Added key exchange UI and logic
   - Added `hasKeys` flag to contact objects
   - Added export/import key functionality
   - Modified message encryption to use contact-specific keys
   - Added visual indicators for contacts without keys
   - Added "Exchange Keys" button in chat header
   - Added key exchange request modal

3. **`client/src/components/ChatInterface.css`**
   - Added styles for key exchange modal
   - Added styles for status banner
   - Added styles for key management buttons
   - Added styles for no-keys warning
   - Added styles for key indicator badges

## User Experience Changes

### Before Starting a Conversation

1. User searches for and adds a contact
2. Contact appears in list with 🔒 indicator (no keys)
3. User clicks on contact to open chat
4. Chat shows "🔒 Exchange encryption keys to start messaging"
5. User clicks "🔑 Exchange Keys" button

### Key Exchange Process

1. Initiator sees: "Key exchange request sent to [contactId]"
2. Recipient sees modal: "User [contactId] wants to establish encrypted communication"
3. Recipient clicks "Accept" or "Reject"
4. Both users see: "Key exchange with [contactId] completed!"
5. 🔒 indicator disappears from contact
6. Chat input becomes available

### Messaging

- Messages can only be sent after keys are exchanged
- Voice calls require key exchange (for encrypting WebRTC signals)
- Audio messages require key exchange
- Old messages show "⚠️ Unable to decrypt (missing key)" if keys are lost

### Backup and Restore

1. **Export:** Click "📥 Export Keys" in nav rail → Downloads `encryption_keys_backup.json`
2. **Import:** Click "📤 Import Keys" → Select backup file → Keys restored

## Security Improvements

1. **Zero Server-Side Key Storage:** Server never sees or stores private keys or public keys
2. **Per-Contact Isolation:** Compromise of one key pair doesn't affect other conversations
3. **User Control:** Keys are only generated with explicit user action
4. **Backup Capability:** Users can backup keys without exposing them to third parties
5. **No Auto-Rotation:** Keys persist across login sessions (no unexpected loss of message history)

## Migration Notes

**Existing users will need to:**
1. Re-exchange keys with all existing contacts
2. Old messages may show as undecryptable if the old key system was in use
3. Export keys regularly to prevent data loss

**Database Migration:**
- No migration needed (publicKey field will simply be ignored by existing records)
- Consider running: `db.users.updateMany({}, { $unset: { publicKey: "" } })` to clean up

## Testing Checklist

- [ ] User can register/login without generating keys
- [ ] User can add contacts
- [ ] User can initiate key exchange
- [ ] User can accept/reject key exchange requests
- [ ] Messages are encrypted with contact-specific keys
- [ ] Audio messages are encrypted with contact-specific keys
- [ ] Voice calls work after key exchange
- [ ] Export keys downloads a valid JSON file
- [ ] Import keys restores functionality
- [ ] Keys persist across browser refresh
- [ ] 🔒 indicator shows for contacts without keys
- [ ] Chat input is disabled before key exchange
- [ ] Multiple contacts can have independent key pairs

## Known Limitations

1. **Device-Specific:** Keys are stored in localStorage, so each device needs separate key exchange
2. **No Key Verification:** No mechanism to verify key fingerprints (vulnerable to MITM if server is compromised)
3. **No Forward Secrecy:** Same key pair is used for all messages with a contact
4. **Browser-Dependent:** Clearing browser data loses keys (backup recommended)

## Future Enhancements

1. Add key fingerprint display and verification
2. Implement key rotation mechanism
3. Add end-to-end encryption for contact list
4. Implement Double Ratchet algorithm for forward secrecy
5. Add QR code-based key exchange for in-person verification
6. Implement key recovery through secure seed phrases
