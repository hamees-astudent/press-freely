import axios from "axios";
import { useState } from "react";

function Login({ onLogin }) {
    const [username, setUsername] = useState("");
    const [passphrase, setPassphrase] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            // Connect to your Node.js backend
            const res = await axios.post("http://localhost:5000/api/auth/login", {
                username,
                passphrase,
            });

            // If successful, the backend returns the user object with 'customId'
            console.log("Login Success:", res.data);

            // Pass the user data up to App.js
            onLogin(res.data);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Login failed");
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
                    <button type="submit" style={styles.button}>Enter Chat</button>
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