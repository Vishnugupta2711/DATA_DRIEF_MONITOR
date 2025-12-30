import { useState, useEffect, useCallback } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchHistory = useCallback(async () => {
    const res = await fetch(`${API}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (Array.isArray(data)) setHistory(data);
  }, [token]);

  useEffect(() => {
    if (token) fetchHistory();
  }, [token, fetchHistory]);

  const signup = async () => {
    const res = await fetch(
      `${API}/auth/signup?email=${email}&password=${password}`,
      {
        method: "POST",
      }
    );
    const data = await res.json();
    if (data.msg) {
      alert("Signup successful! Please login.");
      setMode("login");
    } else {
      alert(data.detail || "Signup failed");
    }
  };

  const login = async () => {
    const res = await fetch(
      `${API}/auth/login?email=${email}&password=${password}`,
      {
        method: "POST",
      }
    );
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
    } else {
      alert(data.detail || "Login failed");
    }
  };

  const upload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API}/analyze`, {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setResult(data);
    fetchHistory();
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    setHistory([]);
    setResult(null);
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1>Data Drift Monitor</h1>
          <h3>{mode === "login" ? "Login" : "Signup"}</h3>

          <input
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />

          {mode === "login" ? (
            <>
              <button onClick={login}>Login</button>
              <p onClick={() => setMode("signup")}>No account? Signup</p>
            </>
          ) : (
            <>
              <button onClick={signup}>Signup</button>
              <p onClick={() => setMode("login")}>
                Already have an account? Login
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="top-bar">
        <h1>Data Drift Monitor</h1>
        <button className="logout" onClick={logout}>
          Logout
        </button>
      </div>

      <div className="card">
        <div className="upload-row">
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={upload}>Analyze</button>
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>Analysis Result</h3>
          <div className="result-box">
            {result.drift.length === 0 ? (
              <p className="no-drift">No drift detected ✅</p>
            ) : (
              result.drift.map((d, i) => (
                <p key={i} className="drift">
                  ⚠ {d}
                </p>
              ))
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h3>Snapshot History</h3>
        <ul className="history-list">
          {history.map((h) => (
            <li key={h.id}>
              <strong>{h.id.slice(0, 8)}</strong> —{" "}
              {new Date(h.timestamp).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
