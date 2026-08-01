/**
 * ProductionMonitor.jsx
 * ─────────────────────────────────────────────────────────────
 * Production pipeline monitoring view.
 * Covers every capability of the backend production_ingestion.py:
 *   • Pipeline health overview (per dataset, last run status)
 *   • Scheduler job list with next-run countdown
 *   • Register new dataset with source connector config
 *   • Live ingestion run history with drift timeline
 *   • Drift persistence state (consecutive counter visualisation)
 *   • Alert rule management (thresholds, cooldown, channels)
 *   • Comparison mode switcher (last / baseline / rolling)
 *   • Trigger immediate run
 *   • Config editor (hot-reload, no restart)
 *   • Retention policy display
 *
 * No component names changed from the parent App.jsx pattern.
 * Uses the same CSS variables defined in App.css.
 */

import { useState, useEffect, useCallback, useRef } from "react";

const API = "http://127.0.0.1:8000";

// ─── tiny helpers ──────────────────────────────────────────────────────────

const fmt = (ts) =>
  ts
    ? new Date(ts).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const fmtDuration = (secs) => {
  if (secs == null) return "—";
  if (secs < 60) return `${secs.toFixed(1)}s`;
  return `${(secs / 60).toFixed(1)}m`;
};

const severityColor = (s) => {
  if (s === "critical") return "var(--red-400)";
  if (s === "warning") return "var(--amber-400)";
  if (s === "info") return "var(--cyan-400)";
  return "var(--green-400)";
};

const statusColor = (s) => {
  if (s === "success") return "var(--green-400)";
  if (s === "failed") return "var(--red-400)";
  if (s === "skipped") return "var(--amber-400)";
  if (s === "no_data") return "var(--text-tertiary)";
  return "var(--text-secondary)";
};

// ─── countdown hook ────────────────────────────────────────────────────────

function useCountdown(targetIso) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!targetIso) return;
    const tick = () => {
      const diff = Math.max(
        0,
        Math.round((new Date(targetIso) - Date.now()) / 1000),
      );
      setSecs(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── sub-components ────────────────────────────────────────────────────────

/** Pulsing dot indicator */
const LiveDot = ({ active = true, color = "var(--green-400)" }) => (
  <span
    style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: active ? color : "var(--text-disabled)",
      boxShadow: active ? `0 0 6px ${color}` : "none",
      animation: active ? "prodDotPulse 2s ease-in-out infinite" : "none",
      flexShrink: 0,
    }}
  />
);

/** Horizontal progress bar for drift score */
const DriftBar = ({ score = 0, warn = 0.25, crit = 0.45 }) => {
  const pct = Math.min(score * 100, 100);
  const color =
    score >= crit
      ? "var(--red-400)"
      : score >= warn
        ? "var(--amber-400)"
        : "var(--green-400)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
      <div
        style={{
          flex: 1,
          height: 5,
          background: "var(--bg-deep)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.6s var(--ease-out)",
            boxShadow: `0 0 6px ${color}40`,
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          color,
          fontWeight: 700,
          minWidth: 40,
          textAlign: "right",
        }}
      >
        {(score * 100).toFixed(1)}%
      </span>
    </div>
  );
};

/** Persistence cycle visualiser — N dots, filled = confirmed drift */
const PersistenceDots = ({ count = 0, total = 2, severity }) => {
  const color = severityColor(severity || "none");
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: i < count ? color : "var(--bg-overlay)",
            border: `1.5px solid ${i < count ? color : "var(--border-default)"}`,
            transition: "background 0.3s",
            boxShadow: i < count ? `0 0 5px ${color}60` : "none",
          }}
        />
      ))}
      <span
        style={{
          fontSize: "0.72rem",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)",
          marginLeft: 4,
        }}
      >
        {count}/{total}
      </span>
    </div>
  );
};

