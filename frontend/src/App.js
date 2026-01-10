import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import "./App.css";
import DriftChart from "./components/DriftChart";
import AuthNavbar from "./components/AuthNavbar";

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

  // Enhanced features
  const [view, setView] = useState("dashboard");
  const [predictions, setPredictions] = useState(null);
  const [featureImportance, setFeatureImportance] = useState(null);
  const [remediation, setRemediation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertConfig, setAlertConfig] = useState({
    threshold: 0.3,
    channels: { email: true, slack: false, webhook: false, sms: false },
    frequency: "immediate",
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("all");

  // New state for advanced features
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchResults, setBatchResults] = useState(null);
  const [scheduleConfig, setScheduleConfig] = useState({
    dataset_path: "",
    frequency: "daily",
    enabled: true,
  });
  const [autoRetrainConfig, setAutoRetrainConfig] = useState({
    drift_threshold: 0.5,
    min_samples: 1000,
    enabled: true,
  });
  const [dataQuality, setDataQuality] = useState(null);
  const [multiCompareIds, setMultiCompareIds] = useState([]);
  const [multiCompareResult, setMultiCompareResult] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);

  const wsRef = useRef(null);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const trendLabels = history
    .slice()
    .reverse()
    .map((h) => new Date(h.timestamp).toLocaleTimeString());

  const trendValues = history
    .slice()
    .reverse()
    .map((h) => h.drift_score || 0);

  // WebSocket Connection
  useEffect(() => {
    if (!token) return;

    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://127.0.0.1:8000/ws/live-monitoring`);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "new_snapshot") {
          setLiveUpdates((prev) => [data.data, ...prev.slice(0, 9)]);
          showNotification(`New snapshot: ${data.data.dataset_name}`, "info");
          fetchHistory();
        } else if (data.type === "heartbeat") {
          // Keep-alive
        } else if (data.type === "connected") {
          console.log("WebSocket handshake complete");
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setWsConnected(false);
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Fetch health status periodically
  useEffect(() => {
    if (!token) return;

    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API}/health`);
        const data = await res.json();
        setHealthStatus(data);
      } catch (error) {
        console.error("Health check failed:", error);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [token]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);

        // Generate alerts
        const newAlerts = data
          .filter(
            (h) => h.drift_severity === "high" || h.drift_severity === "medium"
          )
          .slice(0, 10)
          .map((h) => ({
            id: h.id,
            message: `${h.drift_severity.toUpperCase()} drift detected in ${
              h.dataset_name
            }`,
            severity: h.drift_severity,
            timestamp: h.timestamp,
            read: false,
            drift_score: h.drift_score,
          }));
        setAlerts(newAlerts);
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
      showNotification("Please enter both email and password", "error");
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
        showNotification("Signup successful! Please login.");
        setMode("login");
        setPassword("");
      } else {
        showNotification(data.detail || "Signup failed", "error");
      }
    } catch (error) {
      showNotification("Signup failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const login = async () => {
    if (!email.trim() || !password.trim()) {
      showNotification("Please enter both email and password", "error");
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
        showNotification("Login successful!");
      } else {
        showNotification(data.detail || "Login failed", "error");
      }
    } catch (error) {
      showNotification("Login failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const upload = async () => {
    if (!file) {
      showNotification("Please select a file first", "error");
      return;
    }
    if (!dataset.trim()) {
      showNotification("Please enter a dataset name", "error");
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
      setDataset("");
      await fetchHistory();
      showNotification("Dataset analyzed successfully!");
    } catch (error) {
      showNotification("Failed to analyze file", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Batch upload
  const uploadBatch = async () => {
    if (batchFiles.length === 0) {
      showNotification("Please select files for batch upload", "error");
      return;
    }

    setIsLoading(true);
    try {
      const form = new FormData();
      batchFiles.forEach((file) => {
        form.append("files", file);
      });

      const res = await fetch(`${API}/analyze-batch`, {
        method: "POST",
        body: form,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Batch upload failed");

      const data = await res.json();
      setBatchResults(data);
      setBatchFiles([]);
      showNotification(`Batch queued: ${data.total_queued} files`);
      setTimeout(fetchHistory, 2000); // Refresh after processing
    } catch (error) {
      showNotification("Batch upload failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const predictDrift = async () => {
    if (!selectedDataset || selectedDataset === "all") {
      showNotification("Please select a specific dataset", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API}/predict-drift`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dataset_name: selectedDataset }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Prediction failed");
      }

      const data = await res.json();
      setPredictions(data);
      showNotification("Drift prediction completed!");
    } catch (error) {
      showNotification(error.message || "Failed to predict drift", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFeatureImportance = async (snapId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/feature-importance/${snapId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to load feature importance");
      }

      const data = await res.json();
      setFeatureImportance(data);
      setView("insights");
      showNotification("Feature importance loaded!");
    } catch (error) {
      showNotification(
        error.message || "Failed to load feature importance",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadRemediation = async (snapId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/remediation-suggest/${snapId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load remediation");

      const data = await res.json();
      setRemediation(data);
    } catch (error) {
      showNotification("Failed to load remediation", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadDataQuality = async (snapId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/data-quality/${snapId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load data quality");

      const data = await res.json();
      setDataQuality(data);
      showNotification("Data quality metrics loaded!");
    } catch (error) {
      showNotification("Failed to load data quality", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const saveAlertConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/alert-config`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alertConfig),
      });

      if (!res.ok) throw new Error("Failed to save config");

      showNotification("Alert settings saved successfully!");
    } catch (error) {
      showNotification("Failed to save settings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const scheduleMonitoring = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/schedule-monitoring`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(scheduleConfig),
      });

      if (!res.ok) throw new Error("Failed to schedule monitoring");

      showNotification(`Monitoring scheduled: ${scheduleConfig.frequency}`);
    } catch (error) {
      showNotification("Failed to schedule monitoring", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const saveAutoRetrainConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/auto-retrain-config`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(autoRetrainConfig),
      });

      if (!res.ok) throw new Error("Failed to save auto-retrain config");

      showNotification("Auto-retrain settings saved!");
    } catch (error) {
      showNotification("Failed to save auto-retrain config", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const compareMultipleSnapshots = async () => {
    if (multiCompareIds.length < 2) {
      showNotification("Please select at least 2 snapshots", "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API}/compare-multiple`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ snapshot_ids: multiCompareIds }),
      });

      if (!res.ok) throw new Error("Multi-comparison failed");

      const data = await res.json();
      setMultiCompareResult(data);
      showNotification("Multi-snapshot comparison completed!");
    } catch (error) {
      showNotification("Failed to compare snapshots", "error");
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
      showNotification("Failed to load snapshot details", "error");
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
      showNotification("Failed to delete snapshot", "error");
    }
  };

  const compareSnapshots = async () => {
    if (compare.length !== 2) {
      showNotification("Please select exactly 2 snapshots to compare", "error");
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
      showNotification("Failed to compare snapshots", "error");
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

  const toggleMultiCompare = (id) => {
    if (multiCompareIds.includes(id)) {
      setMultiCompareIds(multiCompareIds.filter((x) => x !== id));
    } else if (multiCompareIds.length < 10) {
      setMultiCompareIds([...multiCompareIds, id]);
    } else {
      showNotification("Maximum 10 snapshots for comparison", "error");
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
    setPredictions(null);
    setFeatureImportance(null);
    setRemediation(null);
    setAlerts([]);
    setLiveUpdates([]);
    setDataQuality(null);
    setMultiCompareIds([]);
    setMultiCompareResult(null);
  };

  // Filter history
  const filteredHistory = history.filter((h) => {
    const matchesDataset =
      selectedDataset === "all" ||
      selectedDataset === "" ||
      h.dataset_name === selectedDataset;
    const matchesSeverity =
      filterSeverity === "all" || h.drift_severity === filterSeverity;
    return matchesDataset && matchesSeverity;
  });

  // Get unique datasets
  const datasets = useMemo(() => {
    const uniqueDatasets = [
      ...new Set(history.map((h) => h.dataset_name?.trim()).filter(Boolean)),
    ];
    return uniqueDatasets;
  }, [history]);

  // Dataset initialization
  useEffect(() => {
    if (datasets.length > 0 && !selectedDataset) {
      setSelectedDataset(datasets[0]);
    } else if (datasets.length === 0) {
      setSelectedDataset("");
    } else if (selectedDataset && !datasets.includes(selectedDataset)) {
      setSelectedDataset(datasets[0]);
    }
  }, [datasets, selectedDataset]);

  if (!token) {
  return (
    <div className="auth-container">
      {/* Navbar */}
      <div className="auth-navbar">
        <div className="auth-navbar-left">
          <div className="navbar-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                strokeWidth="2"
              />
            </svg>
          </div>
          <span className="navbar-title">Data Drift Monitor Pro</span>
        </div>

        <div className="auth-navbar-right">
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
      </div>

      {/* Background */}
      <div className="animated-bg">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      {/* Auth Card */}
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
          <h1>Data Drift Monitor Pro</h1>
          <p className="subtitle">AI-powered ML monitoring</p>
        </div>

        {/* Login / Signup Tabs */}
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
          <h1>Drift Monitor Pro</h1>
          {wsConnected && <span className="ws-status">🟢 Live</span>}
          {healthStatus && (
            <span
              className="health-status"
              title={`Redis: ${healthStatus.redis_status}, Jobs: ${healthStatus.scheduled_jobs}`}
            >
              ❤️ {healthStatus.status}
            </span>
          )}
        </div>
        <div className="top-bar-actions">
          <span className="alert-badge" onClick={() => setView("alerts")}>
            🔔 {alerts.filter((a) => !a.read).length}
          </span>
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
      </div>

      {/* Navigation Tabs */}
      <div className="view-tabs">
        <button
          className={view === "dashboard" ? "active" : ""}
          onClick={() => setView("dashboard")}
        >
          📊 Dashboard
        </button>
        <button
          className={view === "upload" ? "active" : ""}
          onClick={() => setView("upload")}
        >
          📤 Upload
        </button>
        <button
          className={view === "batch" ? "active" : ""}
          onClick={() => setView("batch")}
        >
          📦 Batch Upload
        </button>
        <button
          className={view === "predictions" ? "active" : ""}
          onClick={() => setView("predictions")}
        >
          🔮 Predictions
        </button>
        <button
          className={view === "alerts" ? "active" : ""}
          onClick={() => setView("alerts")}
        >
          🚨 Alerts{" "}
          {alerts.filter((a) => !a.read).length > 0 &&
            `(${alerts.filter((a) => !a.read).length})`}
        </button>
        <button
          className={view === "insights" ? "active" : ""}
          onClick={() => setView("insights")}
        >
          💡 Insights
        </button>
        <button
          className={view === "automation" ? "active" : ""}
          onClick={() => setView("automation")}
        >
          ⚙️ Automation
        </button>
        <button
          className={view === "history" ? "active" : ""}
          onClick={() => setView("history")}
        >
          📜 History
        </button>
      </div>

      <div className="container">
        {/* Dashboard View */}
        {view === "dashboard" && (
          <>
            <div className="stats-grid">
              <div className="stat-card blue">
                <div className="stat-icon">📊</div>
                <div className="stat-info">
                  <div className="stat-value">{history.length}</div>
                  <div className="stat-label">Total Snapshots</div>
                </div>
              </div>
              <div className="stat-card red">
                <div className="stat-icon">⚠️</div>
                <div className="stat-info">
                  <div className="stat-value">
                    {history.filter((h) => h.drift_severity === "high").length}
                  </div>
                  <div className="stat-label">High Severity</div>
                </div>
              </div>
              <div className="stat-card green">
                <div className="stat-icon">✅</div>
                <div className="stat-info">
                  <div className="stat-value">
                    {history.filter((h) => h.drift_severity === "low").length}
                  </div>
                  <div className="stat-label">Low Drift</div>
                </div>
              </div>
              <div className="stat-card purple">
                <div className="stat-icon">🗂️</div>
                <div className="stat-info">
                  <div className="stat-value">{datasets.length}</div>
                  <div className="stat-label">Datasets</div>
                </div>
              </div>
            </div>

            {liveUpdates.length > 0 && (
              <div className="card live-updates-card">
                <div className="card-header">
                  <h3>⚡ Live Updates</h3>
                </div>
                <div className="card-content">
                  {liveUpdates.map((update, idx) => (
                    <div key={idx} className="live-update-item">
                      <div className="live-update-info">
                        <strong>{update.dataset_name}</strong>
                        <span>
                          {new Date(update.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <span className={`badge ${update.severity}`}>
                        {((update.drift_score || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {history.length > 1 && (
              <div className="card chart-card">
                <div className="card-header">
                  <h3>Drift Trend Over Time</h3>
                  <span className="trend-badge">
                    📈 {history.length} data points
                  </span>
                </div>
                <div className="card-content">
                  <DriftChart labels={trendLabels} values={trendValues} />
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header">
                <h3>Recent Snapshots</h3>
                <div className="header-actions">
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Severities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button className="refresh-btn" onClick={fetchHistory}>
                    🔄 Refresh
                  </button>
                </div>
              </div>
              <div className="card-content">
                {filteredHistory.slice(0, 5).map((h) => (
                  <div
                    key={h.id}
                    className="snapshot-item"
                    onClick={() => {
                      loadFeatureImportance(h.id);
                      loadRemediation(h.id);
                      loadDataQuality(h.id);
                    }}
                  >
                    <div className="snapshot-info">
                      <div className={`severity-dot ${h.drift_severity}`}></div>
                      <div>
                        <div className="snapshot-name">{h.dataset_name}</div>
                        <div className="snapshot-time">
                          {formatTime(h.timestamp)}
                        </div>
                      </div>
                    </div>
                    <span className={`badge ${h.drift_severity}`}>
                      {((h.drift_score || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Upload View */}
        {view === "upload" && (
          <>
            <div className="card upload-card">
              <div className="card-header">
                <h3>Upload Dataset</h3>
              </div>
              <div className="card-content">
                <div className="input-wrapper">
                  <label>Dataset Name *</label>
                  <input
                    placeholder="e.g., customer_data_2024"
                    value={dataset}
                    onChange={(e) => setDataset(e.target.value)}
                    className="styled-input"
                  />
                </div>
                <div className="upload-area">
                  <input
                    type="file"
                    id="file-upload"
                    onChange={(e) => setFile(e.target.files[0])}
                    className="file-input"
                    accept=".csv"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`file-label ${file ? "has-file" : ""}`}
                  >
                    📁 {file ? file.name : "Choose CSV file"}
                  </label>
                  <button
                    className={`analyze-btn ${isLoading ? "loading" : ""}`}
                    onClick={upload}
                    disabled={isLoading}
                  >
                    {isLoading ? "Analyzing..." : "Analyze"}
                  </button>
                </div>
              </div>
            </div>

            {result && (
              <div className="card result-card">
                <div className="card-header">
                  <h3>Analysis Result</h3>
                </div>
                <div className="card-content">
                  <div className="result-stats">
                    <div className="stat-item">
                      <span className="stat-label">Score</span>
                      <span className="stat-value">
                        {(result.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Severity</span>
                      <span className={`badge ${result.severity}`}>
                        {result.severity}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Features</span>
                      <span className="stat-value">
                        {result.features_analyzed}
                      </span>
                    </div>
                  </div>

                  {result.quality_metrics && (
                    <div className="quality-overview">
                      <h4>📊 Data Quality Score</h4>
                      <div className="quality-score-big">
                        {(result.quality_metrics.overall_score * 100).toFixed(
                          0
                        )}
                        %
                      </div>
                      <div className="quality-breakdown">
                        <div>
                          Completeness:{" "}
                          {(result.quality_metrics.completeness * 100).toFixed(
                            0
                          )}
                          %
                        </div>
                        <div>
                          Validity:{" "}
                          {(result.quality_metrics.validity * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="drift-list">
                    {result.drift.length === 0 ? (
                      <div className="no-drift">✅ No drift detected</div>
                    ) : (
                      result.drift.map((d, i) => (
                        <div key={i} className="drift-item">
                          ⚠️{" "}
                          {typeof d === "object" ? (
                            <>
                              {d.type === "column_renamed_or_missing" && (
                                <>
                                  🔁 Column <strong>{d.old_column}</strong>{" "}
                                  renamed/missing →{" "}
                                  <strong>{d.best_match || "none"}</strong> (
                                  {((d.similarity || 0) * 100).toFixed(0)}%)
                                </>
                              )}

                              {d.type === "type_changed" && (
                                <>
                                  🔄 Type change in <strong>{d.column}</strong>:{" "}
                                  {d.old_type} → {d.new_type}
                                </>
                              )}

                              {d.type === "categorical_shift" && (
                                <>
                                  📊 Categorical shift in{" "}
                                  <strong>{d.column}</strong> (Jaccard{" "}
                                  {((d.jaccard_similarity || 0) * 100).toFixed(
                                    0
                                  )}
                                  %)
                                </>
                              )}

                              {!d.type && JSON.stringify(d)}
                            </>
                          ) : (
                            d
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {result.predicted_impact && (
                    <div className="predicted-impact">
                      <strong>🧠 Predicted Impact:</strong>
                      <p>
                        Model accuracy may drop by{" "}
                        {(
                          result.predicted_impact.model_accuracy_drop * 100
                        ).toFixed(1)}
                        %
                      </p>
                      <p>
                        Recommended:{" "}
                        <strong>
                          {result.predicted_impact.recommended_action}
                        </strong>
                      </p>
                    </div>
                  )}

                  {result.anomaly_report &&
                    Object.keys(result.anomaly_report).length > 0 && (
                      <div className="anomaly-section">
                        <h4>🚨 Anomaly Detection</h4>
                        {Object.entries(result.anomaly_report)
                          .slice(0, 5)
                          .map(([feature, anomaly], idx) => (
                            <div key={idx} className="anomaly-item">
                              <strong>{feature}:</strong>{" "}
                              {anomaly.has_anomalies
                                ? "⚠️ Detected"
                                : "✅ Normal"}
                            </div>
                          ))}
                      </div>
                    )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Batch Upload View */}
        {view === "batch" && (
          <div className="card">
            <div className="card-header">
              <h3>📦 Batch Upload</h3>
              <span className="info-badge">Max 10 files</span>
            </div>
            <div className="card-content">
              <div className="batch-upload-area">
                <input
                  type="file"
                  id="batch-upload"
                  multiple
                  onChange={(e) => setBatchFiles(Array.from(e.target.files))}
                  className="file-input"
                  accept=".csv"
                />
                <label htmlFor="batch-upload" className="file-label">
                  📁{" "}
                  {batchFiles.length > 0
                    ? `${batchFiles.length} files selected`
                    : "Choose multiple CSV files"}
                </label>

                {batchFiles.length > 0 && (
                  <div className="batch-file-list">
                    {batchFiles.map((f, idx) => (
                      <div key={idx} className="batch-file-item">
                        <span>📄 {f.name}</span>
                        <button
                          className="remove-file-btn"
                          onClick={() =>
                            setBatchFiles(
                              batchFiles.filter((_, i) => i !== idx)
                            )
                          }
                        >
                          ✖
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className={`primary-btn ${isLoading ? "loading" : ""}`}
                  onClick={uploadBatch}
                  disabled={isLoading || batchFiles.length === 0}
                >
                  {isLoading ? "Processing..." : "Analyze Batch"}
                </button>
              </div>

              {batchResults && (
                <div className="batch-results">
                  <h4>Batch Processing Results</h4>
                  <p>Batch ID: {batchResults.batch_id}</p>
                  <p>Files Queued: {batchResults.total_queued}</p>
                  <div className="batch-status-list">
                    {batchResults.files.map((file, idx) => (
                      <div key={idx} className="batch-status-item">
                        <span>{file.filename}</span>
                        <span className={`status-badge ${file.status}`}>
                          {file.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Predictions View */}
        {view === "predictions" && (
          <div className="card">
            <div className="card-header">
              <h3>🔮 Drift Predictions</h3>
              <button
                className="primary-btn"
                onClick={predictDrift}
                disabled={isLoading || !selectedDataset}
              >
                {isLoading ? "Predicting..." : "Generate Prediction"}
              </button>
            </div>
            <div className="card-content">
              <div className="input-wrapper">
                <label>Select Dataset</label>
                <select
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  className="styled-input"
                >
                  {datasets.length === 0 ? (
                    <option value="">No datasets available</option>
                  ) : (
                    datasets.map((ds) => (
                      <option key={ds} value={ds}>
                        {ds}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {predictions && (
                <>
                  <div className="prediction-stats">
                    <div className="prediction-stat">
                      <span className="label">Risk Level</span>
                      <span className={`value risk-${predictions.risk_level}`}>
                        {predictions.risk_level.toUpperCase()}
                      </span>
                    </div>
                    <div className="prediction-stat">
                      <span className="label">Monitoring Frequency</span>
                      <span className="value">
                        {predictions.suggested_monitoring_frequency}
                      </span>
                    </div>
                  </div>

                  <div className="prediction-chart">
                    <h4>7-Day Forecast</h4>
                    {predictions.next_7_days.map((day, idx) => (
                      <div key={idx} className="prediction-day">
                        <span>Day {day.day}</span>
                        <div className="prediction-bar">
                          <div
                            className="prediction-fill"
                            style={{ width: `${day.predicted_score * 100}%` }}
                          ></div>
                        </div>
                        <span>{(day.predicted_score * 100).toFixed(1)}%</span>
                        <span className="confidence">
                          ({(day.confidence * 100).toFixed(0)}% confident)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!predictions && (
                <div className="empty-state">
                  <p>
                    Select a dataset and generate predictions to see the
                    forecast
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Automation View */}
        {view === "automation" && (
          <>
            <div className="card">
              <div className="card-header">
                <h3>⏰ Schedule Monitoring</h3>
              </div>
              <div className="card-content">
                <div className="input-wrapper">
                  <label>Dataset Path</label>
                  <input
                    placeholder="/path/to/dataset.csv"
                    value={scheduleConfig.dataset_path}
                    onChange={(e) =>
                      setScheduleConfig({
                        ...scheduleConfig,
                        dataset_path: e.target.value,
                      })
                    }
                    className="styled-input"
                  />
                </div>

                <div className="input-wrapper">
                  <label>Frequency</label>
                  <select
                    value={scheduleConfig.frequency}
                    onChange={(e) =>
                      setScheduleConfig({
                        ...scheduleConfig,
                        frequency: e.target.value,
                      })
                    }
                    className="styled-input"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <button
                  className="primary-btn"
                  onClick={scheduleMonitoring}
                  disabled={isLoading || !scheduleConfig.dataset_path}
                >
                  {isLoading ? "Scheduling..." : "Schedule Monitoring"}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>🤖 Auto-Retrain Configuration</h3>
              </div>
              <div className="card-content">
                <div className="config-section">
                  <label>
                    Drift Threshold:{" "}
                    {(autoRetrainConfig.drift_threshold * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={autoRetrainConfig.drift_threshold}
                    onChange={(e) =>
                      setAutoRetrainConfig({
                        ...autoRetrainConfig,
                        drift_threshold: parseFloat(e.target.value),
                      })
                    }
                    className="slider"
                  />
                </div>

                <div className="input-wrapper">
                  <label>Minimum Samples</label>
                  <input
                    type="number"
                    value={autoRetrainConfig.min_samples}
                    onChange={(e) =>
                      setAutoRetrainConfig({
                        ...autoRetrainConfig,
                        min_samples: parseInt(e.target.value),
                      })
                    }
                    className="styled-input"
                    min="100"
                  />
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={autoRetrainConfig.enabled}
                    onChange={(e) =>
                      setAutoRetrainConfig({
                        ...autoRetrainConfig,
                        enabled: e.target.checked,
                      })
                    }
                  />
                  Enable Auto-Retrain
                </label>

                <button
                  className="primary-btn"
                  onClick={saveAutoRetrainConfig}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Configuration"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Alerts View */}
        {view === "alerts" && (
          <>
            <div className="card">
              <div className="card-header">
                <h3>🚨 Alert Center</h3>
                <button
                  className="secondary-btn"
                  onClick={() =>
                    setAlerts(alerts.map((a) => ({ ...a, read: true })))
                  }
                >
                  Mark All as Read
                </button>
              </div>
              <div className="card-content">
                {alerts.length === 0 ? (
                  <div className="empty-state">
                    <p>✅ No alerts. Everything looks good!</p>
                  </div>
                ) : (
                  <div className="alerts-list">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`alert-item ${
                          alert.read ? "read" : "unread"
                        }`}
                      >
                        <div className="alert-icon">⚠️</div>
                        <div className="alert-content">
                          <div className="alert-message">{alert.message}</div>
                          <div className="alert-time">
                            {formatTime(alert.timestamp)} •{" "}
                            {((alert.drift_score || 0) * 100).toFixed(1)}% drift
                          </div>
                        </div>
                        <button
                          className="delete-icon-btn"
                          onClick={() =>
                            setAlerts(alerts.filter((a) => a.id !== alert.id))
                          }
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>⚙️ Alert Configuration</h3>
              </div>
              <div className="card-content">
                <div className="config-section">
                  <label>
                    Drift Threshold: {(alertConfig.threshold * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={alertConfig.threshold}
                    onChange={(e) =>
                      setAlertConfig({
                        ...alertConfig,
                        threshold: parseFloat(e.target.value),
                      })
                    }
                    className="slider"
                  />
                </div>

                <div className="config-section">
                  <label>Notification Channels</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={alertConfig.channels.email}
                        onChange={(e) =>
                          setAlertConfig({
                            ...alertConfig,
                            channels: {
                              ...alertConfig.channels,
                              email: e.target.checked,
                            },
                          })
                        }
                      />
                      📧 Email Notifications
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={alertConfig.channels.slack}
                        onChange={(e) =>
                          setAlertConfig({
                            ...alertConfig,
                            channels: {
                              ...alertConfig.channels,
                              slack: e.target.checked,
                            },
                          })
                        }
                      />
                      💬 Slack Integration
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={alertConfig.channels.webhook}
                        onChange={(e) =>
                          setAlertConfig({
                            ...alertConfig,
                            channels: {
                              ...alertConfig.channels,
                              webhook: e.target.checked,
                            },
                          })
                        }
                      />
                      🔗 Webhook
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={alertConfig.channels.sms}
                        onChange={(e) =>
                          setAlertConfig({
                            ...alertConfig,
                            channels: {
                              ...alertConfig.channels,
                              sms: e.target.checked,
                            },
                          })
                        }
                      />
                      📱 SMS Alerts
                    </label>
                  </div>
                </div>

                <div className="config-section">
                  <label>Alert Frequency</label>
                  <select
                    value={alertConfig.frequency}
                    onChange={(e) =>
                      setAlertConfig({
                        ...alertConfig,
                        frequency: e.target.value,
                      })
                    }
                    className="styled-input"
                  >
                    <option value="immediate">Immediate</option>
                    <option value="hourly">Hourly Digest</option>
                    <option value="daily">Daily Digest</option>
                    <option value="weekly">Weekly Digest</option>
                  </select>
                </div>

                <button
                  className="primary-btn"
                  onClick={saveAlertConfig}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Insights View */}
        {view === "insights" && (
          <>
            {featureImportance && (
              <div className="card">
                <div className="card-header">
                  <h3>💡 Feature Importance Analysis</h3>
                </div>
                <div className="card-content">
                  <div className="top-features">
                    <h4>Top Drifting Features</h4>
                    <div className="feature-tags">
                      {featureImportance.top_drifting_features.map(
                        (feature, idx) => (
                          <span key={idx} className="feature-tag">
                            #{idx + 1} {feature}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="features-list">
                    {featureImportance.features
                      .slice(0, 10)
                      .map((feat, idx) => (
                        <div key={idx} className="feature-item">
                          <span className="feature-name">{feat.name}</span>
                          <div className="feature-bar-container">
                            <div
                              className="feature-bar"
                              style={{ width: `${feat.drift_score * 100}%` }}
                            ></div>
                          </div>
                          <span className="feature-score">
                            {(feat.drift_score * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {dataQuality && (
              <div className="card">
                <div className="card-header">
                  <h3>📊 Data Quality Metrics</h3>
                </div>
                <div className="card-content">
                  <div className="quality-grid">
                    <div className="quality-metric">
                      <div className="quality-label">Overall Score</div>
                      <div className="quality-value-large">
                        {(
                          dataQuality.quality_metrics.overall_score * 100
                        ).toFixed(0)}
                        %
                      </div>
                    </div>
                    <div className="quality-metric">
                      <div className="quality-label">Completeness</div>
                      <div className="quality-value">
                        {(
                          dataQuality.quality_metrics.completeness * 100
                        ).toFixed(0)}
                        %
                      </div>
                    </div>
                    <div className="quality-metric">
                      <div className="quality-label">Validity</div>
                      <div className="quality-value">
                        {(dataQuality.quality_metrics.validity * 100).toFixed(
                          0
                        )}
                        %
                      </div>
                    </div>
                    <div className="quality-metric">
                      <div className="quality-label">Consistency</div>
                      <div className="quality-value">
                        {(
                          dataQuality.quality_metrics.consistency * 100
                        ).toFixed(0)}
                        %
                      </div>
                    </div>
                  </div>

                  {dataQuality.recommendations &&
                    dataQuality.recommendations.length > 0 && (
                      <div className="recommendations-section">
                        <h4>💡 Recommendations</h4>
                        {dataQuality.recommendations.map((rec, idx) => (
                          <div key={idx} className="recommendation-item">
                            {rec}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )}

            {remediation && (
              <div className="card">
                <div className="card-header">
                  <h3>🔧 Remediation Suggestions</h3>
                </div>
                <div className="card-content">
                  <div className="remediation-stats">
                    <div
                      className={`remediation-stat priority-${remediation.priority}`}
                    >
                      <span className="label">Priority</span>
                      <span className="value">
                        {remediation.priority.toUpperCase()}
                      </span>
                    </div>
                    <div className="remediation-stat">
                      <span className="label">Severity</span>
                      <span className="value">{remediation.severity}</span>
                    </div>
                  </div>

                  <div className="impact-box">
                    <strong>📊 Estimated Impact:</strong>
                    <p>{remediation.estimated_impact}</p>
                  </div>

                  <div className="suggestions-list">
                    <h4>Recommended Actions</h4>
                    {remediation.suggestions.map((suggestion, idx) => (
                      <div key={idx} className="suggestion-item">
                        <span className="suggestion-number">{idx + 1}</span>
                        <span className="suggestion-text">{suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!featureImportance && !remediation && !dataQuality && (
              <div className="card">
                <div className="card-content">
                  <div className="empty-state">
                    <p>💡 Click on a snapshot to view detailed insights</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* History View */}
        {view === "history" && (
          <>
            <div className="card history-card">
              <div className="card-header">
                <div className="header-with-badge">
                  <h3>📜 Snapshot History</h3>
                  {history.length > 0 && (
                    <span className="count-badge">{history.length}</span>
                  )}
                </div>
                <div className="header-actions">
                  <button className="refresh-btn" onClick={fetchHistory}>
                    🔄 Refresh
                  </button>
                  {compare.length === 2 && (
                    <button
                      className={`compare-btn ${isLoading ? "loading" : ""}`}
                      onClick={compareSnapshots}
                      disabled={isLoading}
                    >
                      {isLoading ? "Comparing..." : "Compare Selected (2)"}
                    </button>
                  )}
                  {multiCompareIds.length >= 2 && (
                    <button
                      className={`compare-btn ${isLoading ? "loading" : ""}`}
                      onClick={compareMultipleSnapshots}
                      disabled={isLoading}
                    >
                      {isLoading
                        ? "Comparing..."
                        : `Multi-Compare (${multiCompareIds.length})`}
                    </button>
                  )}
                </div>
              </div>
              <div className="card-content">
                {(compare.length > 0 || multiCompareIds.length > 0) && (
                  <div className="selection-indicator">
                    <span>
                      📋 {compare.length} standard / {multiCompareIds.length}{" "}
                      multi-compare selected
                    </span>
                    <button
                      className="clear-btn"
                      onClick={() => {
                        setCompare([]);
                        setMultiCompareIds([]);
                        setCompareResult(null);
                        setMultiCompareResult(null);
                      }}
                    >
                      ✖ Clear All
                    </button>
                  </div>
                )}

                <ul className="history-list">
                  {history.length === 0 ? (
                    <li className="empty-state">
                      <p>
                        📦 No snapshots yet. Upload a dataset to get started!
                      </p>
                    </li>
                  ) : (
                    history.map((h) => (
                      <li key={h.id} className="history-item">
                        <input
                          type="checkbox"
                          checked={compare.includes(h.id)}
                          onChange={() => toggleCompare(h.id)}
                          className="history-checkbox"
                          title="2-way compare"
                        />
                        <input
                          type="checkbox"
                          checked={multiCompareIds.includes(h.id)}
                          onChange={() => toggleMultiCompare(h.id)}
                          className="history-checkbox multi"
                          title="Multi-compare"
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
                                `${API}/report/${h.id}?format=csv`,
                                "_blank"
                              )
                            }
                            title="Download CSV"
                          >
                            📊 CSV
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => deleteSnapshot(h.id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            {/* Multi-Compare Result */}
            {multiCompareResult && (
              <div className="card comparison-card">
                <div className="card-header">
                  <h3>🔄 Multi-Snapshot Comparison</h3>
                  <button
                    className="close-btn"
                    onClick={() => setMultiCompareResult(null)}
                  >
                    ✖
                  </button>
                </div>
                <div className="card-content">
                  <div className="multi-compare-summary">
                    <div className="summary-stat">
                      <span className="label">Total Snapshots</span>
                      <span className="value">
                        {multiCompareResult.summary.total_snapshots}
                      </span>
                    </div>
                    <div className="summary-stat">
                      <span className="label">Avg Drift Score</span>
                      <span className="value">
                        {(
                          multiCompareResult.summary.avg_drift_score * 100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="summary-stat">
                      <span className="label">Trend</span>
                      <span className="value">
                        {multiCompareResult.summary.trend}
                      </span>
                    </div>
                  </div>

                  <div className="comparison-matrix">
                    <h4>Pairwise Drift Scores</h4>
                    {multiCompareResult.comparison_matrix.map((comp, idx) => (
                      <div key={idx} className="matrix-row">
                        <span className="snapshot-id">
                          {comp.snapshot_a.slice(0, 8)}
                        </span>
                        <span className="vs">↔</span>
                        <span className="snapshot-id">
                          {comp.snapshot_b.slice(0, 8)}
                        </span>
                        <span className="drift-value">
                          {(comp.drift_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Standard Comparison Result */}
        {compareResult && (
          <div className="card comparison-card">
            <div className="card-header">
              <h3>🔄 Comparison Results</h3>
              <button
                className="close-btn"
                onClick={() => setCompareResult(null)}
              >
                ✖
              </button>
            </div>
            <div className="card-content">
              <div className="comparison-summary">
                {compareResult.drift_score !== undefined && (
                  <div className="drift-score-box">
                    <strong>Overall Drift Score:</strong>
                    <span className="score-value">
                      {(compareResult.drift_score * 100).toFixed(1)}%
                    </span>
                  </div>
                )}

                {compareResult.semantic_score !== undefined && (
                  <div className="drift-score-box">
                    <strong>Semantic Drift Score:</strong>
                    <span className="score-value">
                      {(compareResult.semantic_score * 100).toFixed(1)}%
                    </span>
                  </div>
                )}

                {compareResult.statistical_drift &&
                  compareResult.statistical_drift.length > 0 && (
                    <div className="drift-section">
                      <h4>📊 Statistical Drift</h4>
                      <div className="drift-tags">
                        {compareResult.statistical_drift.map((drift, i) => (
                          <span key={i} className="drift-tag">
                            {drift}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {compareResult.schema_drift &&
                  compareResult.schema_drift.length > 0 && (
                    <div className="drift-section">
                      <h4>🗂️ Schema Changes</h4>
                      <div className="drift-tags">
                        {compareResult.schema_drift.map((drift, i) => (
                          <span key={i} className="drift-tag schema">
                            {drift}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {compareResult.semantic_drift &&
                  compareResult.semantic_drift.length > 0 && (
                    <div className="drift-section">
                      <h4>💬 Semantic Drift</h4>
                      <div className="drift-tags">
                        {compareResult.semantic_drift.map((drift, i) => (
                          <span key={i} className="drift-tag semantic">
                            {typeof drift === "object" ? (
                              <>
                                {drift.type === "column_renamed_or_missing" && (
                                  <>
                                    🔁 Column{" "}
                                    <strong>{drift.old_column}</strong>{" "}
                                    renamed/missing →{" "}
                                    <strong>
                                      {drift.best_match || "none"}
                                    </strong>{" "}
                                    (
                                    {((drift.similarity || 0) * 100).toFixed(0)}
                                    %)
                                  </>
                                )}

                                {drift.type === "type_changed" && (
                                  <>
                                    🔄 Type change in{" "}
                                    <strong>{drift.column}</strong>:{" "}
                                    {drift.old_type} → {drift.new_type}
                                  </>
                                )}

                                {drift.type === "categorical_shift" && (
                                  <>
                                    📊 Categorical shift in{" "}
                                    <strong>{drift.column}</strong> (Jaccard{" "}
                                    {(
                                      (drift.jaccard_similarity || 0) * 100
                                    ).toFixed(0)}
                                    %)
                                  </>
                                )}

                                {!drift.type && JSON.stringify(drift)}
                              </>
                            ) : (
                              drift
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {compareResult.statistical_significance &&
                  Object.keys(compareResult.statistical_significance).length >
                    0 && (
                    <div className="drift-section">
                      <h4>📈 Statistical Significance</h4>
                      <div className="significance-list">
                        {Object.entries(compareResult.statistical_significance)
                          .slice(0, 5)
                          .map(([feature, sig], idx) => (
                            <div key={idx} className="significance-item">
                              <strong>{feature}:</strong>
                              {sig.is_significant
                                ? " ✅ Significant"
                                : " ❌ Not Significant"}{" "}
                              (p={sig.p_value.toFixed(4)})
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                {compareResult.semantic_explanation &&
                  Object.keys(compareResult.semantic_explanation).length >
                    0 && (
                    <div className="drift-section">
                      <h4>🔍 Semantic Explanation</h4>
                      <ul className="explanation-list">
                        {Object.entries(compareResult.semantic_explanation).map(
                          ([col, msg], i) => (
                            <li key={i}>
                              <strong>{col}:</strong> {msg}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* Selected Snapshot Details */}
        {selected && (
          <div className="card details-card">
            <div className="card-header">
              <h3>🔍 Snapshot Details</h3>
              <button className="close-btn" onClick={() => setSelected(null)}>
                ✖
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
