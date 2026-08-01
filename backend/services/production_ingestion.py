"""
production_ingestion.py
────────────────────────────────────────────────────────────────
Robust automated data-ingestion & drift-comparison pipeline.

Key capabilities
────────────────
• Configurable scheduler (APScheduler) – pull data every N minutes
• Multiple source connectors: PostgreSQL, S3, REST API, local CSV folder
• Distributed locking via Redis – prevents concurrent duplicate runs
• Exponential-backoff retry on transient failures
• Data validation (row-count, null-rate, schema fingerprint)
• Multi-mode comparison:
    - last_snapshot   → detect sudden drift
    - baseline        → detect long-term drift vs production reference
    - rolling_window  → compare vs rolling avg of last N snapshots
• Drift persistence engine – alert only when drift is confirmed
  across K consecutive cycles (avoid single-spike false positives)
• Alert cooldown – prevent alert fatigue (configurable quiet period)
• Retention janitor – auto-archive snapshots older than N days
• Full audit trail written to Postgres (ingestion_runs table)
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

import pandas as pd
import redis
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import create_engine, text

# ── project-local imports (adjust to your package layout) ──────────────────
from database import SessionLocal, engine           # SQLAlchemy session factory
from models import DriftSnapshot, IngestionRun      # SQLAlchemy ORM models
from drift_analysis import analyze_drift            # existing drift logic
from alerts import send_alert                       # existing alert dispatcher

logger = logging.getLogger("production_ingestion")
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s")


# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class IngestionConfig:
    """Central, runtime-changeable configuration for the pipeline."""

    # ── Scheduling ──────────────────────────────────────────────────────────
    interval_minutes: int = 10          # how often to ingest + compare
    max_retries: int = 3                # per-cycle retry attempts
    retry_backoff_base: float = 2.0     # exponential backoff base (seconds)

    # ── Drift detection ─────────────────────────────────────────────────────
    comparison_mode: str = "last_snapshot"   # last_snapshot | baseline | rolling_window
    rolling_window_size: int = 5             # N snapshots for rolling average
    drift_threshold_info: float = 0.10       # minor – log only
    drift_threshold_warning: float = 0.25    # medium – warn
    drift_threshold_critical: float = 0.45   # high – page/Slack

    # ── Persistence check ───────────────────────────────────────────────────
    persistence_cycles: int = 2   # alert only after drift confirmed N cycles
    # tracks {dataset_name: consecutive_drift_count}
    _drift_counters: Dict[str, int] = field(default_factory=dict)

    # ── Alert cooldown ───────────────────────────────────────────────────────
    alert_cooldown_minutes: int = 30   # don't re-alert within this window
    # tracks {dataset_name: last_alert_utc}
    _last_alert_time: Dict[str, datetime] = field(default_factory=dict)

    # ── Storage / retention ─────────────────────────────────────────────────
    retention_days: int = 30       # delete snapshots older than this
    archive_after_days: int = 7    # move to "archived" status after N days

    # ── Data quality gates ───────────────────────────────────────────────────
    min_row_count: int = 50                # reject if fewer rows
    max_null_rate: float = 0.30            # reject if >30% nulls in any column
    schema_strict: bool = False            # True → reject on schema change


# Singleton config – overridable via API or env at startup
INGESTION_CONFIG = IngestionConfig()


# ═══════════════════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════════════════

class AlertSeverity(str, Enum):
    INFO     = "info"
    WARNING  = "warning"
    CRITICAL = "critical"


class RunStatus(str, Enum):
    SUCCESS  = "success"
    SKIPPED  = "skipped"
    FAILED   = "failed"
    NO_DATA  = "no_data"


# ═══════════════════════════════════════════════════════════════════════════
# REDIS DISTRIBUTED LOCK
# ═══════════════════════════════════════════════════════════════════════════

class RedisLock:
    """
    Simple Redis-based distributed lock using SET NX PX.
    Prevents two scheduler pods from running the same pipeline simultaneously.
    """
    LOCK_KEY = "drift_monitor:ingestion_lock"
    TTL_MS   = 5 * 60 * 1000   # 5 minutes max lock lifetime

    def __init__(self, redis_client: redis.Redis):
        self._r = redis_client
        self._token = str(uuid.uuid4())

    def acquire(self) -> bool:
        return bool(
            self._r.set(self.LOCK_KEY, self._token, px=self.TTL_MS, nx=True)
        )

    def release(self) -> None:
        """Only release if we own the lock (Lua script for atomicity)."""
        script = """
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        else
            return 0
        end
        """
        self._r.eval(script, 1, self.LOCK_KEY, self._token)

    @contextmanager
    def locked(self):
        acquired = self.acquire()
        if not acquired:
            raise RuntimeError("Could not acquire ingestion lock – another run is active")
        try:
            yield
        finally:
            self.release()


# ═══════════════════════════════════════════════════════════════════════════
# SOURCE CONNECTORS
# ═══════════════════════════════════════════════════════════════════════════

class SourceConnector:
    """Abstract base for all data-source connectors."""

    name: str = "base"

    def fetch(self, dataset_name: str) -> Optional[pd.DataFrame]:
        raise NotImplementedError


class DatabaseConnector(SourceConnector):
    """
    Pull a snapshot from a SQL database table/view.
    Expects env / config to supply connection DSN and query.
    """
    name = "database"

    def __init__(self, dsn: str, query: str, params: Dict = None):
        self._engine = create_engine(dsn)
        self._query  = query
        self._params = params or {}

    def fetch(self, dataset_name: str) -> Optional[pd.DataFrame]:
        try:
            with self._engine.connect() as conn:
                df = pd.read_sql(text(self._query), conn, params=self._params)
            logger.info(f"[DB] fetched {len(df)} rows for '{dataset_name}'")
            return df
        except Exception as exc:
            logger.error(f"[DB] fetch failed: {exc}")
            return None


class S3Connector(SourceConnector):
    """Pull latest CSV/Parquet from an S3 prefix."""
    name = "s3"

    def __init__(self, bucket: str, prefix: str, file_format: str = "csv"):
        try:
            import boto3
            self._s3 = boto3.client("s3")
        except ImportError:
            raise RuntimeError("boto3 is required for S3 connector: pip install boto3")
        self._bucket = bucket
        self._prefix = prefix
        self._fmt    = file_format

    def fetch(self, dataset_name: str) -> Optional[pd.DataFrame]:
        try:
            # List objects, pick the latest by LastModified
            resp = self._s3.list_objects_v2(Bucket=self._bucket, Prefix=self._prefix)
            objects = sorted(resp.get("Contents", []),
                             key=lambda o: o["LastModified"], reverse=True)
            if not objects:
                logger.warning(f"[S3] No objects found at s3://{self._bucket}/{self._prefix}")
                return None

            latest_key = objects[0]["Key"]
            obj = self._s3.get_object(Bucket=self._bucket, Key=latest_key)
            body = obj["Body"].read()

            if self._fmt == "parquet":
                df = pd.read_parquet(io.BytesIO(body))
            else:
                df = pd.read_csv(io.BytesIO(body))

            logger.info(f"[S3] fetched {len(df)} rows from s3://{self._bucket}/{latest_key}")
            return df
        except Exception as exc:
            logger.error(f"[S3] fetch failed: {exc}")
            return None


class APIConnector(SourceConnector):
    """Pull JSON data from a REST API endpoint."""
    name = "api"

    def __init__(self, url: str, headers: Dict = None, params: Dict = None,
                 record_path: Optional[str] = None):
        self._url         = url
        self._headers     = headers or {}
        self._params      = params or {}
        self._record_path = record_path  # JSON key containing the array

    def fetch(self, dataset_name: str) -> Optional[pd.DataFrame]:
        try:
            import requests
            resp = requests.get(self._url, headers=self._headers,
                                params=self._params, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if self._record_path:
                data = data[self._record_path]
            df = pd.DataFrame(data)
            logger.info(f"[API] fetched {len(df)} rows for '{dataset_name}'")
            return df
        except Exception as exc:
            logger.error(f"[API] fetch failed: {exc}")
            return None


class LocalFolderConnector(SourceConnector):
    """
    Watch a local folder for new CSV files.
    Useful for development / on-prem environments.
    """
    name = "local"

    def __init__(self, folder_path: str, pattern: str = "*.csv"):
        import glob, os
        self._folder  = folder_path
        self._pattern = pattern
        self._os      = os
        self._glob    = glob

    def fetch(self, dataset_name: str) -> Optional[pd.DataFrame]:
        import glob, os
        files = sorted(
            glob.glob(os.path.join(self._folder, self._pattern)),
            key=os.path.getmtime, reverse=True
        )
        if not files:
            logger.warning(f"[Local] No files found in {self._folder}")
            return None
        latest = files[0]
        df = pd.read_csv(latest)
        logger.info(f"[Local] fetched {len(df)} rows from {latest}")
        return df


# ═══════════════════════════════════════════════════════════════════════════
# DATA VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class ValidationResult:
    valid: bool
    issues: List[str] = field(default_factory=list)
    schema_fingerprint: str = ""

def _schema_fingerprint(df: pd.DataFrame) -> str:
    sig = "|".join(f"{c}:{str(t)}" for c, t in sorted(df.dtypes.items()))
    return hashlib.md5(sig.encode()).hexdigest()[:12]

def validate_dataframe(df: pd.DataFrame, cfg: IngestionConfig,
                       prev_fingerprint: Optional[str] = None) -> ValidationResult:
    issues: List[str] = []

    # 1. Minimum row count
    if len(df) < cfg.min_row_count:
        issues.append(f"Row count {len(df)} < minimum {cfg.min_row_count}")

    # 2. Null-rate per column
    null_rates = df.isnull().mean()
    bad_cols = null_rates[null_rates > cfg.max_null_rate].index.tolist()
    if bad_cols:
        issues.append(f"High null rate in columns: {bad_cols}")

    # 3. Schema change detection
    fp = _schema_fingerprint(df)
    if prev_fingerprint and fp != prev_fingerprint:
        msg = f"Schema changed (prev={prev_fingerprint}, curr={fp})"
        if cfg.schema_strict:
            issues.append(msg)
        else:
            logger.warning(f"[Validation] {msg} – continuing (schema_strict=False)")

    return ValidationResult(
        valid=len(issues) == 0,
        issues=issues,
        schema_fingerprint=fp
    )


# ═══════════════════════════════════════════════════════════════════════════
# DRIFT PERSISTENCE ENGINE
# ═══════════════════════════════════════════════════════════════════════════

class DriftPersistenceEngine:
    """
    Tracks consecutive drift cycles per dataset.
    Only fires an alert after drift is confirmed for `persistence_cycles`
    consecutive comparisons. Resets counter on clean cycle.
    """

    def __init__(self, cfg: IngestionConfig):
        self._cfg      = cfg
        self._counters: Dict[str, int] = {}     # dataset → consecutive drift count
        self._severity: Dict[str, str] = {}      # dataset → current severity

    def _classify_severity(self, drift_score: float) -> Optional[AlertSeverity]:
        if drift_score >= self._cfg.drift_threshold_critical:
            return AlertSeverity.CRITICAL
        if drift_score >= self._cfg.drift_threshold_warning:
            return AlertSeverity.WARNING
        if drift_score >= self._cfg.drift_threshold_info:
            return AlertSeverity.INFO
        return None   # no drift

    def should_alert(self, dataset_name: str, drift_score: float) -> tuple[bool, Optional[AlertSeverity]]:
        """
        Returns (should_alert, severity).
        Updates internal counters.
        """
        severity = self._classify_severity(drift_score)

        if severity is None:
            # Clean cycle – reset counter
            if self._counters.get(dataset_name, 0) > 0:
                logger.info(f"[Persistence] '{dataset_name}' drift resolved – counter reset")
            self._counters[dataset_name] = 0
            self._severity[dataset_name] = ""
            return False, None

        # Increment consecutive drift counter
        self._counters[dataset_name] = self._counters.get(dataset_name, 0) + 1
        self._severity[dataset_name] = severity.value
        count = self._counters[dataset_name]

        logger.info(
            f"[Persistence] '{dataset_name}' drift={drift_score:.3f} "
            f"severity={severity.value} consecutive={count}/{self._cfg.persistence_cycles}"
        )

        if count >= self._cfg.persistence_cycles:
            return True, severity

        return False, severity   # drift seen but not yet persistent

    def get_status(self, dataset_name: str) -> Dict:
        return {
            "consecutive_drift_cycles": self._counters.get(dataset_name, 0),
            "current_severity": self._severity.get(dataset_name, "none"),
            "needs_confirmation": (
                0 < self._counters.get(dataset_name, 0) < self._cfg.persistence_cycles
            ),
        }


# ═══════════════════════════════════════════════════════════════════════════
# ALERT COOLDOWN MANAGER
# ═══════════════════════════════════════════════════════════════════════════

class AlertCooldownManager:
    """
    Prevents alert spam.  One alert per dataset per cooldown window.
    State stored in Redis so it survives restarts.
    """

    KEY_PREFIX = "drift_monitor:last_alert:"

    def __init__(self, redis_client: redis.Redis, cfg: IngestionConfig):
        self._r   = redis_client
        self._cfg = cfg

    def _key(self, dataset_name: str) -> str:
        return f"{self.KEY_PREFIX}{dataset_name}"

    def can_alert(self, dataset_name: str) -> bool:
        raw = self._r.get(self._key(dataset_name))
        if not raw:
            return True
        last_alert = datetime.fromisoformat(raw.decode())
        cooldown = timedelta(minutes=self._cfg.alert_cooldown_minutes)
        return datetime.now(timezone.utc) - last_alert >= cooldown

    def record_alert(self, dataset_name: str) -> None:
        ttl_seconds = self._cfg.alert_cooldown_minutes * 60 + 60
        self._r.setex(
            self._key(dataset_name),
            ttl_seconds,
            datetime.now(timezone.utc).isoformat()
        )


# ═══════════════════════════════════════════════════════════════════════════
# BASELINE MANAGER
# ═══════════════════════════════════════════════════════════════════════════

class BaselineManager:
    """
    Stores and retrieves the production baseline for each dataset.
    Baseline is pinned manually (or auto-set from the first clean snapshot).
    """

    KEY_PREFIX = "drift_monitor:baseline:"

    def __init__(self, redis_client: redis.Redis):
        self._r = redis_client

    def set_baseline(self, dataset_name: str, snapshot_id: str) -> None:
        self._r.set(f"{self.KEY_PREFIX}{dataset_name}", snapshot_id)
        logger.info(f"[Baseline] '{dataset_name}' baseline set → snapshot {snapshot_id}")

    def get_baseline_id(self, dataset_name: str) -> Optional[str]:
        raw = self._r.get(f"{self.KEY_PREFIX}{dataset_name}")
        return raw.decode() if raw else None


# ═══════════════════════════════════════════════════════════════════════════
# RETENTION / JANITOR
# ═══════════════════════════════════════════════════════════════════════════

def run_retention_policy(cfg: IngestionConfig) -> None:
    """
    Mark snapshots older than `retention_days` as archived.
    Hard-delete snapshots older than 3× retention_days.
    Should run once daily (separate scheduler job).
    """
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        archive_cutoff = now - timedelta(days=cfg.archive_after_days)
        delete_cutoff  = now - timedelta(days=cfg.retention_days * 3)

        archived = (
            db.query(DriftSnapshot)
            .filter(DriftSnapshot.timestamp < archive_cutoff,
                    DriftSnapshot.status != "archived")
            .update({"status": "archived"})
        )

        deleted = (
            db.query(DriftSnapshot)
            .filter(DriftSnapshot.timestamp < delete_cutoff)
            .delete()
        )

        db.commit()
        logger.info(f"[Retention] archived={archived} deleted={deleted}")
    except Exception as exc:
        db.rollback()
        logger.error(f"[Retention] error: {exc}")
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# CORE PIPELINE
# ═══════════════════════════════════════════════════════════════════════════

class ProductionIngestionPipeline:
    """
    Orchestrates the full automated ingestion → validation →
    comparison → alerting cycle for a single dataset.
    """

    def __init__(
        self,
        dataset_name: str,
        connector: SourceConnector,
        redis_client: redis.Redis,
        cfg: IngestionConfig = INGESTION_CONFIG,
    ):
        self.dataset_name = dataset_name
        self.connector    = connector
        self.cfg          = cfg
        self._lock        = RedisLock(redis_client)
        self._persistence = DriftPersistenceEngine(cfg)
        self._cooldown    = AlertCooldownManager(redis_client, cfg)
        self._baseline    = BaselineManager(redis_client)
        self._prev_schema_fp: Optional[str] = None

    # ── internal: fetch with retry ─────────────────────────────────────────
    def _fetch_with_retry(self) -> Optional[pd.DataFrame]:
        for attempt in range(1, self.cfg.max_retries + 1):
            df = self.connector.fetch(self.dataset_name)
            if df is not None and not df.empty:
                return df
            wait = self.cfg.retry_backoff_base ** attempt
            logger.warning(
                f"[Retry] '{self.dataset_name}' attempt {attempt}/{self.cfg.max_retries} "
                f"– retrying in {wait:.1f}s"
            )
            time.sleep(wait)
        return None

    # ── internal: get comparison target snapshot ───────────────────────────
    def _get_comparison_snapshot(self, db, current_snapshot_id: str) -> Optional[DriftSnapshot]:
        mode = self.cfg.comparison_mode

        if mode == "baseline":
            baseline_id = self._baseline.get_baseline_id(self.dataset_name)
            if baseline_id:
                return db.query(DriftSnapshot).get(baseline_id)
            logger.warning(f"[Compare] No baseline set for '{self.dataset_name}' – falling back to last_snapshot")

        if mode == "rolling_window":
            # Return the snapshot representing the rolling average
            # (for simplicity we use the oldest in the window as reference)
            snaps = (
                db.query(DriftSnapshot)
                .filter(
                    DriftSnapshot.dataset_name == self.dataset_name,
                    DriftSnapshot.id != current_snapshot_id,
                    DriftSnapshot.status != "archived",
                )
                .order_by(DriftSnapshot.timestamp.desc())
                .limit(self.cfg.rolling_window_size)
                .all()
            )
            return snaps[-1] if snaps else None   # oldest in window

        # default: last_snapshot
        return (
            db.query(DriftSnapshot)
            .filter(
                DriftSnapshot.dataset_name == self.dataset_name,
                DriftSnapshot.id != current_snapshot_id,
                DriftSnapshot.status != "archived",
            )
            .order_by(DriftSnapshot.timestamp.desc())
            .first()
        )

    # ── main cycle ─────────────────────────────────────────────────────────
    def run_cycle(self) -> Dict[str, Any]:
        run_id  = str(uuid.uuid4())[:8]
        started = datetime.now(timezone.utc)
        result: Dict[str, Any] = {
            "run_id": run_id,
            "dataset": self.dataset_name,
            "status": RunStatus.FAILED,
            "started_at": started.isoformat(),
        }

        try:
            with self._lock.locked():
                result.update(self._execute_cycle(run_id))
        except RuntimeError as exc:
            # Lock contention – another pod is running
            result["status"] = RunStatus.SKIPPED
            result["reason"] = str(exc)
            logger.info(f"[Cycle] '{self.dataset_name}' skipped – {exc}")
        except Exception as exc:
            result["error"] = str(exc)
            logger.error(f"[Cycle] '{self.dataset_name}' unhandled error: {exc}", exc_info=True)
        finally:
            result["duration_seconds"] = (
                datetime.now(timezone.utc) - started
            ).total_seconds()
            self._persist_run(result)

        return result

    def _execute_cycle(self, run_id: str) -> Dict[str, Any]:
        logger.info(f"[Pipeline] ── START '{self.dataset_name}' run={run_id} ──")

        # 1. Fetch data ──────────────────────────────────────────────────────
        df = self._fetch_with_retry()
        if df is None or df.empty:
            logger.warning(f"[Pipeline] No data fetched for '{self.dataset_name}'")
            return {"status": RunStatus.NO_DATA, "reason": "source returned empty dataset"}

        # 2. Validate ────────────────────────────────────────────────────────
        validation = validate_dataframe(df, self.cfg, self._prev_schema_fp)
        if not validation.valid:
            logger.error(f"[Pipeline] Validation failed: {validation.issues}")
            return {
                "status": RunStatus.FAILED,
                "reason": "data validation failed",
                "validation_issues": validation.issues,
            }
        self._prev_schema_fp = validation.schema_fingerprint

        # 3. Create snapshot ─────────────────────────────────────────────────
        db = SessionLocal()
        try:
            new_snapshot = _create_snapshot(db, df, self.dataset_name, run_id)

            # Auto-set baseline if none exists
            if not self._baseline.get_baseline_id(self.dataset_name):
                self._baseline.set_baseline(self.dataset_name, str(new_snapshot.id))

            # 4. Find comparison target ──────────────────────────────────────
            compare_snap = self._get_comparison_snapshot(db, str(new_snapshot.id))
            if not compare_snap:
                logger.info(f"[Pipeline] No previous snapshot – this is the first run")
                db.commit()
                return {"status": RunStatus.SUCCESS, "note": "first_snapshot – no comparison"}

            # 5. Drift comparison ────────────────────────────────────────────
            comparison_result = analyze_drift(new_snapshot, compare_snap)
            drift_score: float = comparison_result.get("drift_score", 0.0)

            # Attach comparison metadata to new snapshot
            new_snapshot.drift_score    = drift_score
            new_snapshot.drift_severity = comparison_result.get("severity", "low")
            new_snapshot.compared_to    = str(compare_snap.id)
            new_snapshot.comparison_mode = self.cfg.comparison_mode

            db.commit()

            # 6. Persistence check ───────────────────────────────────────────
            should_alert, severity = self._persistence.should_alert(
                self.dataset_name, drift_score
            )

            # 7. Alert routing ───────────────────────────────────────────────
            alert_sent = False
            if should_alert and self._cooldown.can_alert(self.dataset_name):
                self._fire_alert(severity, drift_score, comparison_result,
                                 new_snapshot, compare_snap)
                self._cooldown.record_alert(self.dataset_name)
                alert_sent = True
            elif should_alert:
                logger.info(
                    f"[Alert] '{self.dataset_name}' in cooldown – suppressing alert "
                    f"(drift={drift_score:.3f})"
                )

            persistence_status = self._persistence.get_status(self.dataset_name)

            logger.info(
                f"[Pipeline] ── END '{self.dataset_name}' "
                f"drift={drift_score:.3f} severity={severity} "
                f"alert_sent={alert_sent} ──"
            )

            return {
                "status": RunStatus.SUCCESS,
                "drift_score": drift_score,
                "severity": severity.value if severity else "none",
                "alert_sent": alert_sent,
                "new_snapshot_id": str(new_snapshot.id),
                "compared_to_snapshot_id": str(compare_snap.id),
                "comparison_mode": self.cfg.comparison_mode,
                "persistence": persistence_status,
                "schema_fingerprint": validation.schema_fingerprint,
            }
        except Exception as exc:
            db.rollback()
            raise
        finally:
            db.close()

    def _fire_alert(
        self,
        severity: AlertSeverity,
        drift_score: float,
        comparison_result: Dict,
        new_snap: DriftSnapshot,
        prev_snap: DriftSnapshot,
    ) -> None:
        payload = {
            "dataset": self.dataset_name,
            "severity": severity.value,
            "drift_score": drift_score,
            "drift_details": comparison_result,
            "new_snapshot_id": str(new_snap.id),
            "compared_to_id": str(prev_snap.id),
            "comparison_mode": self.cfg.comparison_mode,
            "consecutive_cycles": self._persistence._counters.get(self.dataset_name, 0),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        logger.warning(
            f"[ALERT] {severity.value.upper()} – '{self.dataset_name}' "
            f"drift={drift_score:.3f}"
        )
        send_alert(payload)

    def _persist_run(self, result: Dict) -> None:
        """Write run audit record to the ingestion_runs table."""
        db = SessionLocal()
        try:
            run = IngestionRun(
                id=str(uuid.uuid4()),
                dataset_name=self.dataset_name,
                status=result.get("status", "failed"),
                started_at=result.get("started_at"),
                duration_seconds=result.get("duration_seconds"),
                drift_score=result.get("drift_score"),
                severity=result.get("severity"),
                alert_sent=result.get("alert_sent", False),
                error=result.get("error"),
                run_metadata=json.dumps({k: v for k, v in result.items()
                                     if k not in ("started_at", "duration_seconds")}),
            )
            db.add(run)
            db.commit()
        except Exception as exc:
            logger.error(f"[Audit] Failed to persist run record: {exc}")
            db.rollback()
        finally:
            db.close()


# ═══════════════════════════════════════════════════════════════════════════
# SNAPSHOT CREATION HELPER
# ═══════════════════════════════════════════════════════════════════════════

def _create_snapshot(db, df: pd.DataFrame, dataset_name: str,
                     run_id: str) -> DriftSnapshot:
    """Persist a new DriftSnapshot from a DataFrame."""
    snap = DriftSnapshot(
        id=str(uuid.uuid4()),
        dataset_name=dataset_name,
        timestamp=datetime.now(timezone.utc),
        row_count=len(df),
        column_count=len(df.columns),
        columns=json.dumps(list(df.columns)),
        status="active",
        source_run_id=run_id,
    )
    db.add(snap)
    db.flush()  # get the id before commit
    return snap


# ═══════════════════════════════════════════════════════════════════════════
# SCHEDULER
# ═══════════════════════════════════════════════════════════════════════════

class ProductionScheduler:
    """
    APScheduler wrapper.
    Manages one recurring job per registered dataset pipeline.
    Also registers a daily retention janitor.
    """

    def __init__(self, redis_client: redis.Redis, cfg: IngestionConfig = INGESTION_CONFIG):
        self._redis   = redis_client
        self._cfg     = cfg
        self._sched   = BackgroundScheduler(timezone="UTC")
        self._pipelines: Dict[str, ProductionIngestionPipeline] = {}

    def register_dataset(
        self,
        dataset_name: str,
        connector: SourceConnector,
        interval_minutes: Optional[int] = None,
    ) -> None:
        pipeline = ProductionIngestionPipeline(
            dataset_name=dataset_name,
            connector=connector,
            redis_client=self._redis,
            cfg=self._cfg,
        )
        self._pipelines[dataset_name] = pipeline

        minutes = interval_minutes or self._cfg.interval_minutes
        self._sched.add_job(
            func=pipeline.run_cycle,
            trigger=IntervalTrigger(minutes=minutes),
            id=f"ingest_{dataset_name}",
            name=f"Ingest {dataset_name}",
            replace_existing=True,
            max_instances=1,   # prevent overlap within one pod
        )
        logger.info(f"[Scheduler] Registered '{dataset_name}' every {minutes} min")

    def start(self) -> None:
        # Daily retention janitor
        self._sched.add_job(
            func=run_retention_policy,
            args=[self._cfg],
            trigger=IntervalTrigger(hours=24),
            id="retention_janitor",
            name="Retention Janitor",
            replace_existing=True,
        )
        self._sched.start()
        logger.info("[Scheduler] Started ✓")

    def stop(self) -> None:
        self._sched.shutdown(wait=False)
        logger.info("[Scheduler] Stopped")

    def trigger_now(self, dataset_name: str) -> Dict:
        """Manually trigger an immediate cycle (for testing / on-demand)."""
        pipeline = self._pipelines.get(dataset_name)
        if not pipeline:
            raise ValueError(f"Dataset '{dataset_name}' not registered")
        return pipeline.run_cycle()

    def update_interval(self, dataset_name: str, interval_minutes: int) -> None:
        job_id = f"ingest_{dataset_name}"
        self._sched.reschedule_job(
            job_id, trigger=IntervalTrigger(minutes=interval_minutes)
        )
        logger.info(f"[Scheduler] '{dataset_name}' interval updated → {interval_minutes} min")

    def list_jobs(self) -> List[Dict]:
        return [
            {
                "id": job.id,
                "name": job.name,
                "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            }
            for job in self._sched.get_jobs()
        ]


# ═══════════════════════════════════════════════════════════════════════════
# FASTAPI ROUTER INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════
# Attach this router to your existing FastAPI app via:
#   app.include_router(production_router, prefix="/production", tags=["production"])
# ═══════════════════════════════════════════════════════════════════════════

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

production_router = APIRouter()

# Module-level scheduler instance (initialized on startup)
_scheduler: Optional[ProductionScheduler] = None

def get_scheduler() -> ProductionScheduler:
    if _scheduler is None:
        raise RuntimeError("Scheduler not initialized. Call init_scheduler() on startup.")
    return _scheduler

def init_scheduler(redis_client: redis.Redis, cfg: IngestionConfig = INGESTION_CONFIG) -> ProductionScheduler:
    global _scheduler
    _scheduler = ProductionScheduler(redis_client, cfg)
    return _scheduler


# ── Pydantic models ────────────────────────────────────────────────────────

class ScheduleDatasetRequest(BaseModel):
    dataset_name: str
    source_type: str          # "database" | "s3" | "api" | "local"
    interval_minutes: int = 10
    # Source-specific parameters
    source_config: Dict[str, Any] = {}


class UpdateIntervalRequest(BaseModel):
    dataset_name: str
    interval_minutes: int


class UpdateConfigRequest(BaseModel):
    interval_minutes: Optional[int]      = None
    comparison_mode: Optional[str]       = None
    rolling_window_size: Optional[int]   = None
    drift_threshold_warning: Optional[float]  = None
    drift_threshold_critical: Optional[float] = None
    persistence_cycles: Optional[int]    = None
    alert_cooldown_minutes: Optional[int]= None
    retention_days: Optional[int]        = None
    schema_strict: Optional[bool]        = None


class SetBaselineRequest(BaseModel):
    dataset_name: str
    snapshot_id: str


# ── Endpoints ──────────────────────────────────────────────────────────────

@production_router.post("/schedule")
def schedule_dataset(req: ScheduleDatasetRequest, background_tasks: BackgroundTasks):
    """Register a dataset for automated monitoring."""
    sched = get_scheduler()

    # Build the appropriate connector
    cfg = req.source_config
    if req.source_type == "database":
        connector = DatabaseConnector(dsn=cfg["dsn"], query=cfg["query"],
                                      params=cfg.get("params"))
    elif req.source_type == "s3":
        connector = S3Connector(bucket=cfg["bucket"], prefix=cfg["prefix"],
                                file_format=cfg.get("format", "csv"))
    elif req.source_type == "api":
        connector = APIConnector(url=cfg["url"], headers=cfg.get("headers"),
                                 params=cfg.get("params"),
                                 record_path=cfg.get("record_path"))
    elif req.source_type == "local":
        connector = LocalFolderConnector(folder_path=cfg["folder_path"],
                                         pattern=cfg.get("pattern", "*.csv"))
    else:
        raise HTTPException(status_code=400,
                            detail=f"Unknown source_type: {req.source_type}")

    sched.register_dataset(req.dataset_name, connector, req.interval_minutes)
    # Run first cycle immediately in background
    background_tasks.add_task(sched.trigger_now, req.dataset_name)

    return {"message": f"Dataset '{req.dataset_name}' scheduled every {req.interval_minutes} min",
            "first_run": "triggered in background"}


@production_router.post("/trigger/{dataset_name}")
def trigger_now(dataset_name: str):
    """Manually trigger an immediate ingestion cycle."""
    sched = get_scheduler()
    result = sched.trigger_now(dataset_name)
    return result


@production_router.get("/jobs")
def list_jobs():
    """List all scheduled jobs and their next run times."""
    return get_scheduler().list_jobs()


@production_router.patch("/interval")
def update_interval(req: UpdateIntervalRequest):
    """Dynamically change the polling interval for a dataset."""
    get_scheduler().update_interval(req.dataset_name, req.interval_minutes)
    return {"message": f"'{req.dataset_name}' interval → {req.interval_minutes} min"}


@production_router.patch("/config")
def update_config(req: UpdateConfigRequest):
    """Hot-update pipeline configuration without restart."""
    cfg = INGESTION_CONFIG
    if req.interval_minutes is not None:
        cfg.interval_minutes = req.interval_minutes
    if req.comparison_mode is not None:
        if req.comparison_mode not in ("last_snapshot", "baseline", "rolling_window"):
            raise HTTPException(status_code=400, detail="Invalid comparison_mode")
        cfg.comparison_mode = req.comparison_mode
    if req.rolling_window_size is not None:
        cfg.rolling_window_size = req.rolling_window_size
    if req.drift_threshold_warning is not None:
        cfg.drift_threshold_warning = req.drift_threshold_warning
    if req.drift_threshold_critical is not None:
        cfg.drift_threshold_critical = req.drift_threshold_critical
    if req.persistence_cycles is not None:
        cfg.persistence_cycles = req.persistence_cycles
    if req.alert_cooldown_minutes is not None:
        cfg.alert_cooldown_minutes = req.alert_cooldown_minutes
    if req.retention_days is not None:
        cfg.retention_days = req.retention_days
    if req.schema_strict is not None:
        cfg.schema_strict = req.schema_strict
    return {"message": "Config updated", "config": cfg.__dict__}


@production_router.get("/config")
def get_config():
    """Return current pipeline configuration."""
    cfg = INGESTION_CONFIG
    return {k: v for k, v in cfg.__dict__.items() if not k.startswith("_")}


@production_router.post("/baseline")
def set_baseline(req: SetBaselineRequest, redis_client: redis.Redis = None):
    """Pin a snapshot as the production baseline for a dataset."""
    # redis_client should be injected via FastAPI dependency
    mgr = BaselineManager(redis_client)
    mgr.set_baseline(req.dataset_name, req.snapshot_id)
    return {"message": f"Baseline set for '{req.dataset_name}' → snapshot {req.snapshot_id}"}


@production_router.get("/ingestion-runs")
def get_ingestion_runs(dataset_name: Optional[str] = None, limit: int = 50):
    """Return recent ingestion run audit records."""
    db = SessionLocal()
    try:
        q = db.query(IngestionRun).order_by(IngestionRun.started_at.desc())
        if dataset_name:
            q = q.filter(IngestionRun.dataset_name == dataset_name)
        runs = q.limit(limit).all()
        return [
            {
                "id": r.id,
                "dataset": r.dataset_name,
                "status": r.status,
                "started_at": r.started_at,
                "duration_s": r.duration_seconds,
                "drift_score": r.drift_score,
                "severity": r.severity,
                "alert_sent": r.alert_sent,
                "error": r.error,
            }
            for r in runs
        ]
    finally:
        db.close()


@production_router.get("/pipeline-health")
def pipeline_health():
    """
    Quick health summary: last run status per dataset,
    consecutive drift counters, scheduler job states.
    """
    sched = get_scheduler()
    jobs  = sched.list_jobs()
    db    = SessionLocal()
    try:
        # Last run per dataset
        from sqlalchemy import func
        subq = (
            db.query(
                IngestionRun.dataset_name,
                func.max(IngestionRun.started_at).label("latest"),
            )
            .group_by(IngestionRun.dataset_name)
            .subquery()
        )
        last_runs = (
            db.query(IngestionRun)
            .join(subq, (IngestionRun.dataset_name == subq.c.dataset_name) &
                        (IngestionRun.started_at == subq.c.latest))
            .all()
        )

        dataset_health = {
            r.dataset_name: {
                "last_run_status": r.status,
                "last_run_at": r.started_at,
                "last_drift_score": r.drift_score,
                "last_severity": r.severity,
                "last_alert_sent": r.alert_sent,
                "last_error": r.error,
            }
            for r in last_runs
        }
    finally:
        db.close()

    return {
        "scheduler_jobs": jobs,
        "dataset_health": dataset_health,
        "config": {k: v for k, v in INGESTION_CONFIG.__dict__.items()
                   if not k.startswith("_")},
    }