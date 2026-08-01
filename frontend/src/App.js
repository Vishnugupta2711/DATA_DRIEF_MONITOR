// import { useState, useEffect, useCallback, useRef, useMemo } from "react";
// import "./App.css";
// import DriftChart from "./components/DriftChart";

// const API = "http://127.0.0.1:8000";

// // ============ HELPER FUNCTION FOR GENAI NORMALIZATION ============
// const normalizeGenAI = (data) => {
//   if (!data) return null;
//   if (typeof data === "string") return data;
//   if (Array.isArray(data)) return data.join("\n");
//   if (typeof data === "object") {
//     return Object.entries(data)
//       .map(([k, v]) => `• ${k}: ${v}`)
//       .join("\n");
//   }
//   return String(data);
// };

// function App() {
//   const [mode, setMode] = useState("login");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [token, setToken] = useState(localStorage.getItem("token") || "");
//   const [file, setFile] = useState(null);
//   const [dataset, setDataset] = useState("");
//   const [result, setResult] = useState(null);
//   const [history, setHistory] = useState([]);
//   const [selected, setSelected] = useState(null);
//   const [compare, setCompare] = useState([]);
//   const [compareResult, setCompareResult] = useState(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [notification, setNotification] = useState(null);

//   // GenAI State
//   const [genaiSummary, setGenaiSummary] = useState(null);
//   const [genaiExplanation, setGenaiExplanation] = useState(null);
//   const [genaiRemediation, setGenaiRemediation] = useState(null);

//   // Enhanced features
//   const [view, setView] = useState("dashboard");
//   const [predictions, setPredictions] = useState(null);
//   const [featureImportance, setFeatureImportance] = useState(null);
//   const [remediation, setRemediation] = useState(null);
//   const [alerts, setAlerts] = useState([]);
//   const [alertConfig, setAlertConfig] = useState({
//     threshold: 0.3,
//     channels: { email: true, slack: false, webhook: false, sms: false },
//     frequency: "immediate",
//   });
//   const [wsConnected, setWsConnected] = useState(false);
//   const [liveUpdates, setLiveUpdates] = useState([]);
//   const [selectedDataset, setSelectedDataset] = useState("");
//   const [filterSeverity, setFilterSeverity] = useState("all");

//   // New state for advanced features
//   const [batchFiles, setBatchFiles] = useState([]);
//   const [batchResults, setBatchResults] = useState(null);
//   const [scheduleConfig, setScheduleConfig] = useState({
//     dataset_path: "",
//     frequency: "daily",
//     enabled: true,
//   });
//   const [autoRetrainConfig, setAutoRetrainConfig] = useState({
//     drift_threshold: 0.5,
//     min_samples: 1000,
//     enabled: true,
//   });
//   const [dataQuality, setDataQuality] = useState(null);
//   const [multiCompareIds, setMultiCompareIds] = useState([]);
//   const [multiCompareResult, setMultiCompareResult] = useState(null);
//   const [healthStatus, setHealthStatus] = useState(null);
//   const [generatingSummary, setGeneratingSummary] = useState(false);

//   const wsRef = useRef(null);

//   const showNotification = (message, type = "success") => {
//     setNotification({ message, type });
//     setTimeout(() => setNotification(null), 4000);
//   };

//   const trendLabels = history
//     .slice()
//     .reverse()
//     .map((h) => new Date(h.timestamp).toLocaleTimeString());

//   const trendValues = history
//     .slice()
//     .reverse()
//     .map((h) => h.drift_score || 0);

//   // WebSocket Connection
//   useEffect(() => {
//     if (!token) return;

//     const connectWebSocket = () => {
//       const ws = new WebSocket(`ws://127.0.0.1:8000/ws/live-monitoring`);

//       ws.onopen = () => {
//         console.log("WebSocket connected");
//         setWsConnected(true);
//       };

//       ws.onmessage = (event) => {
//         const data = JSON.parse(event.data);

//         if (data.type === "new_snapshot") {
//           setLiveUpdates((prev) => [data.data, ...prev.slice(0, 9)]);
//           showNotification(`New snapshot: ${data.data.dataset_name}`, "info");
//           fetchHistory();
//         } else if (data.type === "heartbeat") {
//           // Keep-alive
//         } else if (data.type === "connected") {
//           console.log("WebSocket handshake complete");
//         }
//       };

//       ws.onclose = () => {
//         console.log("WebSocket disconnected");
//         setWsConnected(false);
//         setTimeout(connectWebSocket, 5000);
//       };

//       ws.onerror = (error) => {
//         console.error("WebSocket error:", error);
//       };

//       wsRef.current = ws;
//     };

//     connectWebSocket();

//     return () => {
//       if (wsRef.current) {
//         wsRef.current.close();
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [token]);

//   // Fetch health status periodically
//   useEffect(() => {
//     if (!token) return;

//     const fetchHealth = async () => {
//       try {
//         const res = await fetch(`${API}/health`);
//         const data = await res.json();
//         setHealthStatus(data);
//       } catch (error) {
//         console.error("Health check failed:", error);
//       }
//     };

//     fetchHealth();
//     const interval = setInterval(fetchHealth, 30000);

//     return () => clearInterval(interval);
//   }, [token]);

//   const fetchHistory = useCallback(async () => {
//     try {
//       const res = await fetch(`${API}/history`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error("Failed to fetch history");
//       const data = await res.json();
//       if (Array.isArray(data)) {
//         setHistory(data);

//         const newAlerts = data
//           .filter(
//             (h) => h.drift_severity === "high" || h.drift_severity === "medium"
//           )
//           .slice(0, 10)
//           .map((h) => ({
//             id: h.id,
//             message: `${h.drift_severity.toUpperCase()} drift detected in ${
//               h.dataset_name
//             }`,
//             severity: h.drift_severity,
//             timestamp: h.timestamp,
//             read: false,
//             drift_score: h.drift_score,
//           }));
//         setAlerts(newAlerts);
//       }
//     } catch (error) {
//       console.error("Fetch history error:", error);
//     }
//   }, [token]);

//   useEffect(() => {
//     if (token) fetchHistory();
//   }, [token, fetchHistory]);

//   const signup = async () => {
//     if (!email.trim() || !password.trim()) {
//       showNotification("Please enter both email and password", "error");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       const res = await fetch(
//         `${API}/auth/signup?email=${encodeURIComponent(
//           email
//         )}&password=${encodeURIComponent(password)}`,
//         { method: "POST" }
//       );
//       const data = await res.json();

//       if (res.ok && data.msg) {
//         showNotification("Signup successful! Please login.");
//         setMode("login");
//         setPassword("");
//       } else {
//         showNotification(data.detail || "Signup failed", "error");
//       }
//     } catch (error) {
//       showNotification("Signup failed", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const login = async () => {
//     if (!email.trim() || !password.trim()) {
//       showNotification("Please enter both email and password", "error");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       const res = await fetch(
//         `${API}/auth/login?email=${encodeURIComponent(
//           email
//         )}&password=${encodeURIComponent(password)}`,
//         { method: "POST" }
//       );
//       const data = await res.json();

//       if (res.ok && data.access_token) {
//         localStorage.setItem("token", data.access_token);
//         setToken(data.access_token);
//         showNotification("Login successful!");
//       } else {
//         showNotification(data.detail || "Login failed", "error");
//       }
//     } catch (error) {
//       showNotification("Login failed", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const upload = async () => {
//     if (!file) {
//       showNotification("Please select a file first", "error");
//       return;
//     }
//     if (!dataset.trim()) {
//       showNotification("Please enter a dataset name", "error");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       const form = new FormData();
//       form.append("file", file);

//       const res = await fetch(
//         `${API}/analyze?dataset_name=${encodeURIComponent(dataset.trim())}`,
//         {
//           method: "POST",
//           body: form,
//           headers: { Authorization: `Bearer ${token}` },
//         }
//       );

//       if (!res.ok) throw new Error("Upload failed");

//       const data = await res.json();

//       setResult(data);
//       // Normalize GenAI fields
//       setGenaiSummary(normalizeGenAI(data?.genai_summary));
//       setGenaiExplanation(normalizeGenAI(data?.genai_explanation));
//       setGenaiRemediation(normalizeGenAI(data?.genai_remediation));

//       setFile(null);
//       setDataset("");

//       await fetchHistory();
//       showNotification("Dataset analyzed successfully!");
//     } catch (error) {
//       console.error(error);
//       showNotification("Failed to analyze file", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const generateSummary = async (snapshotId) => {
//     setGeneratingSummary(true);
//     try {
//       const res = await fetch(`${API}/generate-summary/${snapshotId}`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!res.ok) throw new Error("Failed to generate summary");

//       const data = await res.json();

//       // Normalize GenAI fields
//       setGenaiSummary(normalizeGenAI(data.summary));
//       setGenaiExplanation(normalizeGenAI(data.explanation));
//       setGenaiRemediation(normalizeGenAI(data.remediation));

//       // Update result if it matches current snapshot
//       if (result && result.id === snapshotId) {
//         setResult((prev) => ({
//           ...prev,
//           genai_summary: normalizeGenAI(data.summary),
//           genai_explanation: normalizeGenAI(data.explanation),
//           genai_remediation: normalizeGenAI(data.remediation),
//         }));
//       }

//       showNotification("AI summary generated successfully!");
//     } catch (error) {
//       showNotification("Failed to generate summary", "error");
//     } finally {
//       setGeneratingSummary(false);
//     }
//   };

//   const uploadBatch = async () => {
//     if (batchFiles.length === 0) {
//       showNotification("Please select files for batch upload", "error");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       const form = new FormData();
//       batchFiles.forEach((file) => {
//         form.append("files", file);
//       });

//       const res = await fetch(`${API}/analyze-batch`, {
//         method: "POST",
//         body: form,
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!res.ok) throw new Error("Batch upload failed");

//       const data = await res.json();
//       setBatchResults(data);
//       setBatchFiles([]);
//       showNotification(`Batch queued: ${data.total_queued} files`);
//       setTimeout(fetchHistory, 2000);
//     } catch (error) {
//       showNotification("Batch upload failed", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const predictDrift = async () => {
//     if (!selectedDataset || selectedDataset === "all") {
//       showNotification("Please select a specific dataset", "error");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       const res = await fetch(`${API}/predict-drift`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ dataset_name: selectedDataset }),
//       });

//       if (!res.ok) {
//         const error = await res.json();
//         throw new Error(error.detail || "Prediction failed");
//       }

//       const data = await res.json();
//       setPredictions(data);
//       showNotification("Drift prediction completed!");
//     } catch (error) {
//       showNotification(error.message || "Failed to predict drift", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const loadFeatureImportance = async (snapId) => {
//     setIsLoading(true);
//     try {
//       const res = await fetch(`${API}/feature-importance/${snapId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!res.ok) {
//         const error = await res.json();
//         throw new Error(error.detail || "Failed to load feature importance");
//       }