/** Single scheduler job row with live countdown */
const JobRow = ({ job, onTrigger, triggering }) => {
  const countdown = useCountdown(job.next_run);
  const datasetName = job.name.replace("Ingest ", "");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        alignItems: "center",
        gap: "1rem",
        padding: "0.875rem 1rem",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        marginBottom: "0.5rem",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <LiveDot active={!!job.next_run} />
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "var(--text-primary)",
            }}
          >
            {datasetName}
          </div>
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {job.id}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: "0.7rem",
            color: "var(--text-tertiary)",
            marginBottom: 2,
          }}
        >
          next run
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            color: "var(--cyan-400)",
            fontWeight: 700,
          }}
        >
          {countdown}
        </div>
      </div>

      <div
        style={{
          fontSize: "0.72rem",
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {job.next_run ? fmt(job.next_run) : "—"}
      </div>

      <button
        onClick={() => onTrigger(datasetName)}
        disabled={triggering === datasetName}
        style={{
          padding: "0.4rem 0.875rem",
          background:
            triggering === datasetName
              ? "rgba(59,130,246,0.08)"
              : "rgba(59,130,246,0.1)",
          border: "1px solid rgba(59,130,246,0.25)",
          borderRadius: "var(--radius-sm)",
          color: "var(--blue-400)",
          cursor: triggering === datasetName ? "not-allowed" : "pointer",
          fontSize: "0.75rem",
          fontWeight: 600,
          fontFamily: "var(--font-sans)",
          transition: "all 0.15s",
          opacity: triggering === datasetName ? 0.5 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {triggering === datasetName ? "Running…" : "▶ Run now"}
      </button>
    </div>
  );
};

/** One ingestion run row */
const RunRow = ({ run }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div
        onClick={() => setExpanded((p) => !p)}
        style={{
          display: "grid",
          gridTemplateColumns: "20px 140px 80px 100px 80px 80px 50px",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.625rem 1rem",
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-subtle)",
          marginBottom: "0.375rem",
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
      >
        <span style={{ fontSize: "0.7rem", color: statusColor(run.status) }}>
          {run.status === "success" ? "✓" : run.status === "failed" ? "✕" : "○"}
        </span>
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {run.dataset}
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            fontFamily: "var(--font-mono)",
            color: statusColor(run.status),
            fontWeight: 600,
          }}
        >
          {run.status}
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
          }}
        >
          {fmt(run.started_at)}
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            fontFamily: "var(--font-mono)",
            color: severityColor(run.severity || "none"),
            fontWeight: 700,
          }}
        >
          {run.drift_score != null
            ? `${(run.drift_score * 100).toFixed(1)}%`
            : "—"}
        </span>
        <span
          style={{
            fontSize: "0.72rem",
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {fmtDuration(run.duration_s)}
        </span>
        <span
          style={{
            fontSize: "0.7rem",
            color: run.alert_sent ? "var(--red-400)" : "var(--text-disabled)",
          }}
        >
          {run.alert_sent ? "🔔" : "—"}
        </span>
      </div>

      {expanded && run.error && (
        <div
          style={{
            margin: "-0.25rem 0 0.5rem 0",
            padding: "0.625rem 1rem",
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.15)",
            borderRadius: "0 0 var(--radius-sm) var(--radius-sm)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            color: "var(--red-400)",
          }}
        >
          Error: {run.error}
        </div>
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function ProductionMonitor({ token, showNotification }) {
  // ── data state ──────────────────────────────────────────────────────────
  const [health, setHealth] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [runs, setRuns] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(null);

  // ── UI panels ───────────────────────────────────────────────────────────
  const [activePanel, setActivePanel] = useState("overview");
  // overview | register | runs | config | rules

  // ── register form ───────────────────────────────────────────────────────
  const [registerForm, setRegisterForm] = useState({
    dataset_name: "",
    source_type: "local",
    interval_minutes: 10,
    source_config: {
      folder_path: "",
      dsn: "",
      query: "",
      bucket: "",
      prefix: "",
      url: "",
    },
  });

  // ── config editor ───────────────────────────────────────────────────────
  const [editConfig, setEditConfig] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);

  // ── auto-refresh ─────────────────────────────────────────────────────────
  const refreshRef = useRef(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  // ── fetchers ────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [healthRes, jobsRes, runsRes, configRes] = await Promise.all([
        fetch(`${API}/production/pipeline-health`, { headers: authHeaders }),
        fetch(`${API}/production/jobs`, { headers: authHeaders }),
        fetch(`${API}/production/ingestion-runs?limit=60`, {
          headers: authHeaders,
        }),
        fetch(`${API}/production/config`, { headers: authHeaders }),
      ]);

      if (healthRes.ok) setHealth(await healthRes.json());
      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (runsRes.ok) setRuns(await runsRes.json());
      if (configRes.ok) {
        const c = await configRes.json();
        setConfig(c);
        setEditConfig(c);
      }
    } catch (e) {
      console.error("ProductionMonitor fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAll();
    refreshRef.current = setInterval(fetchAll, 15_000);
    return () => clearInterval(refreshRef.current);
  }, [fetchAll]);

  // ── actions ─────────────────────────────────────────────────────────────

  const handleTrigger = async (datasetName) => {
    setTriggering(datasetName);
    try {
      const res = await fetch(`${API}/production/trigger/${datasetName}`, {
        method: "POST",
        headers: authHeaders,
      });
      const data = await res.json();
      showNotification(
        `Run complete: ${data.status} — drift ${
          data.drift_score != null
            ? `${(data.drift_score * 100).toFixed(1)}%`
            : "N/A"
        }`,
        data.status === "success" ? "success" : "error",
      );
      fetchAll();
    } catch {
      showNotification("Trigger failed", "error");
    } finally {
      setTriggering(null);
    }
  };

  const handleRegister = async () => {
    const { dataset_name, source_type, interval_minutes, source_config } =
      registerForm;
    if (!dataset_name.trim()) {
      showNotification("Dataset name is required", "error");
      return;
    }

    // Build source_config payload for selected type
    const sc = {};
    if (source_type === "local") sc.folder_path = source_config.folder_path;
    if (source_type === "database") {
      sc.dsn = source_config.dsn;
      sc.query = source_config.query;
    }
    if (source_type === "s3") {
      sc.bucket = source_config.bucket;
      sc.prefix = source_config.prefix;
    }
    if (source_type === "api") sc.url = source_config.url;

    try {
      const res = await fetch(`${API}/production/schedule`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_name,
          source_type,
          interval_minutes,
          source_config: sc,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      showNotification(`'${dataset_name}' registered — first run triggered`);
      setActivePanel("overview");
      fetchAll();
    } catch (e) {
      showNotification(e.message || "Registration failed", "error");
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch(`${API}/production/config`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(editConfig),
      });
      if (!res.ok) throw new Error("Config save failed");
      showNotification("Pipeline config updated — no restart needed");
      fetchAll();
    } catch {
      showNotification("Config save failed", "error");
    } finally {
      setSavingConfig(false);
    }
  };

  // ── derived metrics ──────────────────────────────────────────────────────

  const datasets = health ? Object.entries(health.dataset_health || {}) : [];
  const activeJobs = jobs.filter((j) => !j.id.includes("retention"));
  const recentRuns = runs.slice(0, 30);

  const totalRuns = runs.length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const criticalNow = datasets.filter(
    ([, d]) => d.last_severity === "critical",
  ).length;
  const avgDrift = runs.filter((r) => r.drift_score != null).length
    ? runs
        .filter((r) => r.drift_score != null)
        .reduce((a, r) => a + r.drift_score, 0) /
      runs.filter((r) => r.drift_score != null).length
    : 0;

  // ── render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "4rem",
          color: "var(--text-tertiary)",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⊙</div>
        <p>Loading production pipeline…</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── keyframe for LiveDot ── */}
      <style>{`
        @keyframes prodDotPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>

      {/* ── Header KPIs ─────────────────────────────────────────────────── */}
      <div
        className="stats-grid"
        style={{
          gridTemplateColumns: "repeat(4,1fr)",
          marginBottom: "1.25rem",
        }}
      >
        {[
          {
            icon: "⊞",
            label: "Scheduled Datasets",
            value: activeJobs.length,
            color: "blue",
          },
          {
            icon: "↺",
            label: "Total Runs (loaded)",
            value: totalRuns,
            color: "purple",
          },
          {
            icon: "⚡",
            label: "Critical Now",
            value: criticalNow,
            color: "red",
          },
          {
            icon: "↗",
            label: "Avg Drift Score",
            value: `${(avgDrift * 100).toFixed(1)}%`,
            color: "green",
          },
        ].map((s, i) => (
          <div key={i} className={`stat-card ${s.color}`}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-info">
              <div className="stat-value" style={{ fontSize: "1.75rem" }}>
                {s.value}
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sub-nav ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: "1.25rem",
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-md)",
          padding: 4,
          border: "1px solid var(--border-subtle)",
          width: "fit-content",
        }}
      >
        {[
          { id: "overview", label: "Overview" },
          { id: "runs", label: "Run History" },
          { id: "register", label: "+ Register Dataset" },
          { id: "config", label: "Config" },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => setActivePanel(p.id)}
            style={{
              padding: "0.45rem 1rem",
              border: "none",
              borderRadius: "calc(var(--radius-md) - 2px)",
              background:
                activePanel === p.id ? "var(--blue-500)" : "transparent",
              color: activePanel === p.id ? "#fff" : "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              fontFamily: "var(--font-sans)",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={fetchAll}
          style={{
            marginLeft: "auto",
            padding: "0.45rem 0.875rem",
            border: "1px solid var(--border-default)",
            borderRadius: "calc(var(--radius-md) - 2px)",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: "0.8rem",
            fontFamily: "var(--font-sans)",
          }}
        >
          ↺
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          OVERVIEW PANEL
      ════════════════════════════════════════════════════════════════════ */}
      {activePanel === "overview" && (
        <>
          {/* Scheduler jobs */}
          <div className="card">
            <div className="card-header">
              <h3>
                <LiveDot active={activeJobs.length > 0} />
                &nbsp; Scheduled Jobs
              </h3>
              <span className="trend-badge">{activeJobs.length} active</span>
            </div>
            <div className="card-content">
              {activeJobs.length === 0 ? (
                <div className="empty-state">
                  <p>No datasets scheduled yet.</p>
                  <button
                    className="primary-btn"
                    style={{
                      width: "auto",
                      marginTop: "1rem",
                      padding: "0.5rem 1.25rem",
                    }}
                    onClick={() => setActivePanel("register")}
                  >
                    Register first dataset →
                  </button>
                </div>
              ) : (
                activeJobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    onTrigger={handleTrigger}
                    triggering={triggering}
                  />
                ))
              )}
            </div>
          </div>

          {/* Dataset health cards */}
          {datasets.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>◉ Dataset Health</h3>
                <span className="info-badge">
                  {config?.comparison_mode || "last_snapshot"} mode
                </span>
              </div>
              <div className="card-content">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: "1rem",
                  }}
                >
                  {datasets.map(([name, d]) => {
                    const sev = d.last_severity || "none";
                    const sc = d.last_drift_score || 0;
                    return (
                      <div
                        key={name}
                        style={{
                          padding: "1.125rem",
                          background: "var(--bg-elevated)",
                          borderRadius: "var(--radius-md)",
                          border: `1px solid ${
                            sev === "critical"
                              ? "rgba(239,68,68,0.25)"
                              : sev === "warning"
                                ? "rgba(245,158,11,0.25)"
                                : "var(--border-subtle)"
                          }`,
                          transition: "border-color 0.3s",
                        }}
                      >
                        {/* Header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "0.875rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                            }}
                          >
                            <LiveDot
                              active={d.last_run_status === "success"}
                              color={severityColor(sev)}
                            />
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: "0.875rem",
                                color: "var(--text-primary)",
                              }}
                            >
                              {name}
                            </span>
                          </div>
                          <span
                            className={`badge ${
                              sev === "critical"
                                ? "high"
                                : sev === "warning"
                                  ? "medium"
                                  : "low"
                            }`}
                          >
                            {sev === "none" ? "stable" : sev}
                          </span>
                        </div>

                        {/* Drift bar */}
                        <DriftBar
                          score={sc}
                          warn={config?.drift_threshold_warning || 0.25}
                          crit={config?.drift_threshold_critical || 0.45}
                        />

                        {/* Meta row */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "0.5rem",
                            marginTop: "0.875rem",
                          }}
                        >
                          {[
                            ["Last run", d.last_run_status || "—"],
                            [
                              "Run at",
                              d.last_run_at ? fmt(d.last_run_at) : "—",
                            ],
                            ["Alert sent", d.last_alert_sent ? "Yes" : "No"],
                            ["Error", d.last_error ? "Yes" : "None"],
                          ].map(([label, val]) => (
                            <div key={label}>
                              <div
                                style={{
                                  fontSize: "0.65rem",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                  color: "var(--text-tertiary)",
                                  marginBottom: 2,
                                }}
                              >
                                {label}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color:
                                    label === "Error" && val === "Yes"
                                      ? "var(--red-400)"
                                      : label === "Alert sent" && val === "Yes"
                                        ? "var(--amber-400)"
                                        : "var(--text-secondary)",
                                  fontFamily:
                                    label === "Run at"
                                      ? "var(--font-mono)"
                                      : "inherit",
                                  fontWeight: 500,
                                }}
                              >
                                {val}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Trigger button */}
                        <button
                          onClick={() => handleTrigger(name)}
                          disabled={triggering === name}
                          style={{
                            marginTop: "0.875rem",
                            width: "100%",
                            padding: "0.45rem",
                            background: "rgba(59,130,246,0.08)",
                            border: "1px solid rgba(59,130,246,0.18)",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--blue-400)",
                            cursor:
                              triggering === name ? "not-allowed" : "pointer",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            fontFamily: "var(--font-sans)",
                            opacity: triggering === name ? 0.5 : 1,
                            transition: "all 0.15s",
                          }}
                        >
                          {triggering === name ? "Running…" : "▶ Run now"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Pipeline explanation */}
          <div
            className="card"
            style={{ borderColor: "rgba(59,130,246,0.12)" }}
          >
            <div className="card-header">
              <h3>⊙ How Auto-Comparison Works</h3>
            </div>
            <div className="card-content">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "1rem",
                }}
              >
                {[
                  {
                    step: "1",
                    title: "Scheduled Fetch",
                    desc: `Every ${config?.interval_minutes || 10} min the pipeline pulls fresh data from the registered source (DB / S3 / API / folder).`,
                    color: "var(--blue-400)",
                  },
                  {
                    step: "2",
                    title: "Validate",
                    desc: "Row count, null-rate, and schema fingerprint are checked. Bad data is rejected before comparison.",
                    color: "var(--cyan-400)",
                  },
                  {
                    step: "3",
                    title: "Compare",
                    desc: `Drift is measured against the ${config?.comparison_mode || "last snapshot"} using statistical + semantic analysis.`,
                    color: "var(--violet-400)",
                  },
                  {
                    step: "4",
                    title: "Persist Check",
                    desc: `Alert fires only after drift is confirmed ${config?.persistence_cycles || 2} consecutive cycles — preventing false positives.`,
                    color: "var(--amber-400)",
                  },
                  {
                    step: "5",
                    title: "Alert + Cooldown",
                    desc: `One alert per ${config?.alert_cooldown_minutes || 30} min per dataset. Escalates from info → warning → critical.`,
                    color: "var(--red-400)",
                  },
                  {
                    step: "6",
                    title: "Auto-Archive",
                    desc: `Snapshots older than ${config?.archive_after_days || 7} days are archived; hard-deleted after ${config?.retention_days || 30} days.`,
                    color: "var(--green-400)",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    style={{
                      padding: "1rem",
                      background: "var(--bg-elevated)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      borderTop: `3px solid ${item.color}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        marginBottom: "0.625rem",
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: `${item.color}18`,
                          border: `1.5px solid ${item.color}40`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: item.color,
                          flexShrink: 0,
                        }}
                      >
                        {item.step}
                      </span>
                      <span
                        style={{
                          fontSize: "0.83rem",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {item.title}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.55,
                        margin: 0,
                      }}
                    >
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          RUN HISTORY PANEL
      ════════════════════════════════════════════════════════════════════ */}
      {activePanel === "runs" && (
        <div className="card">
          <div className="card-header">
            <h3>↺ Ingestion Run History</h3>
            <div
              style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
            >
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-tertiary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {failedRuns > 0 && (
                  <span style={{ color: "var(--red-400)", fontWeight: 700 }}>
                    {failedRuns} failed
                  </span>
                )}
              </span>
              <span className="count-badge">{runs.length} runs</span>
            </div>
          </div>
          <div className="card-content">
            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "20px 140px 80px 100px 80px 80px 50px",
                gap: "0.75rem",
                padding: "0.5rem 1rem",
                marginBottom: "0.375rem",
              }}
            >
              {[
                "",
                "Dataset",
                "Status",
                "Started",
                "Drift",
                "Duration",
                "Alert",
              ].map((h) => (
                <span
                  key={h}
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
            {recentRuns.length === 0 ? (
              <div className="empty-state">
                <p>No runs recorded yet. Register a dataset to begin.</p>
              </div>
            ) : (
              recentRuns.map((run) => <RunRow key={run.id} run={run} />)
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          REGISTER DATASET PANEL
      ════════════════════════════════════════════════════════════════════ */}
      {activePanel === "register" && (
        <div className="card">
          <div className="card-header">
            <h3>+ Register Dataset for Auto-Monitoring</h3>
          </div>
          <div className="card-content">
            {/* Dataset name + interval */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 200px",
                gap: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div className="input-wrapper" style={{ margin: 0 }}>
                <label>Dataset Name *</label>
                <input
                  className="styled-input"
                  placeholder="e.g., customer_features"
                  value={registerForm.dataset_name}
                  onChange={(e) =>
                    setRegisterForm((p) => ({
                      ...p,
                      dataset_name: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="input-wrapper" style={{ margin: 0 }}>
                <label>Interval (minutes)</label>
                <input
                  className="styled-input"
                  type="number"
                  min={1}
                  value={registerForm.interval_minutes}
                  onChange={(e) =>
                    setRegisterForm((p) => ({
                      ...p,
                      interval_minutes: parseInt(e.target.value) || 10,
                    }))
                  }
                />
              </div>
            </div>

            {/* Source type selector */}
            <div className="input-wrapper">
              <label>Data Source Type</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "0.5rem",
                }}
              >
                {[
                  { id: "local", label: "Local Folder", icon: "📁" },
                  { id: "database", label: "Database", icon: "🗄" },
                  { id: "s3", label: "AWS S3", icon: "☁" },
                  { id: "api", label: "REST API", icon: "🔗" },
                ].map((src) => (
                  <button
                    key={src.id}
                    onClick={() =>
                      setRegisterForm((p) => ({ ...p, source_type: src.id }))
                    }
                    style={{
                      padding: "0.75rem",
                      border: `1px solid ${
                        registerForm.source_type === src.id
                          ? "var(--blue-500)"
                          : "var(--border-default)"
                      }`,
                      borderRadius: "var(--radius-md)",
                      background:
                        registerForm.source_type === src.id
                          ? "rgba(59,130,246,0.1)"
                          : "var(--bg-elevated)",
                      color:
                        registerForm.source_type === src.id
                          ? "var(--blue-400)"
                          : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      fontFamily: "var(--font-sans)",
                      textAlign: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      style={{ fontSize: "1.25rem", marginBottom: "0.375rem" }}
                    >
                      {src.icon}
                    </div>
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Source-specific fields */}
            <div
              style={{
                padding: "1.125rem",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                marginBottom: "1.5rem",
              }}
            >
              {registerForm.source_type === "local" && (
                <div className="input-wrapper" style={{ margin: 0 }}>
                  <label>Folder Path</label>
                  <input
                    className="styled-input"
                    placeholder="/data/monitoring/customer_features/"
                    value={registerForm.source_config.folder_path}
                    onChange={(e) =>
                      setRegisterForm((p) => ({
                        ...p,
                        source_config: {
                          ...p.source_config,
                          folder_path: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              )}

              {registerForm.source_type === "database" && (
                <>
                  <div className="input-wrapper">
                    <label>Database DSN</label>
                    <input
                      className="styled-input"
                      placeholder="postgresql://user:pass@host:5432/dbname"
                      value={registerForm.source_config.dsn}
                      onChange={(e) =>
                        setRegisterForm((p) => ({
                          ...p,
                          source_config: {
                            ...p.source_config,
                            dsn: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="input-wrapper" style={{ margin: 0 }}>
                    <label>SQL Query</label>
                    <input
                      className="styled-input"
                      placeholder="SELECT * FROM features WHERE created_at > NOW() - INTERVAL '15 minutes'"
                      value={registerForm.source_config.query}
                      onChange={(e) =>
                        setRegisterForm((p) => ({
                          ...p,
                          source_config: {
                            ...p.source_config,
                            query: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {registerForm.source_type === "s3" && (
                <>
                  <div className="input-wrapper">
                    <label>S3 Bucket</label>
                    <input
                      className="styled-input"
                      placeholder="my-ml-data-bucket"
                      value={registerForm.source_config.bucket}
                      onChange={(e) =>
                        setRegisterForm((p) => ({
                          ...p,
                          source_config: {
                            ...p.source_config,
                            bucket: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="input-wrapper" style={{ margin: 0 }}>
                    <label>S3 Prefix / Path</label>
                    <input
                      className="styled-input"
                      placeholder="monitoring/customer_features/"
                      value={registerForm.source_config.prefix}
                      onChange={(e) =>
                        setRegisterForm((p) => ({
                          ...p,
                          source_config: {
                            ...p.source_config,
                            prefix: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {registerForm.source_type === "api" && (
                <div className="input-wrapper" style={{ margin: 0 }}>
                  <label>API Endpoint URL</label>
                  <input
                    className="styled-input"
                    placeholder="https://internal-api.company.com/v1/features/snapshot"
                    value={registerForm.source_config.url}
                    onChange={(e) =>
                      setRegisterForm((p) => ({
                        ...p,
                        source_config: {
                          ...p.source_config,
                          url: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                className="primary-btn"
                style={{ width: "auto", padding: "0.625rem 1.75rem" }}
                onClick={handleRegister}
              >
                Register & Start Monitoring →
              </button>
              <button
                className="secondary-btn"
                onClick={() => setActivePanel("overview")}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          CONFIG PANEL
      ════════════════════════════════════════════════════════════════════ */}
      {activePanel === "config" && editConfig && (
        <div className="card">
          <div className="card-header">
            <h3>⚙ Pipeline Configuration</h3>
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--green-400)",
                background: "rgba(34,197,94,0.08)",
                border: "1px solid rgba(34,197,94,0.15)",
                padding: "0.25rem 0.625rem",
                borderRadius: "20px",
                fontWeight: 600,
              }}
            >
              Hot-reload — no restart needed
            </span>
          </div>
          <div className="card-content">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1.5rem",
              }}
            >
              {/* Scheduling */}
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  Scheduling
                </div>
                <div className="input-wrapper">
                  <label>Interval (minutes)</label>
                  <input
                    type="number"
                    className="styled-input"
                    value={editConfig.interval_minutes || 10}
                    onChange={(e) =>
                      setEditConfig((p) => ({
                        ...p,
                        interval_minutes: parseInt(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {/* Comparison */}
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  Comparison
                </div>
                <div className="input-wrapper">
                  <label>Comparison Mode</label>
                  <select
                    className="styled-input"
                    value={editConfig.comparison_mode || "last_snapshot"}
                    onChange={(e) =>
                      setEditConfig((p) => ({
                        ...p,
                        comparison_mode: e.target.value,
                      }))
                    }
                  >
                    <option value="last_snapshot">Last Snapshot</option>
                    <option value="baseline">Production Baseline</option>
                    <option value="rolling_window">Rolling Window</option>
                  </select>
                </div>
                {editConfig.comparison_mode === "rolling_window" && (
                  <div className="input-wrapper">
                    <label>Window Size (snapshots)</label>
                    <input
                      type="number"
                      className="styled-input"
                      value={editConfig.rolling_window_size || 5}
                      onChange={(e) =>
                        setEditConfig((p) => ({
                          ...p,
                          rolling_window_size: parseInt(e.target.value),
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              {/* Thresholds */}
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  Drift Thresholds
                </div>
                {[
                  {
                    key: "drift_threshold_info",
                    label: "Info threshold",
                    color: "var(--cyan-400)",
                  },
                  {
                    key: "drift_threshold_warning",
                    label: "Warning threshold",
                    color: "var(--amber-400)",
                  },
                  {
                    key: "drift_threshold_critical",
                    label: "Critical threshold",
                    color: "var(--red-400)",
                  },
                ].map(({ key, label, color }) => (
                  <div key={key} style={{ marginBottom: "1rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "0.375rem",
                      }}
                    >
                      <label
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-secondary)",
                          fontWeight: 500,
                        }}
                      >
                        {label}
                      </label>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.78rem",
                          color,
                          fontWeight: 700,
                        }}
                      >
                        {((editConfig[key] || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      className="slider"
                      value={editConfig[key] || 0}
                      onChange={(e) =>
                        setEditConfig((p) => ({
                          ...p,
                          [key]: parseFloat(e.target.value),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              {/* Persistence & Alerting */}
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  Persistence & Alerting
                </div>
                <div className="input-wrapper">
                  <label>
                    Persistence Cycles — confirm drift after{" "}
                    <strong style={{ color: "var(--blue-400)" }}>
                      {editConfig.persistence_cycles || 2}
                    </strong>{" "}
                    consecutive checks
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    className="slider"
                    value={editConfig.persistence_cycles || 2}
                    onChange={(e) =>
                      setEditConfig((p) => ({
                        ...p,
                        persistence_cycles: parseInt(e.target.value),
                      }))
                    }
                  />
                  {/* Visual preview */}
                  <div style={{ marginTop: "0.5rem" }}>
                    <PersistenceDots
                      count={editConfig.persistence_cycles || 2}
                      total={editConfig.persistence_cycles || 2}
                      severity="warning"
                    />
                  </div>
                </div>
                <div className="input-wrapper">
                  <label>Alert Cooldown (minutes)</label>
                  <input
                    type="number"
                    className="styled-input"
                    value={editConfig.alert_cooldown_minutes || 30}
                    onChange={(e) =>
                      setEditConfig((p) => ({
                        ...p,
                        alert_cooldown_minutes: parseInt(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {/* Retention */}
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  Retention
                </div>
                <div className="input-wrapper">
                  <label>Archive after (days)</label>
                  <input
                    type="number"
                    className="styled-input"
                    value={editConfig.archive_after_days || 7}
                    onChange={(e) =>
                      setEditConfig((p) => ({
                        ...p,
                        archive_after_days: parseInt(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="input-wrapper" style={{ margin: 0 }}>
                  <label>Hard-delete after (days)</label>
                  <input
                    type="number"
                    className="styled-input"
                    value={editConfig.retention_days || 30}
                    onChange={(e) =>
                      setEditConfig((p) => ({
                        ...p,
                        retention_days: parseInt(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              {/* Data quality */}
              <div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: "0.875rem",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  Data Quality Gates
                </div>
                <div className="input-wrapper">
                  <label>Min row count</label>
                  <input
                    type="number"
                    className="styled-input"
                    value={editConfig.min_row_count || 50}
                    onChange={(e) =>
                      setEditConfig((p) => ({
                        ...p,
                        min_row_count: parseInt(e.target.value),
                      }))
                    }
                  />
                </div>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editConfig.schema_strict || false}
                    onChange={(e) =>
                      setEditConfig((p) => ({
                        ...p,
                        schema_strict: e.target.checked,
                      }))
                    }
                  />
                  Strict schema enforcement (reject on schema change)
                </label>
              </div>
            </div>

            <div style={{ marginTop: "2rem", display: "flex", gap: "0.75rem" }}>
              <button
                className="primary-btn"
                style={{ width: "auto", padding: "0.625rem 1.75rem" }}
                onClick={handleSaveConfig}
                disabled={savingConfig}
              >
                {savingConfig ? "Saving…" : "Apply Configuration →"}
              </button>
              <button
                className="secondary-btn"
                onClick={() => setEditConfig(config || {})}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
