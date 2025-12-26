# Message Re-encryption Feature

## Overview

Automatically re-encrypts old messages when keys are exchanged between contacts. This ensures that when users establish new encryption keys (either initial setup or key rotation), existing messages are seamlessly migrated to use the new encryption keys.

## How It Works

### Workflow

1. **Key Exchange Initiated**: When two users exchange keys
2. **Old Keys Preserved**: System temporarily stores the old keys
3. **New Keys Generated**: New key pair is created for the contact
4. **Message Detection**: System checks for existing messages between the two users
5. **Re-encryption Process**:
   - Fetches all messages from the database
   - Decrypts each message using the old key
   - Re-encrypts the same plaintext using the new key
   - Updates the message in the database
6. **Status Feedback**: User sees progress messages during re-encryption

### Implementation Details

#### Backend Changes

**New API Endpoint** (`server/routes/chat.js`):
```javascript
PUT /api/chat/messages/:messageId
```

- Updates the encrypted text content of a message
- Validates that the user is either sender or receiver
- Used exclusively for re-encryption purposes

**Security Checks:**
- User must be authenticated (JWT token)
- User must be either the sender or receiver of the message
- Only text content can be updated

#### Frontend Changes

**New Helper Function** (`client/src/components/ChatInterface.jsx`):
```javascript
reEncryptOldMessages(contactId, oldKeys, newSecret)
```

**Process:**
1. Fetches all messages between current user and contact
2. Attempts to derive old secret key from old key pair
3. Decrypts each message with old key
4. Re-encrypts with new secret key
5. Updates each message on the server
6. Shows progress to user

**Integration Points:**
- `handleKeyExchangeResponse`: When receiving key exchange completion
- `acceptKeyExchange`: When accepting a key exchange request

### User Experience

#### Status Messages

Users see real-time feedback during the process:

1. `"Key exchange with [userId] completed!"` - Initial success
2. `"Re-encrypting X messages..."` - Processing indicator
3. `"Re-encrypted X messages successfully!"` - Completion confirmation

#### Scenarios

**Scenario 1: First Key Exchange**
- No old keys exist
- No re-encryption needed
- Regular key exchange flow

**Scenario 2: Key Re-exchange (Rotation)**
- Old keys exist and old messages present
- System automatically re-encrypts all messages
- Transparent to user - just sees status updates

**Scenario 3: No Messages**
- Keys are exchanged but no previous messages
- Re-encryption skipped
- No status shown

### Technical Considerations

#### Performance

- Re-encryption runs asynchronously after key exchange
- Does not block user interface
- Processes messages sequentially to avoid overwhelming server
- Large message histories may take time

#### Error Handling

- Continues on individual message failures
- Logs errors to console
- Successfully re-encrypted count shown to user
- Failed messages remain encrypted with old key (manual retry needed)

#### Limitations

1. **Audio Messages**: Currently only text messages are re-encrypted (audio file URLs remain unchanged)
2. **One-way Process**: Cannot revert to old keys after re-encryption
3. **Both Users Must Exchange**: Each user must exchange keys independently for their local copy

### Security Implications

#### Benefits

- **Key Rotation**: Supports periodic key rotation for enhanced security
- **Forward Secrecy**: Old keys can be discarded after re-encryption
- **Seamless Migration**: Users don't lose access to old messages

#### Considerations

- **Temporary Key Storage**: Old keys briefly exist in memory during re-encryption
- **Network Transmission**: Re-encrypted messages sent to server (still encrypted)
- **Database Updates**: Messages are modified in place (original ciphertext replaced)

### Testing

#### Test Cases

1. **No Old Messages**: Exchange keys with new contact → No re-encryption
2. **With Old Messages**: Exchange keys with existing chat → Messages re-encrypted
3. **Failed Decryption**: Message can't be decrypted with old key → Skipped
4. **Network Error**: Update fails → Message remains with old encryption
5. **Concurrent Messages**: New messages during re-encryption → Handled separately

#### Manual Testing

```bash
# 1. Create messages with old keys
# 2. Initiate key exchange
# 3. Accept key exchange
# 4. Check console for re-encryption logs
# 5. Verify messages still readable
# 6. Check database for updated ciphertext
```

### Future Enhancements

1. **Audio File Re-encryption**: Extend to audio messages
2. **Batch Processing**: Process messages in batches for better performance
3. **Progress Bar**: Visual progress indicator for large histories
4. **Retry Mechanism**: Automatic retry for failed re-encryptions
5. **Backup**: Option to backup old ciphertext before re-encryption
6. **Verification**: Verify successful decryption after re-encryption

### API Documentation

#### Update Message Endpoint

**Request:**
```http
PUT /api/chat/messages/:messageId
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "text": "{\"iv\":[...],\"content\":[...]}"
}
```

**Response:**
```http
200 OK
{
  "message": "Message updated successfully"
}
```

**Error Responses:**
```http
400 Bad Request - Invalid text content
403 Forbidden - Not authorized to update this message
404 Not Found - Message not found
500 Internal Server Error - Server error
```

### Monitoring

#### Console Logs

- `"Re-encrypting X messages..."` - Process started
- `"Successfully re-encrypted X messages"` - Process completed
- `"Failed to re-encrypt message [id]"` - Individual failure
- `"No old messages to re-encrypt"` - No messages found
- `"No old keys available, cannot re-encrypt"` - Missing old keys

#### User Feedback

- Status banner shows re-encryption progress
- Banner auto-dismisses after 3 seconds
- Errors logged to console for debugging

### Deployment Notes

1. **Backward Compatibility**: Works with existing messages
2. **Database Impact**: Updates messages in place (no schema changes)
3. **Performance**: May cause brief server load during re-encryption
4. **Rollback**: No automatic rollback (consider backing up database)

---

## Summary

The message re-encryption feature ensures seamless key rotation by automatically migrating existing encrypted messages to use new encryption keys when users exchange keys. This happens transparently in the background with user feedback, maintaining message history integrity while supporting enhanced security practices.
