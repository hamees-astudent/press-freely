import { useEffect, useState } from "react";
import axios from "axios";
import ChatInterface from "./components/ChatInterface"; // Import the new component
import Login from "./components/Login";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("chatUser");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem("chatUser", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("chatUser");
    // Destroy access token
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <div className="App">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        // Render the real interface now
        <ChatInterface user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;