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
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const trendLabels = history
    .slice()
    .reverse()
    .map((h) => new Date(h.timestamp).toLocaleTimeString());

  const trendValues = history
    .slice()
    .reverse()
    .map((h) => h.drift_score || 0);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);
      }
    } catch (error) {
      console.error("Fetch history error:", error);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchHistory();
  }, [token, fetchHistory]);

  const signup = async () => {
    if (!email.trim() || !password.trim()) {
      alert("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${API}/auth/signup?email=${encodeURIComponent(
          email
        )}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );
      const data = await res.json();

      if (res.ok && data.msg) {
        alert("Signup successful! Please login.");
        setMode("login");
        setPassword("");
      } else {
        alert(data.detail || "Signup failed. Please try again.");
      }
    } catch (error) {
      alert("Signup failed. Please check your connection and try again.");
      console.error("Signup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    if (!email.trim() || !password.trim()) {
      alert("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${API}/auth/login?email=${encodeURIComponent(
          email
        )}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );
      const data = await res.json();

      if (res.ok && data.access_token) {
        localStorage.setItem("token", data.access_token);
        setToken(data.access_token);
      } else {
        alert(data.detail || "Login failed. Please check your credentials.");
      }
    } catch (error) {
      alert("Login failed. Please check your connection and try again.");
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const upload = async () => {
    if (!file) {
      alert("Please select a file first");
      return;
    }
    if (!dataset.trim()) {
      alert("Please enter a dataset name");
      return;
    }

    setIsLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(
        `${API}/analyze?dataset_name=${encodeURIComponent(dataset.trim())}`,
        {
          method: "POST",
          body: form,
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      setResult(data);
      setFile(null);
      await fetchHistory();
      showNotification("Dataset analyzed successfully!");
    } catch (error) {
      alert("Failed to analyze file. Please try again.");
      console.error("Upload error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSnapshot = async (id) => {
    try {
      const res = await fetch(`${API}/snapshot/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load snapshot");
      const data = await res.json();
      setSelected(data);
    } catch (error) {
      alert("Failed to load snapshot details. Please try again.");
      console.error("Load snapshot error:", error);
    }
  };

  const deleteSnapshot = async (id) => {
    if (!window.confirm("Are you sure you want to delete this snapshot?"))
      return;

    try {
      const res = await fetch(`${API}/snapshot/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Delete failed");

      if (compare.includes(id)) {
        setCompare(compare.filter((x) => x !== id));
        setCompareResult(null);
      }

      if (selected?.id === id) {
        setSelected(null);
      }

      await fetchHistory();
      showNotification("Snapshot deleted successfully");
    } catch (error) {
      alert("Failed to delete snapshot. Please try again.");
      console.error("Delete error:", error);
    }
  };

  const compareSnapshots = async () => {
    if (compare.length !== 2) {
      alert("Please select exactly 2 snapshots to compare");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(
        `${API}/compare?a=${compare[0]}&b=${compare[1]}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setCompareResult(data);
      showNotification("Comparison completed successfully");
    } catch (error) {
      alert("Failed to compare snapshots. Please try again.");
      console.error("Comparison error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCompare = (id) => {
    setCompareResult(null);
    if (compare.includes(id)) {
      setCompare(compare.filter((x) => x !== id));
    } else if (compare.length < 2) {
      setCompare([...compare, id]);
    } else {
      setCompare([compare[1], id]);
    }
  };

  const formatTime = (ts) =>
    new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

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
              onKeyPress={(e) =>
                e.key === "Enter" && (mode === "login" ? login() : signup())
              }
              className="styled-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) =>
                e.key === "Enter" && (mode === "login" ? login() : signup())
              }
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

      {notification && (
        <div className={`notification ${notification.type}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {notification.message}
        </div>
      )}

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
            <span className="required-badge">Required Fields</span>
          </div>
          <div className="card-content">
            <div className="input-wrapper">
              <label htmlFor="dataset-name" className="input-label">
                Dataset Name <span className="required-star">*</span>
              </label>
              <input
                id="dataset-name"
                placeholder="Enter dataset name (e.g., customer_data_2024)"
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && file && upload()}
                className="styled-input"
                required
              />
            </div>
            <div className="upload-area">
              <input
                type="file"
                id="file-upload"
                key={file ? file.name : "empty"}
                onChange={(e) => setFile(e.target.files[0])}
                className="file-input"
                accept=".csv,.xlsx,.xls,.json"
              />
              <label
                htmlFor="file-upload"
                className={`file-label ${file ? "has-file" : ""}`}
              >
                {file ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <div className="file-label-content">
                  <span className="file-name">
                    {file ? file.name : "Choose file"}
                  </span>
                  <span className="file-hint">CSV, Excel, or JSON</span>
                </div>
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
              <h3>Drift Trend Over Time</h3>
              <span className="trend-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {history.length} data points
              </span>
            </div>
            <div className="card-content">
              <DriftChart labels={trendLabels} values={trendValues} />
            </div>
          </div>
        )}

        {result && (
          <div className="card result-card">
            <div className="card-header">
              <div className="result-header-info">
                <h3>Analysis Result</h3>
                {dataset && <span className="dataset-badge">📊 {dataset}</span>}
              </div>
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
            <div className="header-with-badge">
              <h3>Snapshot History</h3>
              {history.length > 0 && (
                <span className="count-badge">{history.length}</span>
              )}
            </div>
            <div className="header-actions">
              <button
                className="refresh-btn"
                onClick={fetchHistory}
                title="Refresh history"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
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
          </div>
          <div className="card-content">
            {compare.length > 0 && (
              <div className="selection-indicator">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  {compare.length} snapshot{compare.length > 1 ? "s" : ""}{" "}
                  selected for comparison
                </span>
                <button
                  className="clear-selection-btn"
                  onClick={() => {
                    setCompare([]);
                    setCompareResult(null);
                  }}
                  title="Clear selection"
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
            )}
            <ul className="history-list">
              {history.length === 0 ? (
                <li className="empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p>No snapshots yet. Upload a dataset to get started!</p>
                </li>
              ) : (
                history.map((h) => (
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
                        {h.dataset_name?.trim() ||
                          `Snapshot ${h.id.slice(0, 8)}`}
                      </span>
                      <span className="history-time">
                        {formatTime(h.timestamp)}
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
                ))
              )}
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
                  <div className="snapshot-header">
                    <h4>Snapshot A</h4>
                    <span className="snapshot-id">ID: {compare[0]}</span>
                  </div>
                  <div className="comparison-details">
                    {history.find((h) => h.id === compare[0]) && (
                      <>
                        <div className="detail-row">
                          <span className="detail-label">Dataset</span>
                          <span className="detail-value">
                            {history
                              .find((h) => h.id === compare[0])
                              .dataset_name?.trim() ||
                              `Snapshot ${compare[0].slice(0, 8)}`}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Timestamp</span>
                          <span className="detail-value">
                            {formatTime(
                              history.find((h) => h.id === compare[0]).timestamp
                            )}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Drift Score</span>
                          <span className="detail-value score">
                            {history.find((h) => h.id === compare[0])
                              .drift_score || "N/A"}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Severity</span>
                          <span
                            className={`badge ${
                              history.find((h) => h.id === compare[0])
                                .drift_severity
                            }`}
                          >
                            {
                              history.find((h) => h.id === compare[0])
                                .drift_severity
                            }
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="comparison-divider">
                  <div className="vs-badge">VS</div>
                </div>

                <div className="comparison-section">
                  <div className="snapshot-header">
                    <h4>Snapshot B</h4>
                    <span className="snapshot-id">ID: {compare[1]}</span>
                  </div>
                  <div className="comparison-details">
                    {history.find((h) => h.id === compare[1]) && (
                      <>
                        <div className="detail-row">
                          <span className="detail-label">Dataset</span>
                          <span className="detail-value">
                            {history
                              .find((h) => h.id === compare[1])
                              .dataset_name?.trim() ||
                              `Snapshot ${compare[1].slice(0, 8)}`}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Timestamp</span>
                          <span className="detail-value">
                            {formatTime(
                              history.find((h) => h.id === compare[1]).timestamp
                            )}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Drift Score</span>
                          <span className="detail-value score">
                            {history.find((h) => h.id === compare[1])
                              .drift_score || "N/A"}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Severity</span>
                          <span
                            className={`badge ${
                              history.find((h) => h.id === compare[1])
                                .drift_severity
                            }`}
                          >
                            {
                              history.find((h) => h.id === compare[1])
                                .drift_severity
                            }
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {compareResult && Object.keys(compareResult).length > 0 && (
                <div className="comparison-summary">
                  <h4>Analysis Summary</h4>
                  <div className="summary-content">
                    {compareResult.statistical_drift &&
                      Array.isArray(compareResult.statistical_drift) && (
                        <div className="summary-section">
                          <h5>Statistical Drift Detected</h5>
                          <div className="drift-tags">
                            {compareResult.statistical_drift.map((drift, i) => (
                              <span key={i} className="drift-tag">
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
                                {drift}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {compareResult.schema_drift &&
                      Array.isArray(compareResult.schema_drift) &&
                      compareResult.schema_drift.length > 0 && (
                        <div className="summary-section">
                          <h5>Schema Changes</h5>
                          <div className="drift-tags">
                            {compareResult.schema_drift.map((drift, i) => (
                              <span key={i} className="drift-tag schema">
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                >
                                  <path
                                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                {drift}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {compareResult.semantic_drift &&
                      Array.isArray(compareResult.semantic_drift) &&
                      compareResult.semantic_drift.length > 0 && (
                        <div className="summary-section">
                          <h5>Semantic Drift</h5>
                          <div className="drift-tags">
                            {compareResult.semantic_drift.map((drift, i) => (
                              <span key={i} className="drift-tag semantic">
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                >
                                  <path
                                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                {drift}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {compareResult.drift_score && (
                      <div className="summary-metrics">
                        <div className="metric-card">
                          <span className="metric-label">
                            Overall Drift Score
                          </span>
                          <span className="metric-value">
                            {compareResult.drift_score}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="comparison-raw">
                <details>
                  <summary>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    View Detailed Comparison Data
                  </summary>
                  <div className="formatted-data">
                    {Object.entries(compareResult).map(([key, value]) => (
                      <div key={key} className="data-section">
                        <div className="data-key">
                          {key.replace(/_/g, " ").toUpperCase()}
                        </div>
                        <div className="data-value">
                          {Array.isArray(value) ? (
                            value.length > 0 ? (
                              <ul className="data-list">
                                {value.map((item, idx) => (
                                  <li key={idx}>
                                    {typeof item === "object"
                                      ? JSON.stringify(item, null, 2)
                                      : item}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="empty-value">No data</span>
                            )
                          ) : typeof value === "object" && value !== null ? (
                            <pre className="nested-object">
                              {JSON.stringify(value, null, 2)}
                            </pre>
                          ) : (
                            <span className="simple-value">
                              {String(value)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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
