import { useState, useEffect, useCallback } from "react";
import "./App.css";
import DriftChart from "./components/DriftChart";

const API = "http://127.0.0.1:8000";

function App() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [file, setFile] = useState(null);
  const [dataset, setDataset] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [compare, setCompare] = useState([]);

  const trendLabels = history
    .slice()
    .reverse()
    .map((h) => new Date(h.timestamp).toLocaleTimeString());

  const trendValues = history
    .slice()
    .reverse()
    .map((h) => h.drift_score || 0);

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
      { method: "POST" }
    );
    const data = await res.json();
    if (data.msg) {
      alert("Signup successful! Please login.");
      setMode("login");
    } else alert(data.detail || "Signup failed");
  };

  const login = async () => {
    const res = await fetch(
      `${API}/auth/login?email=${email}&password=${password}`,
      { method: "POST" }
    );
    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
    } else alert(data.detail || "Login failed");
  };

  const upload = async () => {
    if (!file) return alert("Select a file first");

    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API}/analyze?dataset_name=${dataset}`, {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setResult(data);
    fetchHistory();
  };

  const loadSnapshot = async (id) => {
    const res = await fetch(`${API}/snapshot/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setSelected(data);
  };

  const deleteSnapshot = async (id) => {
    if (!window.confirm("Delete this snapshot?")) return;
    await fetch(`${API}/snapshot/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchHistory();
  };

  const compareSnapshots = async () => {
    if (compare.length !== 2) return alert("Select exactly 2 snapshots");
    const res = await fetch(`${API}/compare?a=${compare[0]}&b=${compare[1]}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
  };

  const toggleCompare = (id) => {
    if (compare.includes(id)) {
      setCompare(compare.filter((x) => x !== id));
    } else if (compare.length < 2) {
      setCompare([...compare, id]);
    } else {
      alert("You can compare only 2 snapshots");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    setHistory([]);
    setResult(null);
    setSelected(null);
    setCompare([]);
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
        <input
          placeholder="Dataset name"
          value={dataset}
          onChange={(e) => setDataset(e.target.value)}
        />
        <div className="upload-row">
          <input type="file" onChange={(e) => setFile(e.target.files[0])} />
          <button onClick={upload}>Analyze</button>
        </div>
      </div>

      {history.length > 1 && (
        <div className="card">
          <h3>Drift Trend</h3>
          <DriftChart labels={trendLabels} values={trendValues} />
        </div>
      )}

      {result && (
        <div className="card">
          <h3>Analysis Result</h3>
          <p>
            <strong>Score:</strong> {result.score}
          </p>
          <p>
            <strong>Severity:</strong>{" "}
            <span className={`badge ${result.severity}`}>
              {result.severity}
            </span>
          </p>
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
              <input
                type="checkbox"
                checked={compare.includes(h.id)}
                onChange={() => toggleCompare(h.id)}
              />
              <span onClick={() => loadSnapshot(h.id)}>
                {h.dataset_name || "Dataset"} —{" "}
                {new Date(h.timestamp).toLocaleString()}
              </span>
              <span className={`badge ${h.drift_severity}`}>
                {h.drift_severity}
              </span>
              <button onClick={() => deleteSnapshot(h.id)}>🗑</button>
            </li>
          ))}
        </ul>
        {compare.length === 2 && (
          <button onClick={compareSnapshots}>Compare</button>
        )}
      </div>

      {selected && (
        <div className="card">
          <h3>Snapshot Details</h3>
          <pre className="result-box">{JSON.stringify(selected, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