//       const data = await res.json();
//       setFeatureImportance(data);
//       setView("insights");
//       showNotification("Feature importance loaded!");
//     } catch (error) {
//       showNotification(
//         error.message || "Failed to load feature importance",
//         "error"
//       );
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const loadRemediation = async (snapId) => {
//     setIsLoading(true);
//     try {
//       const res = await fetch(`${API}/remediation-suggest/${snapId}`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!res.ok) throw new Error("Failed to load remediation");

//       const data = await res.json();
//       setRemediation(data);
//     } catch (error) {
//       showNotification("Failed to load remediation", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const loadDataQuality = async (snapId) => {
//     setIsLoading(true);
//     try {
//       const res = await fetch(`${API}/data-quality/${snapId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!res.ok) throw new Error("Failed to load data quality");

//       const data = await res.json();
//       setDataQuality(data);
//       showNotification("Data quality metrics loaded!");
//     } catch (error) {
//       showNotification("Failed to load data quality", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const saveAlertConfig = async () => {
//     setIsLoading(true);
//     try {
//       const res = await fetch(`${API}/alert-config`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(alertConfig),
//       });

//       if (!res.ok) throw new Error("Failed to save config");

//       showNotification("Alert settings saved successfully!");
//     } catch (error) {
//       showNotification("Failed to save settings", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const scheduleMonitoring = async () => {
//     setIsLoading(true);
//     try {
//       const res = await fetch(`${API}/schedule-monitoring`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(scheduleConfig),
//       });

//       if (!res.ok) throw new Error("Failed to schedule monitoring");

//       showNotification(`Monitoring scheduled: ${scheduleConfig.frequency}`);
//     } catch (error) {
//       showNotification("Failed to schedule monitoring", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const saveAutoRetrainConfig = async () => {
//     setIsLoading(true);
//     try {
//       const res = await fetch(`${API}/auto-retrain-config`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(autoRetrainConfig),
//       });

//       if (!res.ok) throw new Error("Failed to save auto-retrain config");

//       showNotification("Auto-retrain settings saved!");
//     } catch (error) {
//       showNotification("Failed to save auto-retrain config", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const compareMultipleSnapshots = async () => {
//     if (multiCompareIds.length < 2) {
//       showNotification("Please select at least 2 snapshots", "error");
//       return;
//     }

//     setIsLoading(true);
//     try {
//       const res = await fetch(`${API}/compare-multiple`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ snapshot_ids: multiCompareIds }),
//       });

//       if (!res.ok) throw new Error("Multi-comparison failed");

//       const data = await res.json();
//       setMultiCompareResult(data);
//       showNotification("Multi-snapshot comparison completed!");
//     } catch (error) {
//       showNotification("Failed to compare snapshots", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const loadSnapshot = async (id) => {
//     try {
//       const res = await fetch(`${API}/snapshot/${id}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error("Failed to load snapshot");
//       const data = await res.json();
//       setSelected(data);

//       // Normalize GenAI fields
//       setGenaiSummary(normalizeGenAI(data?.genai_summary));
//       setGenaiExplanation(normalizeGenAI(data?.genai_explanation));
//       setGenaiRemediation(normalizeGenAI(data?.genai_remediation));
//     } catch (error) {
//       showNotification("Failed to load snapshot details", "error");
//     }
//   };

//   const deleteSnapshot = async (id) => {
//     if (!window.confirm("Are you sure you want to delete this snapshot?"))
//       return;

//     try {
//       const res = await fetch(`${API}/snapshot/${id}`, {
//         method: "DELETE",
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!res.ok) throw new Error("Delete failed");

//       if (compare.includes(id)) {
//         setCompare(compare.filter((x) => x !== id));
//         setCompareResult(null);
//       }

//       if (selected?.id === id) {
//         setSelected(null);
//       }

//       await fetchHistory();
//       showNotification("Snapshot deleted successfully");
//     } catch (error) {
//       showNotification("Failed to delete snapshot", "error");
//     }
//   };

//   const compareSnapshots = async () => {
//     if (compare.length !== 2) {
//       showNotification("Please select exactly 2 snapshots to compare", "error");
//       return;
//     }
//     setIsLoading(true);
//     try {
//       const res = await fetch(
//         `${API}/compare?a=${compare[0]}&b=${compare[1]}`,
//         {
//           headers: { Authorization: `Bearer ${token}` },
//         }
//       );
//       if (!res.ok) throw new Error("Comparison failed");
//       const data = await res.json();

//       // Normalize GenAI fields in comparison result
//       setCompareResult({
//         ...data,
//         genai_summary: normalizeGenAI(data.genai_summary),
//         genai_explanation: normalizeGenAI(data.genai_explanation),
//         genai_remediation: normalizeGenAI(data.genai_remediation),
//       });

//       showNotification("Comparison completed successfully");
//     } catch (error) {
//       showNotification("Failed to compare snapshots", "error");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const toggleCompare = (id) => {
//     setCompareResult(null);
//     if (compare.includes(id)) {
//       setCompare(compare.filter((x) => x !== id));
//     } else if (compare.length < 2) {
//       setCompare([...compare, id]);
//     } else {
//       setCompare([compare[1], id]);
//     }
//   };

//   const toggleMultiCompare = (id) => {
//     if (multiCompareIds.includes(id)) {
//       setMultiCompareIds(multiCompareIds.filter((x) => x !== id));
//     } else if (multiCompareIds.length < 10) {
//       setMultiCompareIds([...multiCompareIds, id]);
//     } else {
//       showNotification("Maximum 10 snapshots for comparison", "error");
//     }
//   };

//   const formatTime = (ts) =>
//     new Date(ts).toLocaleString(undefined, {
//       dateStyle: "medium",
//       timeStyle: "short",
//     });

//   const logout = () => {
//     localStorage.removeItem("token");
//     setToken("");
//     setHistory([]);
//     setResult(null);
//     setSelected(null);
//     setCompare([]);
//     setCompareResult(null);
//     setPredictions(null);
//     setFeatureImportance(null);
//     setRemediation(null);
//     setAlerts([]);
//     setLiveUpdates([]);
//     setDataQuality(null);
//     setMultiCompareIds([]);
//     setMultiCompareResult(null);
//     setGenaiSummary(null);
//     setGenaiExplanation(null);
//     setGenaiRemediation(null);

//     showNotification("Logged out successfully");
//   };

//   const filteredHistory = history.filter((h) => {
//     const matchesDataset =
//       selectedDataset === "all" ||
//       selectedDataset === "" ||
//       h.dataset_name === selectedDataset;
//     const matchesSeverity =
//       filterSeverity === "all" || h.drift_severity === filterSeverity;
//     return matchesDataset && matchesSeverity;
//   });

//   const datasets = useMemo(() => {
//     const uniqueDatasets = [
//       ...new Set(history.map((h) => h.dataset_name?.trim()).filter(Boolean)),
//     ];
//     return uniqueDatasets;
//   }, [history]);

//   useEffect(() => {
//     if (datasets.length > 0 && !selectedDataset) {
//       setSelectedDataset(datasets[0]);
//     } else if (datasets.length === 0) {
//       setSelectedDataset("");
//     } else if (selectedDataset && !datasets.includes(selectedDataset)) {
//       setSelectedDataset(datasets[0]);
//     }
//   }, [datasets, selectedDataset]);

//   if (!token) {
//     return (
//       <div className="auth-container">
//         <div className="auth-navbar">
//           <div className="auth-navbar-left">
//             <div className="navbar-logo">
//               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//                 <path
//                   d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
//                   strokeWidth="2"
//                 />
//               </svg>
//             </div>
//             <span className="navbar-title">Data Drift Monitor Pro</span>
//           </div>

//           <div className="auth-navbar-right">
//             <button
//               className={mode === "login" ? "active" : ""}
//               onClick={() => setMode("login")}
//             >
//               Login
//             </button>
//             <button
//               className={mode === "signup" ? "active" : ""}
//               onClick={() => setMode("signup")}
//             >
//               Signup
//             </button>
//           </div>
//         </div>

//         <div className="animated-bg">
//           <div className="gradient-orb orb-1"></div>
//           <div className="gradient-orb orb-2"></div>
//           <div className="gradient-orb orb-3"></div>
//         </div>

//         <div className="auth-card">
//           <div className="logo-container">
//             <div className="logo-icon">
//               <div className="pulse-ring"></div>
//               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//                 <path
//                   d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
//                   strokeWidth="2"
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                 />
//               </svg>
//             </div>
//             <h1>Data Drift Monitor Pro</h1>
//             <p className="subtitle">AI-powered ML monitoring</p>
//           </div>

//           <div className="auth-tabs">
//             <button
//               className={mode === "login" ? "active" : ""}
//               onClick={() => setMode("login")}
//             >
//               Login
//             </button>
//             <button
//               className={mode === "signup" ? "active" : ""}
//               onClick={() => setMode("signup")}
//             >
//               Signup
//             </button>
//           </div>

//           <div className="input-group">
//             <input
//               type="email"
//               placeholder="Email"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               onKeyPress={(e) =>
//                 e.key === "Enter" && (mode === "login" ? login() : signup())
//               }
//               className="styled-input"
//             />
//             <input
//               type="password"
//               placeholder="Password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               onKeyPress={(e) =>
//                 e.key === "Enter" && (mode === "login" ? login() : signup())
//               }
//               className="styled-input"
//             />
//           </div>

//           <button
//             className={`primary-btn ${isLoading ? "loading" : ""}`}
//             onClick={mode === "login" ? login : signup}
//             disabled={isLoading}
//           >
//             {isLoading ? (
//               <span className="spinner"></span>
//             ) : mode === "login" ? (
//               "Login"
//             ) : (
//               "Create Account"
//             )}
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="app">
//       <div className="animated-bg">
//         <div className="gradient-orb orb-1"></div>
//         <div className="gradient-orb orb-2"></div>
//         <div className="gradient-orb orb-3"></div>
//       </div>

//       {notification && (
//         <div className={`notification ${notification.type}`}>
//           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//             <path
//               d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             />
//           </svg>
//           {notification.message}
//         </div>
//       )}

//       <div className="top-bar">
//         <div className="logo-section">
//           <div className="logo-icon-small">
//             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//               <path
//                 d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
//                 strokeWidth="2"
//               />
//             </svg>
//           </div>
//           <h1>Drift Monitor Pro</h1>
//           {wsConnected && <span className="ws-status">🟢 Live</span>}
//           {healthStatus && (
//             <span
//               className="health-status"
//               title={`Redis: ${healthStatus.redis_status}, Jobs: ${healthStatus.scheduled_jobs}`}
//             >
//               ❤️ {healthStatus.status}
//             </span>
//           )}
//         </div>
//         <div className="top-bar-actions">
//           <span className="alert-badge" onClick={() => setView("alerts")}>
//             🔔 {alerts.filter((a) => !a.read).length}
//           </span>
//           <button className="logout-btn" onClick={logout}>
//             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
//               <path
//                 d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
//                 strokeWidth="2"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//               />
//             </svg>
//             Logout
//           </button>
//         </div>
//       </div>

//       <div className="view-tabs">
//         <button
//           className={view === "dashboard" ? "active" : ""}
//           onClick={() => setView("dashboard")}
//         >
//           📊 Dashboard
//         </button>
//         <button
//           className={view === "upload" ? "active" : ""}
//           onClick={() => setView("upload")}
//         >
//           📤 Upload
//         </button>
//         <button
//           className={view === "batch" ? "active" : ""}
//           onClick={() => setView("batch")}
//         >
//           📦 Batch Upload
//         </button>
//         <button
//           className={view === "predictions" ? "active" : ""}
//           onClick={() => setView("predictions")}
//         >
//           🔮 Predictions
//         </button>
//         <button
//           className={view === "alerts" ? "active" : ""}
//           onClick={() => setView("alerts")}
//         >
//           🚨 Alerts{" "}
//           {alerts.filter((a) => !a.read).length > 0 &&
//             `(${alerts.filter((a) => !a.read).length})`}
//         </button>
//         <button
//           className={view === "insights" ? "active" : ""}
//           onClick={() => setView("insights")}
//         >
//           💡 Insights
//         </button>
//         <button
//           className={view === "automation" ? "active" : ""}
//           onClick={() => setView("automation")}
//         >
//           ⚙️ Automation
//         </button>
//         <button
//           className={view === "history" ? "active" : ""}
//           onClick={() => setView("history")}
//         >
//           📜 History
//         </button>
//       </div>

//       <div className="container">
//         {view === "dashboard" && (
//           <>
//             <div className="stats-grid">
//               <div className="stat-card blue">
//                 <div className="stat-icon">📊</div>
//                 <div className="stat-info">
//                   <div className="stat-value">{history.length}</div>
//                   <div className="stat-label">Total Snapshots</div>
//                 </div>
//               </div>
//               <div className="stat-card red">
//                 <div className="stat-icon">⚠️</div>
//                 <div className="stat-info">
//                   <div className="stat-value">
//                     {history.filter((h) => h.drift_severity === "high").length}
//                   </div>
//                   <div className="stat-label">High Severity</div>
//                 </div>
//               </div>
//               <div className="stat-card green">
//                 <div className="stat-icon">✅</div>
//                 <div className="stat-info">
//                   <div className="stat-value">
//                     {history.filter((h) => h.drift_severity === "low").length}
//                   </div>
//                   <div className="stat-label">Low Drift</div>
//                 </div>
//               </div>
//               <div className="stat-card purple">
//                 <div className="stat-icon">🗂️</div>
//                 <div className="stat-info">
//                   <div className="stat-value">{datasets.length}</div>
//                   <div className="stat-label">Datasets</div>
//                 </div>
//               </div>
//             </div>

