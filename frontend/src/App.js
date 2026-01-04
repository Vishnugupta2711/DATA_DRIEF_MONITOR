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
  const [compareResult, setCompareResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

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
    setIsLoading(true);
    const res = await fetch(
      `${API}/auth/signup?email=${email}&password=${password}`,
      { method: "POST" }
    );
    const data = await res.json();
    setIsLoading(false);
    if (data.msg) {
      alert("Signup successful! Please login.");
      setMode("login");
    } else alert(data.detail || "Signup failed");
  };

  const login = async () => {
    setIsLoading(true);
    const res = await fetch(
      `${API}/auth/login?email=${email}&password=${password}`,
      { method: "POST" }
    );
    const data = await res.json();
    setIsLoading(false);
    if (data.access_token) {
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
    } else alert(data.detail || "Login failed");
  };

  const upload = async () => {
    if (!file) return alert("Select a file first");

    setIsLoading(true);
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API}/analyze?dataset_name=${dataset}`, {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    setIsLoading(false);
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
    // Clear comparison if deleted snapshot was in compare list
    if (compare.includes(id)) {
      setCompare(compare.filter((x) => x !== id));
      setCompareResult(null);
    }
    fetchHistory();
  };

  const compareSnapshots = async () => {
    if (compare.length !== 2) return alert("Select exactly 2 snapshots");
    setIsLoading(true);
    const res = await fetch(`${API}/compare?a=${compare[0]}&b=${compare[1]}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setIsLoading(false);
    setCompareResult(data);
  };

  const toggleCompare = (id) => {
    setCompareResult(null); // Clear previous comparison
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
    setCompareResult(null);
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="animated-bg">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>
        <div className="auth-card">
          <div className="logo-container">
            <div className="logo-icon">
              <div className="pulse-ring"></div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1>Data Drift Monitor</h1>
            <p className="subtitle">Real-time data quality tracking</p>
          </div>

          <div className="auth-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => setMode("signup")}
            >
              Signup
            </button>
          </div>

          <div className="input-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="styled-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="styled-input"
            />
          </div>

          <button
            className={`primary-btn ${isLoading ? "loading" : ""}`}
            onClick={mode === "login" ? login : signup}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="spinner"></span>
            ) : mode === "login" ? (
              "Login"
            ) : (
              "Create Account"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="animated-bg">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="top-bar">
        <div className="logo-section">
          <div className="logo-icon-small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                strokeWidth="2"
              />
            </svg>
          </div>
          <h1>Data Drift Monitor</h1>
        </div>
        <button className="logout-btn" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Logout
        </button>
      </div>

      <div className="container">
        <div className="card upload-card">
          <div className="card-header">
            <h3>Upload Dataset</h3>
          </div>
          <div className="card-content">
            <input
              placeholder="Dataset name"
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              className="styled-input"
            />
            <div className="upload-area">
              <input
                type="file"
                id="file-upload"
                onChange={(e) => setFile(e.target.files[0])}
                className="file-input"
              />
              <label htmlFor="file-upload" className="file-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {file ? file.name : "Choose file"}
              </label>
              <button
                className={`analyze-btn ${isLoading ? "loading" : ""}`}
                onClick={upload}
                disabled={isLoading}
              >
                {isLoading ? <span className="spinner"></span> : "Analyze"}
              </button>
            </div>
          </div>
        </div>

        {history.length > 1 && (
          <div className="card chart-card">
            <div className="card-header">
              <h3>Drift Trend</h3>
            </div>
            <div className="card-content">
              <DriftChart labels={trendLabels} values={trendValues} />
            </div>
          </div>
        )}

        {result && (
          <div className="card result-card">
            <div className="card-header">
              <h3>Analysis Result</h3>
            </div>
            <div className="card-content">
              <div className="result-stats">
                <div className="stat-item">
                  <span className="stat-label">Score</span>
                  <span className="stat-value">{result.score}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Severity</span>
                  <span className={`badge ${result.severity}`}>
                    {result.severity}
                  </span>
                </div>
              </div>
              <div className="drift-list">
                {result.drift.length === 0 ? (
                  <div className="no-drift">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    No drift detected
                  </div>
                ) : (
                  result.drift.map((d, i) => (
                    <div key={i} className="drift-item">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {d}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card history-card">
          <div className="card-header">
            <h3>Snapshot History</h3>
            {compare.length === 2 && (
              <button
                className={`compare-btn ${isLoading ? "loading" : ""}`}
                onClick={compareSnapshots}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="spinner"></span>
                ) : (
                  "Compare Selected"
                )}
              </button>
            )}
          </div>
          <div className="card-content">
            <ul className="history-list">
              {history.map((h) => (
                <li key={h.id} className="history-item">
                  <input
                    type="checkbox"
                    checked={compare.includes(h.id)}
                    onChange={() => toggleCompare(h.id)}
                    className="history-checkbox"
                  />
                  <div
                    className="history-info"
                    onClick={() => loadSnapshot(h.id)}
                  >
                    <span className="history-name">
                      {h.dataset_name || "Dataset"}
                    </span>
                    <span className="history-time">
                      {new Date(h.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <span className={`badge ${h.drift_severity}`}>
                    {h.drift_severity}
                  </span>
                  <div className="history-actions">
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        window.open(
                          `${API}/report/${h.id}?format=pdf`,
                          "_blank"
                        )
                      }
                      title="Download PDF Report"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      PDF
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        window.open(
                          `${API}/report/${h.id}?format=csv`,
                          "_blank"
                        )
                      }
                      title="Download CSV Report"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      CSV
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => deleteSnapshot(h.id)}
                      title="Delete Snapshot"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {compareResult && (
          <div className="card comparison-card">
            <div className="card-header">
              <h3>Comparison Results</h3>
              <button
                className="close-btn"
                onClick={() => setCompareResult(null)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="card-content">
              <div className="comparison-grid">
                <div className="comparison-section">
                  <h4>Snapshot A</h4>
                  <div className="comparison-details">
                    <div className="detail-row">
                      <span className="detail-label">Dataset:</span>
                      <span className="detail-value">
                        {compareResult.snapshot_a?.dataset_name || "N/A"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Timestamp:</span>
                      <span className="detail-value">
                        {compareResult.snapshot_a?.timestamp
                          ? new Date(
                              compareResult.snapshot_a.timestamp
                            ).toLocaleString()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Drift Score:</span>
                      <span className="detail-value">
                        {compareResult.snapshot_a?.drift_score || "N/A"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Severity:</span>
                      <span
                        className={`badge ${
                          compareResult.snapshot_a?.drift_severity || "low"
                        }`}
                      >
                        {compareResult.snapshot_a?.drift_severity || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="comparison-divider">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="comparison-section">
                  <h4>Snapshot B</h4>
                  <div className="comparison-details">
                    <div className="detail-row">
                      <span className="detail-label">Dataset:</span>
                      <span className="detail-value">
                        {compareResult.snapshot_b?.dataset_name || "N/A"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Timestamp:</span>
                      <span className="detail-value">
                        {compareResult.snapshot_b?.timestamp
                          ? new Date(
                              compareResult.snapshot_b.timestamp
                            ).toLocaleString()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Drift Score:</span>
                      <span className="detail-value">
                        {compareResult.snapshot_b?.drift_score || "N/A"}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Severity:</span>
                      <span
                        className={`badge ${
                          compareResult.snapshot_b?.drift_severity || "low"
                        }`}
                      >
                        {compareResult.snapshot_b?.drift_severity || "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {compareResult.differences && (
                <div className="differences-section">
                  <h4>Key Differences</h4>
                  <div className="differences-list">
                    {typeof compareResult.differences === "object" ? (
                      Object.entries(compareResult.differences).map(
                        ([key, value]) => (
                          <div key={key} className="difference-item">
                            <span className="difference-key">{key}:</span>
                            <span className="difference-value">
                              {JSON.stringify(value)}
                            </span>
                          </div>
                        )
                      )
                    ) : (
                      <p className="difference-text">
                        {compareResult.differences}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="comparison-raw">
                <details>
                  <summary>View Raw Comparison Data</summary>
                  <pre className="details-json">
                    {JSON.stringify(compareResult, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        )}

        {selected && (
          <div className="card details-card">
            <div className="card-header">
              <h3>Snapshot Details</h3>
              <button className="close-btn" onClick={() => setSelected(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="card-content">
              <pre className="details-json">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
