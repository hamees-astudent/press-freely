// client/src/e2e.js

// 1. Generate Key Pair (ECDH P-256)
export const generateKeyPair = async () => {
    return await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
    );
};

// 2. Export Key (to send Public Key to server)
export const exportKey = async (key) => {
    const exported = await window.crypto.subtle.exportKey("jwk", key);
    return JSON.stringify(exported);
};

// 3. Import Key (to load keys from storage or server)
export const importKey = async (jwkStr, type = "public") => {
    const jwk = JSON.parse(jwkStr);
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        type === "public" ? [] : ["deriveKey"]
    );
};

// 4. Derive Shared Secret (AES-GCM Key)
// Combine My Private Key + Their Public Key
export const deriveSecretKey = async (privateKey, publicKey) => {
    return await window.crypto.subtle.deriveKey(
        { name: "ECDH", public: publicKey },
        privateKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
};

// 5. Encrypt Data (Text or ArrayBuffer)
export const encryptData = async (data, secretKey) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Random IV
    const encodedData = typeof data === "string"
        ? new TextEncoder().encode(data)
        : data;

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        secretKey,
        encodedData
    );

    // Return IV + Ciphertext as a JSON string for transport
    const bufferArray = Array.from(new Uint8Array(encryptedBuffer));
    const ivArray = Array.from(iv);

    return JSON.stringify({ iv: ivArray, content: bufferArray });
};

// 6. Decrypt Data
export const decryptData = async (encryptedJson, secretKey, isFile = false) => {
    try {
        const { iv, content } = JSON.parse(encryptedJson);
        const ivArr = new Uint8Array(iv);
        const contentArr = new Uint8Array(content);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivArr },
            secretKey,
            contentArr
        );

        if (isFile) return decryptedBuffer; // Return ArrayBuffer for audio
        return new TextDecoder().decode(decryptedBuffer); // Return string for text
    } catch (err) {
        console.error("Decryption failed", err);
        return "[Encrypted Message]";
    }
};