//             {liveUpdates.length > 0 && (
//               <div className="card live-updates-card">
//                 <div className="card-header">
//                   <h3>⚡ Live Updates</h3>
//                 </div>
//                 <div className="card-content">
//                   {liveUpdates.map((update, idx) => (
//                     <div key={idx} className="live-update-item">
//                       <div className="live-update-info">
//                         <strong>{update.dataset_name}</strong>
//                         <span>
//                           {new Date(update.timestamp).toLocaleString()}
//                         </span>
//                       </div>
//                       <span className={`badge ${update.severity}`}>
//                         {((update.drift_score || 0) * 100).toFixed(1)}%
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {history.length > 1 && (
//               <div className="card chart-card">
//                 <div className="card-header">
//                   <h3>Drift Trend Over Time</h3>
//                   <span className="trend-badge">
//                     📈 {history.length} data points
//                   </span>
//                 </div>
//                 <div className="card-content">
//                   <DriftChart labels={trendLabels} values={trendValues} />
//                 </div>
//               </div>
//             )}

//             <div className="card">
//               <div className="card-header">
//                 <h3>Recent Snapshots</h3>
//                 <div className="header-actions">
//                   <select
//                     value={filterSeverity}
//                     onChange={(e) => setFilterSeverity(e.target.value)}
//                     className="filter-select"
//                   >
//                     <option value="all">All Severities</option>
//                     <option value="high">High</option>
//                     <option value="medium">Medium</option>
//                     <option value="low">Low</option>
//                   </select>
//                   <button className="refresh-btn" onClick={fetchHistory}>
//                     🔄 Refresh
//                   </button>
//                 </div>
//               </div>
//               <div className="card-content">
//                 {filteredHistory.slice(0, 5).map((h) => (
//                   <div
//                     key={h.id}
//                     className="snapshot-item"
//                     onClick={() => {
//                       loadSnapshot(h.id);
//                       loadFeatureImportance(h.id);
//                       loadRemediation(h.id);
//                       loadDataQuality(h.id);
//                     }}
//                   >
//                     <div className="snapshot-info">
//                       <div className={`severity-dot ${h.drift_severity}`}></div>
//                       <div>
//                         <div className="snapshot-name">{h.dataset_name}</div>
//                         <div className="snapshot-time">
//                           {formatTime(h.timestamp)}
//                         </div>
//                       </div>
//                     </div>
//                     <span className={`badge ${h.drift_severity}`}>
//                       {((h.drift_score || 0) * 100).toFixed(1)}%
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </>
//         )}

//         {view === "upload" && (
//           <>
//             <div className="card upload-card">
//               <div className="card-header">
//                 <h3>Upload Dataset</h3>
//               </div>
//               <div className="card-content">
//                 <div className="input-wrapper">
//                   <label>Dataset Name *</label>
//                   <input
//                     placeholder="e.g., customer_data_2024"
//                     value={dataset}
//                     onChange={(e) => setDataset(e.target.value)}
//                     className="styled-input"
//                   />
//                 </div>
//                 <div className="upload-area">
//                   <input
//                     type="file"
//                     id="file-upload"
//                     onChange={(e) => setFile(e.target.files[0])}
//                     className="file-input"
//                     accept=".csv"
//                   />
//                   <label
//                     htmlFor="file-upload"
//                     className={`file-label ${file ? "has-file" : ""}`}
//                   >
//                     📁 {file ? file.name : "Choose CSV file"}
//                   </label>
//                   <button
//                     className={`analyze-btn ${isLoading ? "loading" : ""}`}
//                     onClick={upload}
//                     disabled={isLoading}
//                   >
//                     {isLoading ? "Analyzing..." : "Analyze"}
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {result && (
//               <div className="card result-card">
//                 <div className="card-header">
//                   <h3>Analysis Result</h3>
//                   {result.id && (
//                     <button
//                       className={`secondary-btn ${
//                         generatingSummary ? "loading" : ""
//                       }`}
//                       onClick={() => generateSummary(result.id)}
//                       disabled={generatingSummary}
//                     >
//                       {generatingSummary
//                         ? "Generating..."
//                         : "🧠 Generate AI Summary"}
//                     </button>
//                   )}
//                 </div>

//                 <div className="card-content">
//                   <div className="result-stats">
//                     <div className="stat-item">
//                       <span className="stat-label">Score</span>
//                       <span className="stat-value">
//                         {(result.score * 100).toFixed(1)}%
//                       </span>
//                     </div>
//                     <div className="stat-item">
//                       <span className="stat-label">Severity</span>
//                       <span className={`badge ${result.severity}`}>
//                         {result.severity}
//                       </span>
//                     </div>
//                     <div className="stat-item">
//                       <span className="stat-label">Features</span>
//                       <span className="stat-value">
//                         {result.features_analyzed}
//                       </span>
//                     </div>
//                   </div>

//                   {result.quality_metrics && (
//                     <div className="quality-overview">
//                       <h4>📊 Data Quality Score</h4>
//                       <div className="quality-score-big">
//                         {(result.quality_metrics.overall_score * 100).toFixed(
//                           0
//                         )}
//                         %
//                       </div>
//                       <div className="quality-breakdown">
//                         <div>
//                           Completeness:{" "}
//                           {(result.quality_metrics.completeness * 100).toFixed(
//                             0
//                           )}
//                           %
//                         </div>
//                         <div>
//                           Validity:{" "}
//                           {(result.quality_metrics.validity * 100).toFixed(0)}%
//                         </div>
//                       </div>
//                     </div>
//                   )}

//                   {genaiSummary && genaiSummary.trim() !== "" && (
//                     <div className="genai-summary">
//                       <h4>🧠 Executive Summary</h4>
//                       <pre className="genai-text">{genaiSummary}</pre>
//                     </div>
//                   )}

//                   <div className="drift-list">
//                     {result.drift.length === 0 ? (
//                       <div className="no-drift">✅ No drift detected</div>
//                     ) : (
//                       result.drift.map((d, i) => (
//                         <div key={i} className="drift-item">
//                           ⚠️{" "}
//                           {typeof d === "object" ? (
//                             <>
//                               {d.type === "column_renamed_or_missing" && (
//                                 <>
//                                   🔁 Column <strong>{d.old_column}</strong>{" "}
//                                   renamed/missing →{" "}
//                                   <strong>{d.best_match || "none"}</strong> (
//                                   {((d.similarity || 0) * 100).toFixed(0)}%)
//                                 </>
//                               )}

//                               {d.type === "type_changed" && (
//                                 <>
//                                   🔄 Type change in <strong>{d.column}</strong>:{" "}
//                                   {d.old_type} → {d.new_type}
//                                 </>
//                               )}

//                               {d.type === "categorical_shift" && (
//                                 <>
//                                   📊 Categorical shift in{" "}
//                                   <strong>{d.column}</strong> (Jaccard{" "}
//                                   {((d.jaccard_similarity || 0) * 100).toFixed(
//                                     0
//                                   )}
//                                   %)
//                                 </>
//                               )}

//                               {!d.type && JSON.stringify(d)}
//                             </>
//                           ) : (
//                             d
//                           )}
//                         </div>
//                       ))
//                     )}
//                   </div>

//                   {genaiExplanation && genaiExplanation.trim() !== "" && (
//                     <div className="genai-explanation">
//                       <h4>🔍 AI Explanation</h4>
//                       <pre className="genai-text">{genaiExplanation}</pre>
//                     </div>
//                   )}

//                   {genaiRemediation && genaiRemediation.trim() !== "" && (
//                     <div className="genai-remediation">
//                       <h4>🔧 AI Remediation Suggestions</h4>
//                       <pre className="genai-text">{genaiRemediation}</pre>
//                     </div>
//                   )}

//                   {result.predicted_impact && (
//                     <div className="predicted-impact">
//                       <strong>🧠 Predicted Impact:</strong>
//                       <p>
//                         Model accuracy may drop by{" "}
//                         {(
//                           result.predicted_impact.model_accuracy_drop * 100
//                         ).toFixed(1)}
//                         %
//                       </p>
//                       <p>
//                         Recommended:{" "}
//                         <strong>
//                           {result.predicted_impact.recommended_action}
//                         </strong>
//                       </p>
//                     </div>
//                   )}

//                   {result.anomaly_report &&
//                     Object.keys(result.anomaly_report).length > 0 && (
//                       <div className="anomaly-section">
//                         <h4>🚨 Anomaly Detection</h4>
//                         {Object.entries(result.anomaly_report)
//                           .slice(0, 5)
//                           .map(([feature, anomaly], idx) => (
//                             <div key={idx} className="anomaly-item">
//                               <strong>{feature}:</strong>{" "}
//                               {anomaly.has_anomalies
//                                 ? "⚠️ Detected"
//                                 : "✅ Normal"}
//                             </div>
//                           ))}
//                       </div>
//                     )}
//                 </div>
//               </div>
//             )}
//           </>
//         )}

//         {view === "batch" && (
//           <div className="card">
//             <div className="card-header">
//               <h3>📦 Batch Upload</h3>
//               <span className="info-badge">Max 10 files</span>
//             </div>
//             <div className="card-content">
//               <div className="batch-upload-area">
//                 <input
//                   type="file"
//                   id="batch-upload"
//                   multiple
//                   onChange={(e) => setBatchFiles(Array.from(e.target.files))}
//                   className="file-input"
//                   accept=".csv"
//                 />
//                 <label htmlFor="batch-upload" className="file-label">
//                   📁{" "}
//                   {batchFiles.length > 0
//                     ? `${batchFiles.length} files selected`
//                     : "Choose multiple CSV files"}
//                 </label>

//                 {batchFiles.length > 0 && (
//                   <div className="batch-file-list">
//                     {batchFiles.map((f, idx) => (
//                       <div key={idx} className="batch-file-item">
//                         <span>📄 {f.name}</span>
//                         <button
//                           className="remove-file-btn"
//                           onClick={() =>
//                             setBatchFiles(
//                               batchFiles.filter((_, i) => i !== idx)
//                             )
//                           }
//                         >
//                           ✖
//                         </button>
//                       </div>
//                     ))}
//                   </div>
//                 )}

//                 <button
//                   className={`primary-btn ${isLoading ? "loading" : ""}`}
//                   onClick={uploadBatch}
//                   disabled={isLoading || batchFiles.length === 0}
//                 >
//                   {isLoading ? "Processing..." : "Analyze Batch"}
//                 </button>
//               </div>

//               {batchResults && (
//                 <div className="batch-results">
//                   <h4>Batch Processing Results</h4>
//                   <p>Batch ID: {batchResults.batch_id}</p>
//                   <p>Files Queued: {batchResults.total_queued}</p>
//                   <div className="batch-status-list">
//                     {batchResults.files.map((file, idx) => (
//                       <div key={idx} className="batch-status-item">
//                         <span>{file.filename}</span>
//                         <span className={`status-badge ${file.status}`}>
//                           {file.status}
//                         </span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         )}

//         {view === "predictions" && (
//           <div className="card">
//             <div className="card-header">
//               <h3>🔮 Drift Predictions</h3>
//               <button
//                 className="primary-btn"
//                 onClick={predictDrift}
//                 disabled={isLoading || !selectedDataset}
//               >
//                 {isLoading ? "Predicting..." : "Generate Prediction"}
//               </button>
//             </div>
//             <div className="card-content">
//               <div className="input-wrapper">
//                 <label>Select Dataset</label>
//                 <select
//                   value={selectedDataset}
//                   onChange={(e) => setSelectedDataset(e.target.value)}
//                   className="styled-input"
//                 >
//                   {datasets.length === 0 ? (
//                     <option value="">No datasets available</option>
//                   ) : (
//                     datasets.map((ds) => (
//                       <option key={ds} value={ds}>
//                         {ds}
//                       </option>
//                     ))
//                   )}
//                 </select>
//               </div>

//               {predictions && (
//                 <>
//                   <div className="prediction-stats">
//                     <div className="prediction-stat">
//                       <span className="label">Risk Level</span>
//                       <span className={`value risk-${predictions.risk_level}`}>
//                         {predictions.risk_level.toUpperCase()}
//                       </span>
//                     </div>
//                     <div className="prediction-stat">
//                       <span className="label">Monitoring Frequency</span>
//                       <span className="value">
//                         {predictions.suggested_monitoring_frequency}
//                       </span>
//                     </div>
//                   </div>

//                   <div className="prediction-chart">
//                     <h4>7-Day Forecast</h4>
//                     {predictions.next_7_days.map((day, idx) => (
//                       <div key={idx} className="prediction-day">
//                         <span>Day {day.day}</span>
//                         <div className="prediction-bar">
//                           <div
//                             className="prediction-fill"
//                             style={{ width: `${day.predicted_score * 100}%` }}
//                           ></div>
//                         </div>
//                         <span>{(day.predicted_score * 100).toFixed(1)}%</span>
//                         <span className="confidence">
//                           ({(day.confidence * 100).toFixed(0)}% confident)
//                         </span>
//                       </div>
//                     ))}
//                   </div>
//                 </>
//               )}

//               {!predictions && (
//                 <div className="empty-state">
//                   <p>
//                     Select a dataset and generate predictions to see the
//                     forecast
//                   </p>
//                 </div>
//               )}
//             </div>
//           </div>
//         )}

//         {view === "automation" && (
//           <>
//             <div className="card">
//               <div className="card-header">
//                 <h3>⏰ Schedule Monitoring</h3>
//               </div>
//               <div className="card-content">
//                 <div className="input-wrapper">
//                   <label>Dataset Path</label>
//                   <input
//                     placeholder="/path/to/dataset.csv"
//                     value={scheduleConfig.dataset_path}
//                     onChange={(e) =>
//                       setScheduleConfig({
//                         ...scheduleConfig,
//                         dataset_path: e.target.value,
//                       })
//                     }
//                     className="styled-input"
//                   />
//                 </div>

//                 <div className="input-wrapper">
//                   <label>Frequency</label>
//                   <select
//                     value={scheduleConfig.frequency}
//                     onChange={(e) =>
//                       setScheduleConfig({
//                         ...scheduleConfig,
//                         frequency: e.target.value,
//                       })
//                     }
//                     className="styled-input"
//                   >
//                     <option value="hourly">Hourly</option>
//                     <option value="daily">Daily</option>
//                     <option value="weekly">Weekly</option>
//                   </select>
//                 </div>

//                 <button
//                   className="primary-btn"
//                   onClick={scheduleMonitoring}
//                   disabled={isLoading || !scheduleConfig.dataset_path}
//                 >
//                   {isLoading ? "Scheduling..." : "Schedule Monitoring"}
//                 </button>
//               </div>
//             </div>

//             <div className="card">
//               <div className="card-header">
//                 <h3>🤖 Auto-Retrain Configuration</h3>
//               </div>
//               <div className="card-content">
//                 <div className="config-section">
//                   <label>
//                     Drift Threshold:{" "}
//                     {(autoRetrainConfig.drift_threshold * 100).toFixed(0)}%
//                   </label>
//                   <input
//                     type="range"
//                     min="0"
//                     max="1"
//                     step="0.05"
//                     value={autoRetrainConfig.drift_threshold}
//                     onChange={(e) =>
//                       setAutoRetrainConfig({
//                         ...autoRetrainConfig,
//                         drift_threshold: parseFloat(e.target.value),
//                       })
//                     }
//                     className="slider"
//                   />
//                 </div>

//                 <div className="input-wrapper">
//                   <label>Minimum Samples</label>
//                   <input
//                     type="number"
//                     value={autoRetrainConfig.min_samples}
//                     onChange={(e) =>
//                       setAutoRetrainConfig({
//                         ...autoRetrainConfig,
//                         min_samples: parseInt(e.target.value),
//                       })
//                     }
//                     className="styled-input"
//                     min="100"
//                   />
//                 </div>

//                 <label className="checkbox-label">
//                   <input
//                     type="checkbox"
//                     checked={autoRetrainConfig.enabled}
//                     onChange={(e) =>
//                       setAutoRetrainConfig({
//                         ...autoRetrainConfig,
//                         enabled: e.target.checked,
//                       })
//                     }
//                   />
//                   Enable Auto-Retrain
//                 </label>

//                 <button
//                   className="primary-btn"
//                   onClick={saveAutoRetrainConfig}
//                   disabled={isLoading}
//                 >
//                   {isLoading ? "Saving..." : "Save Configuration"}
//                 </button>
//               </div>
//             </div>
//           </>
//         )}

//         {view === "alerts" && (
//           <>
//             <div className="card">
//               <div className="card-header">
//                 <h3>🚨 Alert Center</h3>
//                 <button
//                   className="secondary-btn"
//                   onClick={() =>
//                     setAlerts(alerts.map((a) => ({ ...a, read: true })))
//                   }
//                 >
//                   Mark All as Read
//                 </button>
//               </div>
//               <div className="card-content">
//                 {alerts.length === 0 ? (
//                   <div className="empty-state">
//                     <p>✅ No alerts. Everything looks good!</p>
//                   </div>
//                 ) : (
//                   <div className="alerts-list">
//                     {alerts.map((alert) => (
//                       <div
//                         key={alert.id}
//                         className={`alert-item ${
//                           alert.read ? "read" : "unread"
//                         }`}
//                       >
//                         <div className="alert-icon">⚠️</div>
//                         <div className="alert-content">
//                           <div className="alert-message">{alert.message}</div>
//                           <div className="alert-time">
//                             {formatTime(alert.timestamp)} •{" "}
//                             {((alert.drift_score || 0) * 100).toFixed(1)}% drift
//                           </div>
//                         </div>
//                         <button
//                           className="delete-icon-btn"
//                           onClick={() =>
//                             setAlerts(alerts.filter((a) => a.id !== alert.id))
//                           }
//                         >
//                           🗑️
//                         </button>
//                       </div>
//                     ))}
//                   </div>
//                 )}
//               </div>
//             </div>

//             <div className="card">
//               <div className="card-header">
//                 <h3>⚙️ Alert Configuration</h3>
//               </div>
//               <div className="card-content">
//                 <div className="config-section">
//                   <label>
//                     Drift Threshold: {(alertConfig.threshold * 100).toFixed(0)}%
//                   </label>
//                   <input
//                     type="range"
//                     min="0"
//                     max="1"
//                     step="0.05"
//                     value={alertConfig.threshold}
//                     onChange={(e) =>
//                       setAlertConfig({
//                         ...alertConfig,
//                         threshold: parseFloat(e.target.value),
//                       })
//                     }
//                     className="slider"
//                   />
//                 </div>

//                 <div className="config-section">
//                   <label>Notification Channels</label>
//                   <div className="checkbox-group">
//                     <label className="checkbox-label">
//                       <input
//                         type="checkbox"
//                         checked={alertConfig.channels.email}
//                         onChange={(e) =>
//                           setAlertConfig({
//                             ...alertConfig,
//                             channels: {
//                               ...alertConfig.channels,
//                               email: e.target.checked,
//                             },
//                           })
//                         }
//                       />
//                       📧 Email Notifications
//                     </label>
//                     <label className="checkbox-label">
//                       <input
//                         type="checkbox"
//                         checked={alertConfig.channels.slack}
//                         onChange={(e) =>
//                           setAlertConfig({
//                             ...alertConfig,
//                             channels: {
//                               ...alertConfig.channels,
//                               slack: e.target.checked,
//                             },
//                           })
//                         }
//                       />
//                       💬 Slack Integration
//                     </label>
//                     <label className="checkbox-label">
//                       <input
//                         type="checkbox"
//                         checked={alertConfig.channels.webhook}
//                         onChange={(e) =>
//                           setAlertConfig({
//                             ...alertConfig,
//                             channels: {
//                               ...alertConfig.channels,
//                               webhook: e.target.checked,
//                             },
//                           })
//                         }
//                       />
//                       🔗 Webhook
//                     </label>
//                     <label className="checkbox-label">
//                       <input
//                         type="checkbox"
//                         checked={alertConfig.channels.sms}
//                         onChange={(e) =>
//                           setAlertConfig({
//                             ...alertConfig,
//                             channels: {
//                               ...alertConfig.channels,
//                               sms: e.target.checked,
//                             },
//                           })
//                         }
//                       />
//                       📱 SMS Alerts
//                     </label>
//                   </div>
//                 </div>

//                 <div className="config-section">
//                   <label>Alert Frequency</label>
//                   <select
//                     value={alertConfig.frequency}
//                     onChange={(e) =>
//                       setAlertConfig({
//                         ...alertConfig,
//                         frequency: e.target.value,
//                       })
//                     }
//                     className="styled-input"
//                   >
//                     <option value="immediate">Immediate</option>
//                     <option value="hourly">Hourly Digest</option>
//                     <option value="daily">Daily Digest</option>
//                     <option value="weekly">Weekly Digest</option>
//                   </select>
//                 </div>

//                 <button
//                   className="primary-btn"
//                   onClick={saveAlertConfig}
//                   disabled={isLoading}
//                 >
//                   {isLoading ? "Saving..." : "Save Settings"}
//                 </button>
//               </div>
//             </div>
//           </>
//         )}

//         {view === "insights" && (
//           <>
//             {featureImportance && (
//               <div className="card">
//                 <div className="card-header">
//                   <h3>💡 Feature Importance Analysis</h3>
//                 </div>
//                 <div className="card-content">
//                   <div className="top-features">
//                     <h4>Top Drifting Features</h4>
//                     <div className="feature-tags">
//                       {featureImportance.top_drifting_features.map(
//                         (feature, idx) => (
//                           <span key={idx} className="feature-tag">
//                             #{idx + 1} {feature}
//                           </span>
//                         )
//                       )}
//                     </div>
//                   </div>

//                   <div className="features-list">
//                     {featureImportance.features
//                       .slice(0, 10)
//                       .map((feat, idx) => (
//                         <div key={idx} className="feature-item">
//                           <span className="feature-name">{feat.name}</span>
//                           <div className="feature-bar-container">
//                             <div
//                               className="feature-bar"
//                               style={{ width: `${feat.drift_score * 100}%` }}
//                             ></div>
//                           </div>
//                           <span className="feature-score">
//                             {(feat.drift_score * 100).toFixed(1)}%
//                           </span>
//                         </div>
//                       ))}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {dataQuality && (
//               <div className="card">
//                 <div className="card-header">
//                   <h3>📊 Data Quality Metrics</h3>
//                 </div>
//                 <div className="card-content">
//                   <div className="quality-grid">
//                     <div className="quality-metric">
//                       <div className="quality-label">Overall Score</div>
//                       <div className="quality-value-large">
//                         {(
//                           dataQuality.quality_metrics.overall_score * 100
//                         ).toFixed(0)}
//                         %
//                       </div>
//                     </div>
//                     <div className="quality-metric">
//                       <div className="quality-label">Completeness</div>
//                       <div className="quality-value">
//                         {(
//                           dataQuality.quality_metrics.completeness * 100
//                         ).toFixed(0)}
//                         %
//                       </div>
//                     </div>
//                     <div className="quality-metric">
//                       <div className="quality-label">Validity</div>
//                       <div className="quality-value">
//                         {(dataQuality.quality_metrics.validity * 100).toFixed(
//                           0
//                         )}
//                         %
//                       </div>
//                     </div>
//                     <div className="quality-metric">
//                       <div className="quality-label">Consistency</div>
//                       <div className="quality-value">
//                         {(
//                           dataQuality.quality_metrics.consistency * 100
//                         ).toFixed(0)}
//                         %
//                       </div>
//                     </div>
//                   </div>

//                   {dataQuality.recommendations &&
//                     dataQuality.recommendations.length > 0 && (
//                       <div className="recommendations-section">
//                         <h4>💡 Recommendations</h4>
//                         {dataQuality.recommendations.map((rec, idx) => (
//                           <div key={idx} className="recommendation-item">
//                             {rec}
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                 </div>
//               </div>
//             )}

//             {remediation && (
//               <div className="card">
//                 <div className="card-header">
//                   <h3>🔧 Remediation Suggestions</h3>
//                 </div>
//                 <div className="card-content">
//                   <div className="remediation-stats">
//                     <div
//                       className={`remediation-stat priority-${remediation.priority}`}
//                     >
//                       <span className="label">Priority</span>
//                       <span className="value">
//                         {remediation.priority.toUpperCase()}
//                       </span>
//                     </div>
//                     <div className="remediation-stat">
//                       <span className="label">Severity</span>
//                       <span className="value">{remediation.severity}</span>
//                     </div>
//                   </div>

//                   <div className="impact-box">
//                     <strong>📊 Estimated Impact:</strong>
//                     <p>{remediation.estimated_impact}</p>
//                   </div>

//                   <div className="suggestions-list">
//                     <h4>Recommended Actions</h4>
//                     {remediation.suggestions.map((suggestion, idx) => (
//                       <div key={idx} className="suggestion-item">
//                         <span className="suggestion-number">{idx + 1}</span>
//                         <span className="suggestion-text">{suggestion}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {!featureImportance && !remediation && !dataQuality && (
//               <div className="card">
//                 <div className="card-content">
//                   <div className="empty-state">
//                     <p>💡 Click on a snapshot to view detailed insights</p>
//                   </div>
//                 </div>
//               </div>
//             )}
//           </>
//         )}

//         {view === "history" && (
//           <>
//             <div className="card history-card">
//               <div className="card-header">
//                 <div className="header-with-badge">
//                   <h3>📜 Snapshot History</h3>
//                   {history.length > 0 && (
//                     <span className="count-badge">{history.length}</span>
//                   )}
//                 </div>
//                 <div className="header-actions">
//                   <button className="refresh-btn" onClick={fetchHistory}>
//                     🔄 Refresh
//                   </button>
//                   {compare.length === 2 && (
//                     <button
//                       className={`compare-btn ${isLoading ? "loading" : ""}`}
//                       onClick={compareSnapshots}
//                       disabled={isLoading}
//                     >
//                       {isLoading ? "Comparing..." : "Compare Selected (2)"}
//                     </button>
//                   )}
//                   {multiCompareIds.length >= 2 && (
//                     <button
//                       className={`compare-btn ${isLoading ? "loading" : ""}`}
//                       onClick={compareMultipleSnapshots}
//                       disabled={isLoading}
//                     >
//                       {isLoading
//                         ? "Comparing..."
//                         : `Multi-Compare (${multiCompareIds.length})`}
//                     </button>
//                   )}
//                 </div>
//               </div>
//               <div className="card-content">
//                 {(compare.length > 0 || multiCompareIds.length > 0) && (
//                   <div className="selection-indicator">
//                     <span>
//                       📋 {compare.length} standard / {multiCompareIds.length}{" "}
//                       multi-compare selected
//                     </span>
//                     <button
//                       className="clear-btn"
//                       onClick={() => {
//                         setCompare([]);
//                         setMultiCompareIds([]);
//                         setCompareResult(null);
//                         setMultiCompareResult(null);
//                       }}
//                     >
//                       ✖ Clear All
//                     </button>
//                   </div>
//                 )}

//                 <ul className="history-list">
//                   {history.length === 0 ? (
//                     <li className="empty-state">
//                       <p>
//                         📦 No snapshots yet. Upload a dataset to get started!
//                       </p>
//                     </li>
//                   ) : (
//                     history.map((h) => (
//                       <li key={h.id} className="history-item">
//                         <input
//                           type="checkbox"
//                           checked={compare.includes(h.id)}
//                           onChange={() => toggleCompare(h.id)}
//                           className="history-checkbox"
//                           title="2-way compare"
//                         />
//                         <input
//                           type="checkbox"
//                           checked={multiCompareIds.includes(h.id)}
//                           onChange={() => toggleMultiCompare(h.id)}
//                           className="history-checkbox multi"
//                           title="Multi-compare"
//                         />
//                         <div
//                           className="history-info"
//                           onClick={() => loadSnapshot(h.id)}
//                         >
//                           <span className="history-name">
//                             {h.dataset_name?.trim() ||
//                               `Snapshot ${h.id.slice(0, 8)}`}
//                           </span>
//                           <span className="history-time">
//                             {formatTime(h.timestamp)}
//                           </span>
//                         </div>
//                         <span className={`badge ${h.drift_severity}`}>
//                           {h.drift_severity}
//                         </span>
//                         <div className="history-actions">
//                           <button
//                             className="btn-secondary"
//                             onClick={() =>
//                               window.open(
//                                 `${API}/report/${h.id}?format=csv`,
//                                 "_blank"
//                               )
//                             }
//                             title="Download CSV"
//                           >
//                             📊 CSV
//                           </button>
//                           <button
//                             className="delete-btn"
//                             onClick={() => deleteSnapshot(h.id)}
//                             title="Delete"
//                           >
//                             🗑️
//                           </button>
//                         </div>
//                       </li>
//                     ))
//                   )}
//                 </ul>
//               </div>
//             </div>

//             {multiCompareResult && (
//               <div className="card comparison-card">
//                 <div className="card-header">
//                   <h3>🔄 Multi-Snapshot Comparison</h3>
//                   <button
//                     className="close-btn"
//                     onClick={() => setMultiCompareResult(null)}
//                   >
//                     ✖
//                   </button>
//                 </div>
//                 <div className="card-content">
//                   <div className="multi-compare-summary">
//                     <div className="summary-stat">
//                       <span className="label">Total Snapshots</span>
//                       <span className="value">
//                         {multiCompareResult.summary.total_snapshots}
//                       </span>
//                     </div>
//                     <div className="summary-stat">
//                       <span className="label">Avg Drift Score</span>
//                       <span className="value">
//                         {(
//                           multiCompareResult.summary.avg_drift_score * 100
//                         ).toFixed(1)}
//                         %
//                       </span>
//                     </div>
//                     <div className="summary-stat">
//                       <span className="label">Trend</span>
//                       <span className="value">
//                         {multiCompareResult.summary.trend}
//                       </span>
//                     </div>
//                   </div>

//                   <div className="comparison-matrix">
//                     <h4>Pairwise Drift Scores</h4>
//                     {multiCompareResult.comparison_matrix.map((comp, idx) => (
//                       <div key={idx} className="matrix-row">
//                         <span className="snapshot-id">
//                           {comp.snapshot_a.slice(0, 8)}
//                         </span>
//                         <span className="vs">↔</span>
//                         <span className="snapshot-id">
//                           {comp.snapshot_b.slice(0, 8)}
//                         </span>
//                         <span className="drift-value">
//                           {(comp.drift_score * 100).toFixed(1)}%
//                         </span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             )}

//             {compareResult && (
//               <div className="card comparison-card professional">
//                 <div className="card-header">
//                   <div className="comparison-header-content">
//                     <div className="comparison-icon">🔄</div>
//                     <div className="comparison-header-text">
//                       <h3>Snapshot Comparison Analysis</h3>
//                       <p className="comparison-subtitle">
//                         Comprehensive drift analysis between two datasets
//                       </p>
//                     </div>
//                   </div>
//                   <button
//                     className="close-btn"
//                     onClick={() => {
//                       setCompareResult(null);
//                       setGenaiSummary(null);
//                       setGenaiExplanation(null);
//                       setGenaiRemediation(null);
//                     }}
//                   >
//                     ✖
//                   </button>
//                 </div>

//                 <div className="card-content">
//                   {/* Executive Overview Section */}
//                   <div className="comparison-overview">
//                     <div className="overview-grid">
//                       {compareResult.drift_score !== undefined && (
//                         <div className="overview-metric primary">
//                           <div className="metric-label">
//                             Overall Drift Score
//                           </div>
//                           <div className="metric-value-large">
//                             {(compareResult.drift_score * 100).toFixed(1)}%
//                           </div>
//                           <div className="metric-bar">
//                             <div
//                               className="metric-bar-fill"
//                               style={{
//                                 width: `${compareResult.drift_score * 100}%`,
//                                 backgroundColor:
//                                   compareResult.drift_score > 0.5
//                                     ? "#ef4444"
//                                     : compareResult.drift_score > 0.3
//                                     ? "#f59e0b"
//                                     : "#10b981",
//                               }}
//                             ></div>
//                           </div>
//                           <div
//                             className={`severity-indicator ${
//                               compareResult.severity || "low"
//                             }`}
//                           >
//                             {compareResult.severity?.toUpperCase() || "LOW"}{" "}
//                             SEVERITY
//                           </div>
//                         </div>
//                       )}

//                       {compareResult.semantic_score !== undefined && (
//                         <div className="overview-metric secondary">
//                           <div className="metric-label">Semantic Drift</div>
//                           <div className="metric-value">
//                             {(compareResult.semantic_score * 100).toFixed(1)}%
//                           </div>
//                           <div className="metric-description">
//                             Measures contextual meaning changes
//                           </div>
//                         </div>
//                       )}

//                       <div className="overview-metric secondary">
//                         <div className="metric-label">Drift Categories</div>
//                         <div className="metric-value">
//                           {[
//                             compareResult.statistical_drift?.length || 0,
//                             compareResult.schema_drift?.length || 0,
//                             compareResult.semantic_drift?.length || 0,
//                           ].reduce((a, b) => a + b, 0)}
//                         </div>
//                         <div className="metric-description">
//                           Changes detected across all types
//                         </div>
//                       </div>

//                       <div className="overview-metric secondary">
//                         <div className="metric-label">Significance Tests</div>
//                         <div className="metric-value">
//                           {
//                             Object.keys(
//                               compareResult.statistical_significance || {}
//                             ).length
//                           }
//                         </div>
//                         <div className="metric-description">
//                           Features analyzed statistically
//                         </div>
//                       </div>
//                     </div>
//                   </div>

//                   {/* AI Insights Section (Top Priority) */}
//                   {(compareResult.genai_summary ||
//                     compareResult.genai_explanation ||
//                     compareResult.genai_remediation) && (
//                     <div className="ai-insights-section">
//                       <div className="section-header">
//                         <div className="section-icon">🤖</div>
//                         <div>
//                           <h4>AI-Powered Insights</h4>
//                           <p className="section-description">
//                             Intelligent analysis and recommendations
//                           </p>
//                         </div>
//                       </div>

//                       {compareResult.genai_summary &&
//                         compareResult.genai_summary.trim() !== "" && (
//                           <div className="insight-card executive">
//                             <div className="insight-header">
//                               <span className="insight-badge">
//                                 Executive Summary
//                               </span>
//                             </div>
//                             <pre className="insight-content">
//                               {compareResult.genai_summary}
//                             </pre>
//                           </div>
//                         )}

//                       {compareResult.genai_explanation &&
//                         compareResult.genai_explanation.trim() !== "" && (
//                           <div className="insight-card explanation">
//                             <div className="insight-header">
//                               <span className="insight-badge">
//                                 Detailed Explanation
//                               </span>
//                             </div>
//                             <pre className="insight-content">
//                               {compareResult.genai_explanation}
//                             </pre>
//                           </div>
//                         )}

//                       {compareResult.genai_remediation &&
//                         compareResult.genai_remediation.trim() !== "" && (
//                           <div className="insight-card remediation">
//                             <div className="insight-header">
//                               <span className="insight-badge">
//                                 Recommended Actions
//                               </span>
//                             </div>
//                             <pre className="insight-content">
//                               {compareResult.genai_remediation}
//                             </pre>
//                           </div>
//                         )}
//                     </div>
//                   )}

//                   {/* Drift Details Section */}
//                   <div className="drift-details-section">
//                     <div className="section-header">
//                       <div className="section-icon">📊</div>
//                       <div>
//                         <h4>Drift Analysis Details</h4>
//                         <p className="section-description">
//                           Breakdown of detected changes by category
//                         </p>
//                       </div>
//                     </div>

//                     <div className="drift-categories">
//                       {compareResult.schema_drift?.length > 0 && (
//                         <div className="drift-category">
//                           <div className="category-header">
//                             <span className="category-icon">🗂️</span>
//                             <h5>Schema Changes</h5>
//                             <span className="category-count">
//                               {compareResult.schema_drift.length}
//                             </span>
//                           </div>
//                           <div className="drift-items">
//                             {compareResult.schema_drift.map((d, i) => (
//                               <div key={i} className="drift-item-pro schema">
//                                 <span className="drift-bullet">▸</span>
//                                 <span className="drift-text">{d}</span>
//                               </div>
//                             ))}
//                           </div>
//                         </div>
//                       )}

//                       {compareResult.statistical_drift?.length > 0 && (
//                         <div className="drift-category">
//                           <div className="category-header">
//                             <span className="category-icon">📈</span>
//                             <h5>Statistical Changes</h5>
//                             <span className="category-count">
//                               {compareResult.statistical_drift.length}
//                             </span>
//                           </div>
//                           <div className="drift-items">
//                             {compareResult.statistical_drift.map((d, i) => (
//                               <div
//                                 key={i}
//                                 className="drift-item-pro statistical"
//                               >
//                                 <span className="drift-bullet">▸</span>
//                                 <span className="drift-text">{d}</span>
//                               </div>
//                             ))}
//                           </div>
//                         </div>
//                       )}

//                       {compareResult.semantic_drift?.length > 0 && (
//                         <div className="drift-category">
//                           <div className="category-header">
//                             <span className="category-icon">💬</span>
//                             <h5>Semantic Drift</h5>
//                             <span className="category-count">
//                               {compareResult.semantic_drift.length}
//                             </span>
//                           </div>
//                           <div className="drift-items">
//                             {compareResult.semantic_drift.map((drift, i) => (
//                               <div key={i} className="drift-item-pro semantic">
//                                 <span className="drift-bullet">▸</span>
//                                 <span className="drift-text">
//                                   {typeof drift === "object"
//                                     ? JSON.stringify(drift)
//                                     : drift}
//                                 </span>
//                               </div>
//                             ))}
//                           </div>
//                         </div>
//                       )}
//                     </div>
//                   </div>

//                   {/* Statistical Significance Section */}
//                   {compareResult.statistical_significance &&
//                     Object.keys(compareResult.statistical_significance).length >
//                       0 && (
//                       <div className="significance-section">
//                         <div className="section-header">
//                           <div className="section-icon">🔬</div>
//                           <div>
//                             <h4>Statistical Significance Analysis</h4>
//                             <p className="section-description">
//                               P-value testing for feature-level changes
//                             </p>
//                           </div>
//                         </div>

//                         <div className="significance-grid">
//                           {Object.entries(
//                             compareResult.statistical_significance
//                           ).map(([feature, sig], idx) => (
//                             <div
//                               key={idx}
//                               className={`significance-card ${
//                                 sig.is_significant
//                                   ? "significant"
//                                   : "not-significant"
//                               }`}
//                             >
//                               <div className="significance-feature">
//                                 {feature}
//                               </div>
//                               <div className="significance-status">
//                                 {sig.is_significant ? (
//                                   <>
//                                     <span className="status-icon">✅</span>
//                                     <span className="status-text">
//                                       Significant
//                                     </span>
//                                   </>
//                                 ) : (
//                                   <>
//                                     <span className="status-icon">○</span>
//                                     <span className="status-text">
//                                       Not Significant
//                                     </span>
//                                   </>
//                                 )}
//                               </div>
//                               <div className="significance-stats">
//                                 <div className="stat-item">
//                                   <span className="stat-label">p-value</span>
//                                   <span className="stat-value">
//                                     {sig.p_value.toFixed(4)}
//                                   </span>
//                                 </div>
//                                 {sig.t_statistic && (
//                                   <div className="stat-item">
//                                     <span className="stat-label">t-stat</span>
//                                     <span className="stat-value">
//                                       {sig.t_statistic.toFixed(3)}
//                                     </span>
//                                   </div>
//                                 )}
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       </div>
//                     )}
//                 </div>
//               </div>
//             )}
//           </>
//         )}

//         {selected && (
//           <div className="card details-card">
//             <div className="card-header">
//               <h3>🔍 Snapshot Details</h3>
//               <button className="close-btn" onClick={() => setSelected(null)}>
//                 ✖
//               </button>
//             </div>
//             <div className="card-content">
//               <pre className="details-json">
//                 {JSON.stringify(selected, null, 2)}
//               </pre>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default App;

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import "./App.css";
import DriftChart from "./components/DriftChart";
import ProductionMonitor from "./components/ProductionMonitor";
const API = "http://127.0.0.1:8000";

// ============ HELPER FUNCTION FOR GENAI NORMALIZATION ============
const normalizeGenAI = (data) => {
  if (!data) return null;
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.join("\n");
  if (typeof data === "object") {
    return Object.entries(data)
      .map(([k, v]) => `• ${k}: ${v}`)
      .join("\n");
  }
  return String(data);
};

// ============ STATUS DOT COMPONENT ============
const StatusDot = ({ severity }) => (
  <span
    style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: "50%",
      background:
        severity === "high"
          ? "var(--red-500)"
          : severity === "medium"
            ? "var(--amber-500)"
            : "var(--green-500)",
      boxShadow:
        severity === "high"
          ? "0 0 6px rgba(239,68,68,0.6)"
          : severity === "medium"
            ? "0 0 6px rgba(245,158,11,0.6)"
            : "0 0 6px rgba(34,197,94,0.6)",
      flexShrink: 0,
    }}
  />
);

// ============ INLINE SPARKLINE ============
const Sparkline = ({ values = [], color = "#3b82f6" }) => {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 0.01);
  const min = Math.min(...values);
  const range = max - min || 0.01;
  const w = 80,
    h = 28,
    pad = 3;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
};

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

  // GenAI State
  const [genaiSummary, setGenaiSummary] = useState(null);
  const [genaiExplanation, setGenaiExplanation] = useState(null);
  const [genaiRemediation, setGenaiRemediation] = useState(null);

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
  const [generatingSummary, setGeneratingSummary] = useState(false);

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
        setWsConnected(true);
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "new_snapshot") {
          setLiveUpdates((prev) => [data.data, ...prev.slice(0, 9)]);
          showNotification(`New snapshot: ${data.data.dataset_name}`, "info");
          fetchHistory();
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWebSocket, 5000);
      };
      ws.onerror = () => {};
      wsRef.current = ws;
    };
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
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
      } catch (error) {}
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
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
        const newAlerts = data
          .filter(
            (h) => h.drift_severity === "high" || h.drift_severity === "medium",
          )
          .slice(0, 10)
          .map((h) => ({
            id: h.id,
            message: `${h.drift_severity.toUpperCase()} drift detected in ${h.dataset_name}`,
            severity: h.drift_severity,
            timestamp: h.timestamp,
            read: false,
            drift_score: h.drift_score,
          }));
        setAlerts(newAlerts);
      }
    } catch (error) {}
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
        `${API}/auth/signup?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (res.ok && data.msg) {
        showNotification("Signup successful! Please login.");
        setMode("login");
        setPassword("");
      } else showNotification(data.detail || "Signup failed", "error");
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
        `${API}/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (res.ok && data.access_token) {
        localStorage.setItem("token", data.access_token);
        setToken(data.access_token);
        showNotification("Login successful!");
      } else showNotification(data.detail || "Login failed", "error");
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
        },
      );
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setResult(data);
      setGenaiSummary(normalizeGenAI(data?.genai_summary));
      setGenaiExplanation(normalizeGenAI(data?.genai_explanation));
      setGenaiRemediation(normalizeGenAI(data?.genai_remediation));
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

  const generateSummary = async (snapshotId) => {
    setGeneratingSummary(true);
    try {
      const res = await fetch(`${API}/generate-summary/${snapshotId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to generate summary");
      const data = await res.json();
      setGenaiSummary(normalizeGenAI(data.summary));
      setGenaiExplanation(normalizeGenAI(data.explanation));
      setGenaiRemediation(normalizeGenAI(data.remediation));
      if (result && result.id === snapshotId) {
        setResult((prev) => ({
          ...prev,
          genai_summary: normalizeGenAI(data.summary),
          genai_explanation: normalizeGenAI(data.explanation),
          genai_remediation: normalizeGenAI(data.remediation),
        }));
      }
      showNotification("AI summary generated successfully!");
    } catch (error) {
      showNotification("Failed to generate summary", "error");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const uploadBatch = async () => {
    if (batchFiles.length === 0) {
      showNotification("Please select files for batch upload", "error");
      return;
    }
    setIsLoading(true);
    try {
      const form = new FormData();
      batchFiles.forEach((file) => form.append("files", file));
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
      setTimeout(fetchHistory, 2000);
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
        "error",
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
      setGenaiSummary(normalizeGenAI(data?.genai_summary));
      setGenaiExplanation(normalizeGenAI(data?.genai_explanation));
      setGenaiRemediation(normalizeGenAI(data?.genai_remediation));
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
      if (selected?.id === id) setSelected(null);
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
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setCompareResult({
        ...data,
        genai_summary: normalizeGenAI(data.genai_summary),
        genai_explanation: normalizeGenAI(data.genai_explanation),
        genai_remediation: normalizeGenAI(data.genai_remediation),
      });
      showNotification("Comparison completed successfully");
    } catch (error) {
      showNotification("Failed to compare snapshots", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCompare = (id) => {
    setCompareResult(null);
    if (compare.includes(id)) setCompare(compare.filter((x) => x !== id));
    else if (compare.length < 2) setCompare([...compare, id]);
    else setCompare([compare[1], id]);
  };

  const toggleMultiCompare = (id) => {
    if (multiCompareIds.includes(id))
      setMultiCompareIds(multiCompareIds.filter((x) => x !== id));
    else if (multiCompareIds.length < 10)
      setMultiCompareIds([...multiCompareIds, id]);
    else showNotification("Maximum 10 snapshots for comparison", "error");
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
    setGenaiSummary(null);
    setGenaiExplanation(null);
    setGenaiRemediation(null);
    showNotification("Logged out successfully");
  };

  const filteredHistory = history.filter((h) => {
    const matchesDataset =
      selectedDataset === "all" ||
      selectedDataset === "" ||
      h.dataset_name === selectedDataset;
    const matchesSeverity =
      filterSeverity === "all" || h.drift_severity === filterSeverity;
    return matchesDataset && matchesSeverity;
  });

  const datasets = useMemo(() => {
    const uniqueDatasets = [
      ...new Set(history.map((h) => h.dataset_name?.trim()).filter(Boolean)),
    ];
    return uniqueDatasets;
  }, [history]);

  useEffect(() => {
    if (datasets.length > 0 && !selectedDataset)
      setSelectedDataset(datasets[0]);
    else if (datasets.length === 0) setSelectedDataset("");
    else if (selectedDataset && !datasets.includes(selectedDataset))
      setSelectedDataset(datasets[0]);
  }, [datasets, selectedDataset]);

  // ============================================================
  // AUTH VIEW
  // ============================================================
  if (!token) {
    return (
      <div className="auth-container">
        <div className="animated-bg">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>

        <div className="auth-navbar">
          <div className="auth-navbar-left">
            <div className="navbar-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2"
                  strokeWidth="2"
                  strokeLinecap="round"
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
              Sign up
            </button>
          </div>
        </div>

        <div className="auth-card">
          <div className="logo-container">
            <div className="logo-icon">
              <div className="pulse-ring"></div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h1>Data Drift Monitor Pro</h1>
            <p className="subtitle">AI-powered ML monitoring platform</p>
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
              Sign up
            </button>
          </div>

          <div className="input-group">
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) =>
                e.key === "Enter" && (mode === "login" ? login() : signup())
              }
              className="styled-input"
            />
            <input
              type="password"
              placeholder="••••••••"
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
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN APP
  // ============================================================
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

      {/* TOP BAR */}
      <div className="top-bar">
        <div className="logo-section">
          <div className="logo-icon-small">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1>Drift Monitor Pro</h1>
          {wsConnected && <span className="ws-status">● Live</span>}
          {healthStatus && (
            <span
              className="health-status"
              title={`Redis: ${healthStatus.redis_status}, Jobs: ${healthStatus.scheduled_jobs}`}
            >
              ❤ {healthStatus.status}
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

      {/* VIEW TABS */}
      <div className="view-tabs">
        {[
          { id: "dashboard", label: "Dashboard", icon: "⬡" },
          { id: "upload", label: "Upload", icon: "↑" },
          { id: "batch", label: "Batch", icon: "⊞" },
          { id: "predictions", label: "Predictions", icon: "◈" },
          { id: "alerts", label: "Alerts", icon: "⚡" },
          { id: "insights", label: "Insights", icon: "◉" },
          { id: "automation", label: "Automation", icon: "⊙" },
          { id: "history", label: "History", icon: "≡" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={view === tab.id ? "active" : ""}
            onClick={() => setView(tab.id)}
          >
            <span style={{ marginRight: "0.4rem", opacity: 0.7 }}>
              {tab.icon}
            </span>
            {tab.label}
            {tab.id === "alerts" &&
              alerts.filter((a) => !a.read).length > 0 && (
                <span
                  style={{
                    marginLeft: "0.375rem",
                    background: "var(--red-500)",
                    color: "#fff",
                    borderRadius: "10px",
                    padding: "0.1rem 0.4rem",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                  }}
                >
                  {alerts.filter((a) => !a.read).length}
                </span>
              )}
          </button>
        ))}
      </div>

      <div className="container">
        {/* ====================================================
            DASHBOARD VIEW
        ==================================================== */}
        {view === "dashboard" && (
          <>
            <div className="stats-grid">
              {[
                {
                  icon: "⬡",
                  value: history.length,
                  label: "Total Snapshots",
                  color: "blue",
                },
                {
                  icon: "⚡",
                  value: history.filter((h) => h.drift_severity === "high")
                    .length,
                  label: "High Severity",
                  color: "red",
                },
                {
                  icon: "✓",
                  value: history.filter((h) => h.drift_severity === "low")
                    .length,
                  label: "Stable",
                  color: "green",
                },
                {
                  icon: "⊞",
                  value: datasets.length,
                  label: "Datasets",
                  color: "purple",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className={`stat-card ${stat.color}`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="stat-icon">{stat.icon}</div>
                  <div className="stat-info">
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {liveUpdates.length > 0 && (
              <div className="card live-updates-card">
                <div className="card-header">
                  <h3>
                    <span
                      style={{
                        color: "var(--green-400)",
                        marginRight: "0.375rem",
                      }}
                    >
                      ●
                    </span>
                    Live Updates
                  </h3>
                  <span className="trend-badge">
                    {liveUpdates.length} recent
                  </span>
                </div>
                <div className="card-content">
                  {liveUpdates.map((update, idx) => (
                    <div
                      key={idx}
                      className="live-update-item"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
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
                  <h3>Drift Score Trend</h3>
                  <span className="trend-badge">
                    {history.length} snapshots
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
                    <option value="all">All severities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button className="refresh-btn" onClick={fetchHistory}>
                    ↺ Refresh
                  </button>
                </div>
              </div>
              <div className="card-content">
                {filteredHistory.slice(0, 5).length === 0 ? (
                  <div className="empty-state">
                    <p>No snapshots yet. Upload a dataset to begin.</p>
                  </div>
                ) : (
                  filteredHistory.slice(0, 5).map((h) => (
                    <div
                      key={h.id}
                      className="snapshot-item"
                      onClick={() => {
                        loadSnapshot(h.id);
                        loadFeatureImportance(h.id);
                        loadRemediation(h.id);
                        loadDataQuality(h.id);
                      }}
                    >
                      <div className="snapshot-info">
                        <StatusDot severity={h.drift_severity} />
                        <div>
                          <div className="snapshot-name">{h.dataset_name}</div>
                          <div className="snapshot-time">
                            {formatTime(h.timestamp)}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.875rem",
                        }}
                      >
                        <Sparkline
                          values={[0.1, 0.2, 0.15, h.drift_score || 0.1]}
                          color={
                            h.drift_severity === "high"
                              ? "var(--red-400)"
                              : h.drift_severity === "medium"
                                ? "var(--amber-400)"
                                : "var(--green-400)"
                          }
                        />
                        <span className={`badge ${h.drift_severity}`}>
                          {((h.drift_score || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* ====================================================
            UPLOAD VIEW
        ==================================================== */}
        {view === "upload" && (
          <>
            <div className="card upload-card">
              <div className="card-header">
                <h3>↑ Upload Dataset</h3>
                <span className="info-badge">CSV files only</span>
              </div>
              <div className="card-content">
                <div className="input-wrapper">
                  <label>Dataset Name</label>
                  <input
                    placeholder="e.g., customer_data_q4"
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
                    {file ? `✓ ${file.name}` : "Click to select CSV file"}
                  </label>
                  <button
                    className={`analyze-btn ${isLoading ? "loading" : ""}`}
                    onClick={upload}
                    disabled={isLoading}
                  >
                    {isLoading ? "Analyzing…" : "Analyze →"}
                  </button>
                </div>
              </div>
            </div>

            {result && (
              <div className="card result-card">
                <div className="card-header">
                  <h3>Analysis Result</h3>
                  {result.id && (
                    <button
                      className={`secondary-btn ${generatingSummary ? "loading" : ""}`}
                      onClick={() => generateSummary(result.id)}
                      disabled={generatingSummary}
                    >
                      {generatingSummary
                        ? "Generating…"
                        : "◈ Generate AI Summary"}
                    </button>
                  )}
                </div>
                <div className="card-content">
                  <div className="result-stats">
                    <div className="stat-item">
                      <span className="stat-label">Drift Score</span>
                      <span className="stat-value">
                        {(result.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Severity</span>
                      <span
                        className={`badge ${result.severity}`}
                        style={{ fontSize: "0.875rem" }}
                      >
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
                      <h4>Data Quality Score</h4>
                      <div className="quality-score-big">
                        {(result.quality_metrics.overall_score * 100).toFixed(
                          0,
                        )}
                        %
                      </div>
                      <div className="quality-breakdown">
                        <div>
                          Completeness:{" "}
                          {(result.quality_metrics.completeness * 100).toFixed(
                            0,
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

                  {genaiSummary && genaiSummary.trim() !== "" && (
                    <div className="genai-summary">
                      <h4>Executive Summary</h4>
                      <pre className="genai-text">{genaiSummary}</pre>
                    </div>
                  )}

                  <div className="drift-list">
                    {result.drift.length === 0 ? (
                      <div className="no-drift">
                        ✓ No drift detected — dataset is stable
                      </div>
                    ) : (
                      result.drift.map((d, i) => (
                        <div key={i} className="drift-item">
                          ⚠
                          {typeof d === "object" ? (
                            <>
                              {d.type === "column_renamed_or_missing" && (
                                <>
                                  Column <strong>{d.old_column}</strong>{" "}
                                  renamed/missing →{" "}
                                  <strong>{d.best_match || "none"}</strong> (
                                  {((d.similarity || 0) * 100).toFixed(0)}%)
                                </>
                              )}
                              {d.type === "type_changed" && (
                                <>
                                  Type change in <strong>{d.column}</strong>:{" "}
                                  {d.old_type} → {d.new_type}
                                </>
                              )}
                              {d.type === "categorical_shift" && (
                                <>
                                  Categorical shift in{" "}
                                  <strong>{d.column}</strong> (Jaccard{" "}
                                  {((d.jaccard_similarity || 0) * 100).toFixed(
                                    0,
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

                  {genaiExplanation && genaiExplanation.trim() !== "" && (
                    <div className="genai-explanation">
                      <h4>AI Explanation</h4>
                      <pre className="genai-text">{genaiExplanation}</pre>
                    </div>
                  )}

                  {genaiRemediation && genaiRemediation.trim() !== "" && (
                    <div className="genai-remediation">
                      <h4>AI Remediation Suggestions</h4>
                      <pre className="genai-text">{genaiRemediation}</pre>
                    </div>
                  )}

                  {result.predicted_impact && (
                    <div className="predicted-impact">
                      <strong>Predicted Impact</strong>
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
                        <h4>⚠ Anomaly Detection</h4>
                        {Object.entries(result.anomaly_report)
                          .slice(0, 5)
                          .map(([feature, anomaly], idx) => (
                            <div key={idx} className="anomaly-item">
                              <strong>{feature}:</strong>{" "}
                              {anomaly.has_anomalies
                                ? "⚠ Anomalies detected"
                                : "✓ Normal"}
                            </div>
                          ))}
                      </div>
                    )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ====================================================
            BATCH VIEW
        ==================================================== */}
        {view === "batch" && (
          <div className="card">
            <div className="card-header">
              <h3>⊞ Batch Upload</h3>
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
                  {batchFiles.length > 0
                    ? `${batchFiles.length} files selected`
                    : "Select multiple CSV files"}
                </label>

                {batchFiles.length > 0 && (
                  <div className="batch-file-list">
                    {batchFiles.map((f, idx) => (
                      <div key={idx} className="batch-file-item">
                        <span>⊡ {f.name}</span>
                        <button
                          className="remove-file-btn"
                          onClick={() =>
                            setBatchFiles(
                              batchFiles.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          ✕
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
                  {isLoading ? "Processing…" : "Analyze Batch →"}
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

        {/* ====================================================
            PREDICTIONS VIEW
        ==================================================== */}
        {view === "predictions" && (
          <div className="card">
            <div className="card-header">
              <h3>◈ Drift Predictions</h3>
              <button
                className="primary-btn"
                style={{ width: "auto", padding: "0.5rem 1.25rem" }}
                onClick={predictDrift}
                disabled={isLoading || !selectedDataset}
              >
                {isLoading ? "Predicting…" : "Generate forecast →"}
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
                      <span
                        className="value"
                        style={{
                          fontSize: "1rem",
                          color: "var(--text-primary)",
                        }}
                      >
                        {predictions.suggested_monitoring_frequency}
                      </span>
                    </div>
                  </div>

                  <div className="prediction-chart">
                    <h4>7-Day Drift Forecast</h4>
                    {predictions.next_7_days.map((day, idx) => (
                      <div key={idx} className="prediction-day">
                        <span>Day {day.day}</span>
                        <div className="prediction-bar">
                          <div
                            className="prediction-fill"
                            style={{ width: `${day.predicted_score * 100}%` }}
                          ></div>
                        </div>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.8rem",
                            color: "var(--blue-400)",
                            fontWeight: 700,
                          }}
                        >
                          {(day.predicted_score * 100).toFixed(1)}%
                        </span>
                        <span className="confidence">
                          ({(day.confidence * 100).toFixed(0)}% confidence)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!predictions && (
                <div className="empty-state">
                  <p>
                    Select a dataset and generate a prediction to see the 7-day
                    drift forecast.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================
            AUTOMATION VIEW
        ==================================================== */}
        {view === "automation" && (
          <>
            <div className="card">
              <div className="card-header">
                <h3>⏱ Schedule Monitoring</h3>
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
                  style={{ width: "auto", padding: "0.6rem 1.5rem" }}
                  onClick={scheduleMonitoring}
                  disabled={isLoading || !scheduleConfig.dataset_path}
                >
                  {isLoading ? "Scheduling…" : "Schedule Monitoring →"}
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>⊙ Auto-Retrain Configuration</h3>
              </div>
              <div className="card-content">
                <div className="config-section">
                  <label>
                    Drift Threshold —{" "}
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
                <div style={{ marginTop: "1.5rem" }}>
                  <button
                    className="primary-btn"
                    style={{ width: "auto", padding: "0.6rem 1.5rem" }}
                    onClick={saveAutoRetrainConfig}
                    disabled={isLoading}
                  >
                    {isLoading ? "Saving…" : "Save Configuration →"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ====================================================
            ALERTS VIEW
        ==================================================== */}
        {view === "alerts" && (
          <>
            <div className="card">
              <div className="card-header">
                <h3>⚡ Alert Center</h3>
                <button
                  className="secondary-btn"
                  onClick={() =>
                    setAlerts(alerts.map((a) => ({ ...a, read: true })))
                  }
                >
                  Mark all read
                </button>
              </div>
              <div className="card-content">
                {alerts.length === 0 ? (
                  <div className="empty-state">
                    <p>✓ No alerts. Everything is stable.</p>
                  </div>
                ) : (
                  <div className="alerts-list">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`alert-item ${alert.read ? "read" : "unread"}`}
                      >
                        <div className="alert-icon">
                          <StatusDot severity={alert.severity} />
                        </div>
                        <div className="alert-content">
                          <div className="alert-message">{alert.message}</div>
                          <div className="alert-time">
                            {formatTime(alert.timestamp)} ·{" "}
                            {((alert.drift_score || 0) * 100).toFixed(1)}% drift
                          </div>
                        </div>
                        <button
                          className="delete-icon-btn"
                          onClick={() =>
                            setAlerts(alerts.filter((a) => a.id !== alert.id))
                          }
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>⚙ Alert Configuration</h3>
              </div>
              <div className="card-content">
                <div className="config-section">
                  <label>
                    Drift Threshold — {(alertConfig.threshold * 100).toFixed(0)}
                    %
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
                    {[
                      { key: "email", label: "Email Notifications" },
                      { key: "slack", label: "Slack Integration" },
                      { key: "webhook", label: "Webhook" },
                      { key: "sms", label: "SMS Alerts" },
                    ].map(({ key, label }) => (
                      <label key={key} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={alertConfig.channels[key]}
                          onChange={(e) =>
                            setAlertConfig({
                              ...alertConfig,
                              channels: {
                                ...alertConfig.channels,
                                [key]: e.target.checked,
                              },
                            })
                          }
                        />
                        {label}
                      </label>
                    ))}
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
                  style={{ width: "auto", padding: "0.6rem 1.5rem" }}
                  onClick={saveAlertConfig}
                  disabled={isLoading}
                >
                  {isLoading ? "Saving…" : "Save Settings →"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ====================================================
            INSIGHTS VIEW
        ==================================================== */}
        {view === "insights" && (
          <>
            {featureImportance && (
              <div className="card">
                <div className="card-header">
                  <h3>◉ Feature Importance Analysis</h3>
                  <span className="trend-badge">
                    {featureImportance.features?.length || 0} features
                  </span>
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
                        ),
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
                  <h3>◈ Data Quality Metrics</h3>
                </div>
                <div className="card-content">
                  <div className="quality-grid">
                    {[
                      {
                        label: "Overall Score",
                        value: dataQuality.quality_metrics.overall_score,
                      },
                      {
                        label: "Completeness",
                        value: dataQuality.quality_metrics.completeness,
                      },
                      {
                        label: "Validity",
                        value: dataQuality.quality_metrics.validity,
                      },
                      {
                        label: "Consistency",
                        value: dataQuality.quality_metrics.consistency,
                      },
                    ].map((m, i) => (
                      <div key={i} className="quality-metric">
                        <div className="quality-label">{m.label}</div>
                        <div className="quality-value-large">
                          {(m.value * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                  {dataQuality.recommendations?.length > 0 && (
                    <div className="recommendations-section">
                      <h4>Recommendations</h4>
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
                  <h3>⊕ Remediation Suggestions</h3>
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
                    <strong>Estimated Impact</strong>
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
                    <p style={{ fontSize: "2rem", marginBottom: "0.875rem" }}>
                      ◉
                    </p>
                    <p>
                      Click on any snapshot in the Dashboard to load detailed
                      insights.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ====================================================
            HISTORY VIEW
        ==================================================== */}
        {view === "history" && (
          <>
            <div className="card history-card">
              <div className="card-header">
                <div className="header-with-badge">
                  <h3>≡ Snapshot History</h3>
                  {history.length > 0 && (
                    <span className="count-badge">{history.length}</span>
                  )}
                </div>
                <div className="header-actions">
                  <button className="refresh-btn" onClick={fetchHistory}>
                    ↺ Refresh
                  </button>
                  {compare.length === 2 && (
                    <button
                      className={`compare-btn ${isLoading ? "loading" : ""}`}
                      onClick={compareSnapshots}
                      disabled={isLoading}
                    >
                      {isLoading ? "Comparing…" : "Compare 2 selected →"}
                    </button>
                  )}
                  {multiCompareIds.length >= 2 && (
                    <button
                      className={`compare-btn ${isLoading ? "loading" : ""}`}
                      onClick={compareMultipleSnapshots}
                      disabled={isLoading}
                    >
                      {isLoading
                        ? "Comparing…"
                        : `Multi-compare (${multiCompareIds.length}) →`}
                    </button>
                  )}
                </div>
              </div>
              <div className="card-content">
                {(compare.length > 0 || multiCompareIds.length > 0) && (
                  <div className="selection-indicator">
                    <span>
                      {compare.length} standard / {multiCompareIds.length}{" "}
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
                      ✕ Clear
                    </button>
                  </div>
                )}

                <ul className="history-list">
                  {history.length === 0 ? (
                    <li className="empty-state">
                      <p>No snapshots yet. Upload a dataset to get started.</p>
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
                                "_blank",
                              )
                            }
                            title="Download CSV"
                          >
                            ⬇ CSV
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => deleteSnapshot(h.id)}
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>

            {multiCompareResult && (
              <div className="card comparison-card">
                <div className="card-header">
                  <h3>⇄ Multi-Snapshot Comparison</h3>
                  <button
                    className="close-btn"
                    onClick={() => setMultiCompareResult(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="card-content">
                  <div className="multi-compare-summary">
                    <div className="summary-stat">
                      <span className="label">Snapshots</span>
                      <span className="value">
                        {multiCompareResult.summary.total_snapshots}
                      </span>
                    </div>
                    <div className="summary-stat">
                      <span className="label">Avg Drift</span>
                      <span className="value">
                        {(
                          multiCompareResult.summary.avg_drift_score * 100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                    <div className="summary-stat">
                      <span className="label">Trend</span>
                      <span
                        className="value"
                        style={{
                          fontSize: "1rem",
                          color: "var(--text-secondary)",
                        }}
                      >
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

            {compareResult && (
              <div className="card comparison-card professional">
                <div className="card-header">
                  <div className="comparison-header-content">
                    <div className="comparison-icon">⇄</div>
                    <div className="comparison-header-text">
                      <h3>Snapshot Comparison Analysis</h3>
                      <p className="comparison-subtitle">
                        Comprehensive drift analysis between two datasets
                      </p>
                    </div>
                  </div>
                  <button
                    className="close-btn"
                    onClick={() => {
                      setCompareResult(null);
                      setGenaiSummary(null);
                      setGenaiExplanation(null);
                      setGenaiRemediation(null);
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div className="card-content">
                  <div className="comparison-overview">
                    <div className="overview-grid">
                      {compareResult.drift_score !== undefined && (
                        <div className="overview-metric primary">
                          <div className="metric-label">
                            Overall Drift Score
                          </div>
                          <div className="metric-value-large">
                            {(compareResult.drift_score * 100).toFixed(1)}%
                          </div>
                          <div className="metric-bar">
                            <div
                              className="metric-bar-fill"
                              style={{
                                width: `${compareResult.drift_score * 100}%`,
                                background:
                                  compareResult.drift_score > 0.5
                                    ? "var(--red-500)"
                                    : compareResult.drift_score > 0.3
                                      ? "var(--amber-500)"
                                      : "var(--green-500)",
                              }}
                            ></div>
                          </div>
                          <div
                            className={`severity-indicator ${compareResult.severity || "low"}`}
                          >
                            {compareResult.severity?.toUpperCase() || "LOW"}{" "}
                            SEVERITY
                          </div>
                        </div>
                      )}
                      {compareResult.semantic_score !== undefined && (
                        <div className="overview-metric secondary">
                          <div className="metric-label">Semantic Drift</div>
                          <div className="metric-value">
                            {(compareResult.semantic_score * 100).toFixed(1)}%
                          </div>
                          <div className="metric-description">
                            Contextual meaning changes
                          </div>
                        </div>
                      )}
                      <div className="overview-metric secondary">
                        <div className="metric-label">Drift Categories</div>
                        <div className="metric-value">
                          {[
                            compareResult.statistical_drift?.length || 0,
                            compareResult.schema_drift?.length || 0,
                            compareResult.semantic_drift?.length || 0,
                          ].reduce((a, b) => a + b, 0)}
                        </div>
                        <div className="metric-description">
                          Changes detected across all types
                        </div>
                      </div>
                      <div className="overview-metric secondary">
                        <div className="metric-label">Significance Tests</div>
                        <div className="metric-value">
                          {
                            Object.keys(
                              compareResult.statistical_significance || {},
                            ).length
                          }
                        </div>
                        <div className="metric-description">
                          Features analyzed statistically
                        </div>
                      </div>
                    </div>
                  </div>

                  {(compareResult.genai_summary ||
                    compareResult.genai_explanation ||
                    compareResult.genai_remediation) && (
                    <div className="ai-insights-section">
                      <div className="section-header">
                        <div className="section-icon">◈</div>
                        <div>
                          <h4>AI-Powered Insights</h4>
                          <p className="section-description">
                            Intelligent analysis and recommendations
                          </p>
                        </div>
                      </div>

                      {compareResult.genai_summary?.trim() && (
                        <div className="insight-card executive">
                          <div className="insight-header">
                            <span className="insight-badge">
                              Executive Summary
                            </span>
                          </div>
                          <pre className="insight-content">
                            {compareResult.genai_summary}
                          </pre>
                        </div>
                      )}
                      {compareResult.genai_explanation?.trim() && (
                        <div className="insight-card explanation">
                          <div className="insight-header">
                            <span className="insight-badge">
                              Detailed Explanation
                            </span>
                          </div>
                          <pre className="insight-content">
                            {compareResult.genai_explanation}
                          </pre>
                        </div>
                      )}
                      {compareResult.genai_remediation?.trim() && (
                        <div className="insight-card remediation">
                          <div className="insight-header">
                            <span className="insight-badge">
                              Recommended Actions
                            </span>
                          </div>
                          <pre className="insight-content">
                            {compareResult.genai_remediation}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="drift-details-section">
                    <div className="section-header">
                      <div className="section-icon">≡</div>
                      <div>
                        <h4>Drift Analysis Details</h4>
                        <p className="section-description">
                          Breakdown of detected changes by category
                        </p>
                      </div>
                    </div>

                    <div className="drift-categories">
                      {compareResult.schema_drift?.length > 0 && (
                        <div className="drift-category">
                          <div className="category-header">
                            <span className="category-icon">⊞</span>
                            <h5>Schema Changes</h5>
                            <span className="category-count">
                              {compareResult.schema_drift.length}
                            </span>
                          </div>
                          <div className="drift-items">
                            {compareResult.schema_drift.map((d, i) => (
                              <div key={i} className="drift-item-pro schema">
                                <span className="drift-bullet">▸</span>
                                <span className="drift-text">{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {compareResult.statistical_drift?.length > 0 && (
                        <div className="drift-category">
                          <div className="category-header">
                            <span className="category-icon">↗</span>
                            <h5>Statistical Changes</h5>
                            <span className="category-count">
                              {compareResult.statistical_drift.length}
                            </span>
                          </div>
                          <div className="drift-items">
                            {compareResult.statistical_drift.map((d, i) => (
                              <div
                                key={i}
                                className="drift-item-pro statistical"
                              >
                                <span className="drift-bullet">▸</span>
                                <span className="drift-text">{d}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {compareResult.semantic_drift?.length > 0 && (
                        <div className="drift-category">
                          <div className="category-header">
                            <span className="category-icon">◈</span>
                            <h5>Semantic Drift</h5>
                            <span className="category-count">
                              {compareResult.semantic_drift.length}
                            </span>
                          </div>
                          <div className="drift-items">
                            {compareResult.semantic_drift.map((drift, i) => (
                              <div key={i} className="drift-item-pro semantic">
                                <span className="drift-bullet">▸</span>
                                <span className="drift-text">
                                  {typeof drift === "object"
                                    ? JSON.stringify(drift)
                                    : drift}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {compareResult.statistical_significance &&
                    Object.keys(compareResult.statistical_significance).length >
                      0 && (
                      <div className="significance-section">
                        <div className="section-header">
                          <div className="section-icon">⊙</div>
                          <div>
                            <h4>Statistical Significance Analysis</h4>
                            <p className="section-description">
                              P-value testing for feature-level changes
                            </p>
                          </div>
                        </div>
                        <div className="significance-grid">
                          {Object.entries(
                            compareResult.statistical_significance,
                          ).map(([feature, sig], idx) => (
                            <div
                              key={idx}
                              className={`significance-card ${sig.is_significant ? "significant" : "not-significant"}`}
                            >
                              <div className="significance-feature">
                                {feature}
                              </div>
                              <div className="significance-status">
                                <span className="status-icon">
                                  {sig.is_significant ? "✓" : "○"}
                                </span>
                                <span className="status-text">
                                  {sig.is_significant
                                    ? "Significant"
                                    : "Not Significant"}
                                </span>
                              </div>
                              <div className="significance-stats">
                                <div className="stat-item">
                                  <span className="stat-label">p-value</span>
                                  <span className="stat-value">
                                    {sig.p_value.toFixed(4)}
                                  </span>
                                </div>
                                {sig.t_statistic && (
                                  <div className="stat-item">
                                    <span className="stat-label">t-stat</span>
                                    <span className="stat-value">
                                      {sig.t_statistic.toFixed(3)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ====================================================
            SNAPSHOT DETAIL PANEL
        ==================================================== */}
        {selected && (
          <div
            className="card details-card"
            style={{ borderColor: "rgba(59,130,246,0.25)" }}
          >
            <div className="card-header">
              <h3>◉ Snapshot Details</h3>
              <button className="close-btn" onClick={() => setSelected(null)}>
                ✕
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