import { useState, useEffect } from "react";
import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [mode, setMode] = useState("login"); // login or signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (token) fetchHistory();
  }, [token]);

  const signup = async () => {
    const res = await fetch(
      `${API}/auth/signup?email=${email}&password=${password}`,
      {
        method: "POST",
      }
    );
    const data = await res.json();
    if (data.msg) {
      alert("Signup successful. Please login.");
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

  const fetchHistory = async () => {
    const res = await fetch(`${API}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (Array.isArray(data)) setHistory(data);
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

  if (!token) {
    return (
      <div className="app">
        <h1>{mode === "login" ? "Login" : "Signup"}</h1>

        <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />

        {mode === "login" ? (
          <>
            <button onClick={login}>Login</button>
            <p>
              No account?{" "}
              <span
                onClick={() => setMode("signup")}
                style={{ color: "blue", cursor: "pointer" }}
              >
                Signup
              </span>
            </p>
          </>
        ) : (
          <>
            <button onClick={signup}>Signup</button>
            <p>
              Already have an account?{" "}
              <span
                onClick={() => setMode("login")}
                style={{ color: "blue", cursor: "pointer" }}
              >
                Login
              </span>
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Data Drift Monitor</h1>

      <div className="card">
        <div className="upload-row">
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={upload}>Analyze</button>
        </div>
      </div>

      {result && (
        <div className="card">
          <h3>Analysis Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
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
