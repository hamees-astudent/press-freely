import axios from "axios";
import { useState } from "react";
import { sanitizeUsername } from "../utils/sanitize";

// API configuration
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
axios.defaults.baseURL = API_URL;

function Login({ onLogin }) {
    const [username, setUsername] = useState("");
    const [passphrase, setPassphrase] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            // Sanitize username
            const sanitizedUsername = sanitizeUsername(username.trim());

            // Input validation
            if (sanitizedUsername.length < 3 || sanitizedUsername.length > 30) {
                throw new Error("Username must be between 3 and 30 characters");
            }

            if (passphrase.length < 8) {
                throw new Error("Passphrase must be at least 8 characters");
            }

            if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedUsername)) {
                throw new Error("Username can only contain letters, numbers, underscores and hyphens");
            }

            // Send to Server (no key generation during login)
            const res = await axios.post("/api/auth/login", {
                username: sanitizedUsername,
                passphrase
            });

            onLogin(res.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || err.message || "Login failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2>Chat Login</h2>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={styles.input}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Secret Passphrase"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        style={styles.input}
                        required
                    />
                    <button type="submit" style={styles.button} disabled={isLoading}>
                        {isLoading ? "Logging in..." : "Enter Chat"}
                    </button>
                </form>
                {error && <p style={styles.error}>{error}</p>}
            </div>
        </div>
    );
}

// Simple internal CSS for speed
const styles = {
    container: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f4f4f9" },
    card: { padding: "2rem", backgroundColor: "white", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", textAlign: "center" },
    form: { display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" },
    input: { padding: "10px", borderRadius: "4px", border: "1px solid #ddd", fontSize: "16px" },
    button: { padding: "10px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "16px" },
    error: { color: "red", marginTop: "10px" }
};

export default Login;