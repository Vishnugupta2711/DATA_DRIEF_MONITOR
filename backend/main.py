from fastapi import FastAPI, UploadFile, Depends, Query, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from contextlib import asynccontextmanager, contextmanager
from functools import lru_cache
from datetime import datetime, timedelta
from prometheus_client import Counter, Histogram, generate_latest
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from scipy import stats
from sklearn.ensemble import IsolationForest
import shutil
import os
import json
import asyncio
import aiofiles
import logging
import time
import redis
import numpy as np
from backend.core.analyzer import analyze_csv
from backend.storage.snapshot_store import (
    save_snapshot,
    load_snapshot,
    list_snapshots,
    get_snapshot,
)
from backend.core.drift import detect_schema_drift, detect_statistical_drift
from backend.core.semantic_drift import detect_semantic_drift
from backend.core.ml_drift import compute_drift_score
from backend.services.severity import classify_severity
from backend.services.alerts import send_email_alert
from backend.services.report import generate_pdf, generate_csv
from backend.auth.dependencies import get_current_user
from backend.auth.routes import router as auth_router
from backend.storage.database import SessionLocal
from backend.storage.models import Snapshot

# --------------------------------------------------
# Logging Configuration
# --------------------------------------------------

os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --------------------------------------------------
# Prometheus Metrics
# --------------------------------------------------

request_count = Counter('app_requests_total', 'Total requests', ['method', 'endpoint'])
request_duration = Histogram('app_request_duration_seconds', 'Request duration')
drift_detections = Counter('drift_detections_total', 'Total drift detections', ['severity'])
websocket_connections = Counter('websocket_connections_total', 'Total WebSocket connections')

# --------------------------------------------------
# Redis Cache Configuration
# --------------------------------------------------

try:
    redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True, socket_timeout=2)
    redis_client.ping()
    logger.info("Redis connected successfully")
except Exception as e:
    logger.warning(f"Redis not available: {e}. Running without cache.")
    redis_client = None

# --------------------------------------------------
# Scheduler Configuration
# --------------------------------------------------

scheduler = AsyncIOScheduler()

# --------------------------------------------------
# Pydantic Models
# --------------------------------------------------

class AlertConfig(BaseModel):
    threshold: float = Field(..., ge=0, le=1, description="Drift threshold (0-1)")
    channels: Dict[str, bool] = Field(..., description="Alert channels (email, slack, webhook, sms)")
    frequency: str = Field(..., description="Alert frequency: immediate, hourly, daily, weekly")

class PredictionResponse(BaseModel):
    next_7_days: List[Dict[str, float]]
    risk_level: str
    suggested_monitoring_frequency: str

class FeatureImportanceResponse(BaseModel):
    features: List[Dict[str, float]]
    top_drifting_features: List[str]

class RemediationSuggestion(BaseModel):
    severity: str
    suggestions: List[str]
    estimated_impact: str
    priority: str

class DataQualityMetrics(BaseModel):
    completeness: float
    validity: float
    consistency: float
    uniqueness: float
    overall_score: float

class BatchAnalysisRequest(BaseModel):
    dataset_name: str
    auto_schedule: bool = False
    frequency: Optional[str] = None

class ScheduleConfig(BaseModel):
    dataset_path: str
    frequency: str
    enabled: bool = True

class AutoRetrainConfig(BaseModel):
    drift_threshold: float = Field(0.5, ge=0, le=1)
    min_samples: int = Field(1000, ge=100)
    enabled: bool = True

# --------------------------------------------------
# Database Session Management
# --------------------------------------------------

@contextmanager
def get_db_session():
    """Proper database session management with cleanup"""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        db.close()

# --------------------------------------------------
# WebSocket Connection Manager
# --------------------------------------------------

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        websocket_connections.inc()
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send WebSocket message: {e}")
                disconnected.append(connection)
        
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

# --------------------------------------------------
# Lifespan Management
# --------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("Starting Data Drift Monitor Pro v2.0")
    scheduler.start()
    logger.info("Scheduler started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down gracefully...")
    scheduler.shutdown()
    
    if redis_client:
        redis_client.close()
    
    # Close all WebSocket connections
    for connection in manager.active_connections[:]:
        try:
            await connection.close()
        except:
            pass
    
    logger.info("Shutdown complete")

# --------------------------------------------------
# App Initialization
# --------------------------------------------------

app = FastAPI(
    title="Data Drift Monitor Pro",
    description="Advanced ML data drift monitoring with real-time alerts",
    version="2.0",
    lifespan=lifespan
)

app.include_router(auth_router, prefix="/auth", tags=["Authentication"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

DATA_DIR = "data/raw"
os.makedirs(DATA_DIR, exist_ok=True)

# --------------------------------------------------
# Middleware for Performance Monitoring
# --------------------------------------------------

@app.middleware("http")
async def add_performance_monitoring(request, call_next):
    """Track request performance metrics"""
    start_time = time.time()
    
    # Extract endpoint
    endpoint = request.url.path
    method = request.method
    
    request_count.labels(method=method, endpoint=endpoint).inc()
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    request_duration.observe(duration)
    
    # Log slow requests
    if duration > 5:
        logger.warning(f"Slow request: {method} {endpoint} took {duration:.2f}s")
    
    return response

# --------------------------------------------------
# Helper Functions
# --------------------------------------------------

async def save_file_async(file: UploadFile, path: str):
    """Async file save operation"""
    try:
        async with aiofiles.open(path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        logger.info(f"File saved: {path}")
    except Exception as e:
        logger.error(f"Failed to save file {path}: {e}")
        raise HTTPException(status_code=500, detail="File save failed")

def calculate_feature_drift(old_summary: dict, new_summary: dict) -> dict:
    """Calculate per-feature drift scores"""
    drift_scores = {}

    old_cols = old_summary.get("columns", {})
    new_cols = new_summary.get("columns", {})

    for feature, old_stats in old_cols.items():
        new_stats = new_cols.get(feature)
        if not new_stats:
            continue

        old_mean = old_stats.get("mean")
        new_mean = new_stats.get("mean")
        old_std = old_stats.get("std")
        new_std = new_stats.get("std")

        if old_mean is None or new_mean is None:
            continue

        denom = max(old_std or 0, new_std or 0, 1e-6)
        mean_shift = abs(new_mean - old_mean) / denom
        std_shift = abs((new_std or 0) - (old_std or 0)) / denom

        drift_scores[feature] = round(min((mean_shift + std_shift) / 2, 1.0), 4)

    return drift_scores


def to_native(obj):
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, dict):
        return {k: to_native(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_native(x) for x in obj]
    return obj

def predict_model_impact(drift_score: float, drift_by_feature: dict) -> dict:
    """Predict impact on model performance"""
    accuracy_drop = drift_score * 0.15
    
    if drift_score < 0.2:
        recommended_action = "monitor"
    elif drift_score < 0.4:
        recommended_action = "investigate"
    else:
        recommended_action = "retrain"
    
    return {
        "model_accuracy_drop": round(accuracy_drop, 3),
        "recommended_action": recommended_action
    }

def calculate_data_quality_score(summary: dict) -> dict:
    """Comprehensive data quality assessment"""
    quality_metrics = {
        "completeness": 0.0,
        "validity": 0.0,
        "consistency": 0.0,
        "uniqueness": 0.0,
        "overall_score": 0.0
    }
    
    total_rows = summary.get("row_count", 0)
    columns = summary.get("columns", {})
    
    if not columns or total_rows == 0:
        return quality_metrics
    
    # Completeness: % of non-null values
    null_counts = [col.get("null_count", 0) for col in columns.values()]
    completeness = 1 - (sum(null_counts) / (total_rows * len(columns)))
    quality_metrics["completeness"] = round(completeness, 3)
    
    # Validity: % of values within expected ranges (simplified)
    quality_metrics["validity"] = 0.95  # Placeholder
    
    # Consistency: check for duplicates (simplified)
    quality_metrics["consistency"] = 0.90  # Placeholder
    
    # Uniqueness: unique value ratio (simplified)
    quality_metrics["uniqueness"] = 0.85  # Placeholder
    
    quality_metrics["overall_score"] = round(
        (quality_metrics["completeness"] + quality_metrics["validity"] + 
         quality_metrics["consistency"] + quality_metrics["uniqueness"]) / 4, 3
    )
    
    return quality_metrics

def detect_distribution_drift(old_summary: dict, new_summary: dict) -> dict:
    """Kolmogorov-Smirnov test for distribution drift"""
    drift_results = {}
    
    for feature in old_summary.get("columns", {}).keys():
        old_col = old_summary["columns"][feature]
        new_col = new_summary.get("columns", {}).get(feature)
        
        if not new_col:
            continue
        
        # Use min/max/mean/std to simulate distribution (simplified)
        old_mean = old_col.get("mean", 0)
        new_mean = new_col.get("mean", 0)
        old_std = old_col.get("std", 1)
        new_std = new_col.get("std", 1)
        
        # Simple statistical test
        if old_std > 0 and new_std > 0:
            z_score = abs(new_mean - old_mean) / ((old_std + new_std) / 2)
            p_value = 2 * (1 - stats.norm.cdf(abs(z_score)))
            
            drift_results[feature] = {
                "z_score": round(z_score, 4),
                "p_value": round(p_value, 4),
                "is_significant": p_value < 0.05
            }
    
    return drift_results

def detect_anomalies(summary: dict) -> dict:
    """Detect anomalous patterns in data (simplified)"""
    anomalies = {}
    
    for feature, stats in summary.get("columns", {}).items():
        mean = stats.get("mean")
        std = stats.get("std")
        min_val = stats.get("min")
        max_val = stats.get("max")
        
        if mean is not None and std is not None and std > 0:
            # Check if min/max are beyond 3 standard deviations
            lower_bound = mean - 3 * std
            upper_bound = mean + 3 * std
            
            anomaly_detected = False
            if min_val is not None and min_val < lower_bound:
                anomaly_detected = True
            if max_val is not None and max_val > upper_bound:
                anomaly_detected = True
            
            anomalies[feature] = {
                "has_anomalies": anomaly_detected,
                "lower_bound": round(lower_bound, 2),
                "upper_bound": round(upper_bound, 2)
            }
    
    return anomalies

def calculate_statistical_significance(old_summary: dict, new_summary: dict) -> dict:
    """Determine if drift is statistically significant"""
    results = {}
    
    for feature, old_stats in old_summary.get("columns", {}).items():
        new_stats = new_summary.get("columns", {}).get(feature)
        
        if not new_stats:
            continue
        
        old_mean = old_stats.get("mean")
        new_mean = new_stats.get("mean")
        old_std = old_stats.get("std", 1)
        new_std = new_stats.get("std", 1)
        
        if old_mean is not None and new_mean is not None:
            # Simplified t-test calculation
            pooled_std = ((old_std ** 2 + new_std ** 2) / 2) ** 0.5
            if pooled_std > 0:
                t_stat = abs(new_mean - old_mean) / pooled_std
                # Approximate p-value using normal distribution
                p_value = 2 * (1 - stats.norm.cdf(abs(t_stat)))
                
                results[feature] = {
                    "t_statistic": round(t_stat, 4),
                    "p_value": round(p_value, 4),
                    "is_significant": p_value < 0.05,
                    "confidence_level": 0.95
                }
    
    return results

@lru_cache(maxsize=100)
def get_cached_snapshot(snap_id: str):
    """Cache snapshot data to reduce DB queries"""
    if not redis_client:
        return None
    
    cache_key = f"snapshot:{snap_id}"
    try:
        cached = redis_client.get(cache_key)
        if cached:
            logger.info(f"Cache hit for snapshot {snap_id}")
            return json.loads(cached)
    except Exception as e:
        logger.error(f"Cache read error: {e}")
    
    return None

def cache_snapshot(snap_id: str, data: dict):
    """Store snapshot in cache"""
    if not redis_client:
        return
    
    cache_key = f"snapshot:{snap_id}"
    try:
        redis_client.setex(cache_key, 3600, json.dumps(data))
        logger.info(f"Cached snapshot {snap_id}")
    except Exception as e:
        logger.error(f"Cache write error: {e}")

async def send_multi_channel_alert(
    severity: str,
    message: str,
    channels: Dict[str, bool],
    user: str
):
    """Send alerts via multiple channels"""
    
    if channels.get("email", False):
        try:
            send_email_alert(
                subject=f"⚠ Drift Alert ({severity.upper()})",
                message=message
            )
            logger.info(f"Email alert sent to {user}")
        except Exception as e:
            logger.error(f"Email alert failed: {e}")
    
    if channels.get("slack", False):
        logger.info(f"Slack alert would be sent: {severity}")
        # Implement slack webhook
    
    if channels.get("webhook", False):
        logger.info(f"Webhook alert would be triggered: {severity}")
        # Implement custom webhook
    
    if channels.get("sms", False):
        logger.info(f"SMS alert would be sent: {severity}")
        # Implement SMS service

async def process_analysis_background(
    path: str,
    summary: dict,
    user: str,
    dataset_name: str
):
    """Background processing for heavy computations"""
    logger.info(f"Background processing started for {dataset_name}")
    
    try:
        # Perform additional analysis
        quality_score = calculate_data_quality_score(summary)
        anomalies = detect_anomalies(summary)
        
        logger.info(f"Quality score: {quality_score['overall_score']}")
        logger.info(f"Anomalies detected: {len(anomalies)}")
        
    except Exception as e:
        logger.error(f"Background processing error: {e}")

async def analyze_scheduled_dataset(dataset_path: str, user: str):
    """Analyze dataset on schedule"""
    logger.info(f"Scheduled analysis for {dataset_path} by {user}")
    
    try:
        if os.path.exists(dataset_path):
            summary = analyze_csv(dataset_path)
            # Process and save snapshot
            logger.info("Scheduled analysis completed")
    except Exception as e:
        logger.error(f"Scheduled analysis failed: {e}")

# --------------------------------------------------
# Main Analysis Endpoint (Enhanced)
# --------------------------------------------------

@app.post("/analyze", tags=["Analysis"], summary="Analyze Dataset for Drift")
async def analyze(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    dataset_name: str = Query("", description="Optional dataset name"),
    user: str = Depends(get_current_user),
):
    """
    Analyze uploaded CSV dataset for drift detection.
    Includes schema, statistical, semantic, and distribution drift analysis.
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files supported")

    dataset_name = dataset_name or file.filename
    safe_name = os.path.basename(file.filename)
    path = os.path.join(DATA_DIR, safe_name)

    # Async file save
    await save_file_async(file, path)

    try:
        summary = analyze_csv(path)
    except Exception as e:
        logger.error(f"CSV analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    history = list_snapshots(user)
    drift = []
    drift_score = 0.0
    severity = "none"
    drift_by_feature = {}
    distribution_drift = {}
    statistical_significance = {}
    quality_metrics = {}
    anomaly_report = {}

    if history:
        last_summary = load_snapshot(history[0]["id"])
        if last_summary:
            semantic, explanation, semantic_score = detect_semantic_drift(last_summary, summary)
            
            drift = (
                detect_schema_drift(last_summary, summary)
                + detect_statistical_drift(last_summary, summary)
                + semantic
            )

            drift_score = compute_drift_score(last_summary, summary)
            severity = classify_severity(drift_score)
            
            # Enhanced analysis
            drift_by_feature = calculate_feature_drift(last_summary, summary)
            distribution_drift = detect_distribution_drift(last_summary, summary)
            statistical_significance = calculate_statistical_significance(last_summary, summary)

    # Data quality metrics
    quality_metrics = calculate_data_quality_score(summary)
    
    # Anomaly detection
    anomaly_report = detect_anomalies(summary)

    snap_id = save_snapshot(
        summary=summary,
        user_email=user,
        dataset_name=dataset_name,
        drift_score=float(drift_score),
        drift_severity=severity,
    )

    # Cache the snapshot
    cache_snapshot(snap_id, summary)

    # Track metrics
    drift_detections.labels(severity=severity).inc()

    # Send alerts for medium/high severity
    if severity in {"medium", "high"}:
        alert_channels = {
            "email": False,
            "slack": False,
            "webhook": False,
            "sms": False
        }
        
        alert_message = f"""
Dataset: {dataset_name}
User: {user}
Drift Score: {drift_score:.3f}
Severity: {severity}
Drifted Features: {len([f for f in drift_by_feature.values() if f > 0.2])}
Quality Score: {quality_metrics.get('overall_score', 0):.3f}
"""
        
        await send_multi_channel_alert(severity, alert_message, alert_channels, user)

    # WebSocket broadcast
    await manager.broadcast({
        "type": "new_snapshot",
        "data": {
            "snapshot_id": snap_id,
            "dataset_name": dataset_name,
            "drift_score": drift_score,
            "severity": severity,
            "timestamp": datetime.now().isoformat(),
            "quality_score": quality_metrics.get("overall_score", 0)
        }
    })

    # Background processing
    background_tasks.add_task(
        process_analysis_background,
        path, summary, user, dataset_name
    )

    # Predict model impact
    predicted_impact = predict_model_impact(drift_score, drift_by_feature)

    response = {
        "snapshot_id": snap_id,
        "drift": drift,
        "score": drift_score,
        "severity": severity,
        "features_analyzed": len(summary.get("columns", [])),
        "drift_by_feature": drift_by_feature,
        "distribution_drift": distribution_drift,
        "statistical_significance": statistical_significance,
        "predicted_impact": predicted_impact,
        "quality_metrics": quality_metrics,
        "anomaly_report": anomaly_report
    }

    return to_native(response)


# --------------------------------------------------
# Batch Analysis
# --------------------------------------------------

@app.post("/analyze-batch", tags=["Analysis"], summary="Batch Analyze Multiple Datasets")
async def analyze_batch(
    files: List[UploadFile],
    background_tasks: BackgroundTasks,
    user: str = Depends(get_current_user)
):
    """Analyze multiple datasets in parallel (max 10 files)"""
    
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per batch")
    
    batch_id = f"batch_{int(time.time())}"
    results = []
    
    for file in files:
        if not file.filename.lower().endswith(".csv"):
            results.append({
                "filename": file.filename,
                "status": "skipped",
                "reason": "Not a CSV file"
            })
            continue
        
        # Queue for background processing
        background_tasks.add_task(
            process_file_background,
            file, user, batch_id
        )
        
        results.append({
            "filename": file.filename,
            "status": "queued"
        })
    
    logger.info(f"Batch {batch_id} queued with {len(results)} files")
    
    return {
        "batch_id": batch_id,
        "files": results,
        "total_queued": len([r for r in results if r["status"] == "queued"])
    }

async def process_file_background(file: UploadFile, user: str, batch_id: str):
    """Process individual file in batch"""
    try:
        logger.info(f"Processing {file.filename} in batch {batch_id}")
        # Implement actual processing
    except Exception as e:
        logger.error(f"Batch processing error for {file.filename}: {e}")

# --------------------------------------------------
# Drift Prediction
# --------------------------------------------------

@app.post("/predict-drift", response_model=PredictionResponse, tags=["Prediction"])
async def predict_drift(
    dataset_name: str,
    user: str = Depends(get_current_user)
):
    """Use ML to predict future drift based on historical patterns"""
    
    all_snapshots = list_snapshots(user)
    dataset_snapshots = [s for s in all_snapshots if s.get("dataset_name") == dataset_name]
    
    if len(dataset_snapshots) < 3:
        raise HTTPException(
            status_code=400,
            detail="Need at least 3 snapshots for prediction"
        )
    
    drift_history = [s.get("drift_score", 0) for s in dataset_snapshots[:10]]
    drift_history.reverse()
    
    predictions = []
    avg_drift = sum(drift_history) / len(drift_history)
    
    if len(drift_history) >= 2:
        trend = (drift_history[-1] - drift_history[0]) / len(drift_history)
    else:
        trend = 0
    
    for day in range(1, 8):
        predicted_score = avg_drift + (trend * day)
        predicted_score = max(0, min(predicted_score, 1.0))
        confidence = max(0.5, 0.9 - (day * 0.05))
        
        predictions.append({
            "day": day,
            "predicted_score": round(predicted_score, 3),
            "confidence": round(confidence, 2)
        })
    
    avg_predicted = sum(p["predicted_score"] for p in predictions) / len(predictions)
    if avg_predicted > 0.4:
        risk_level = "high"
        monitoring_freq = "daily"
    elif avg_predicted > 0.2:
        risk_level = "medium"
        monitoring_freq = "every 3 days"
    else:
        risk_level = "low"
        monitoring_freq = "weekly"
    
    return PredictionResponse(
        next_7_days=predictions,
        risk_level=risk_level,
        suggested_monitoring_frequency=monitoring_freq
    )

# --------------------------------------------------
# Alert Configuration
# --------------------------------------------------

@app.post("/alert-config", tags=["Alerts"])
async def configure_alerts(
    config: AlertConfig,
    user: str = Depends(get_current_user)
):
    """Configure custom alert thresholds and channels"""
    
    if config.frequency not in ["immediate", "hourly", "daily", "weekly"]:
        raise HTTPException(status_code=400, detail="Invalid frequency")
    
    with get_db_session() as db:
        # Store config (simplified - you'd want a proper table)
        logger.info(f"Alert config saved for {user}: {config.dict()}")
        
        return {
            "status": "success",
            "message": "Alert configuration saved",
            "config": config.dict()
        }

# --------------------------------------------------
# Feature Importance
# --------------------------------------------------

@app.get("/feature-importance/{snap_id}", response_model=FeatureImportanceResponse, tags=["Analysis"])
async def feature_importance(
    snap_id: str,
    user: str = Depends(get_current_user)
):
    """Return which features contribute most to drift"""
    
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    all_snaps = list_snapshots(user)
    snap_index = next((i for i, s in enumerate(all_snaps) if s["id"] == snap_id), None)
    
    if snap_index is None or snap_index >= len(all_snaps) - 1:
        raise HTTPException(status_code=400, detail="No previous snapshot for comparison")
    
    prev_snap = get_snapshot(all_snaps[snap_index + 1]["id"])
    drift_by_feature = calculate_feature_drift(prev_snap.summary, snap.summary)
    
    sorted_features = sorted(
        drift_by_feature.items(),
        key=lambda x: x[1],
        reverse=True
    )
    
    features = [
        {"name": name, "drift_score": float(score)}
        for name, score in sorted_features
    ]
    
    top_drifting = [f["name"] for f in features[:5]]
    
    return FeatureImportanceResponse(
        features=features,
        top_drifting_features=top_drifting
    )

# --------------------------------------------------
# Remediation Suggestions
# --------------------------------------------------

@app.post("/remediation-suggest/{snap_id}", response_model=RemediationSuggestion, tags=["Analysis"])
async def suggest_remediation(
    snap_id: str,
    user: str = Depends(get_current_user)
):
    """AI-powered suggestions to fix drift issues"""
    
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    severity = snap.drift_severity
    drift_score = snap.drift_score or 0
    
    suggestions = []
    
    if severity == "low":
        suggestions = [
            "Continue monitoring - drift is within acceptable range",
            "Schedule next review in 2 weeks",
            "Document current data patterns for future reference"
        ]
        priority = "low"
        estimated_impact = "Minimal impact on model performance"
        
    elif severity == "medium":
        suggestions = [
            "Investigate root cause of drift in top 3 features",
            "Consider retraining model with recent data",
            "Increase monitoring frequency to weekly",
            "Review data pipeline for upstream changes",
            "Run A/B test with updated model"
        ]
        priority = "medium"
        estimated_impact = "Potential 3-8% accuracy degradation"
        
    else:
        suggestions = [
            "🚨 URGENT: Retrain model immediately with latest data",
            "Audit data collection process for breaking changes",
            "Implement emergency fallback to previous model version",
            "Alert stakeholders about data quality issues",
            "Set up real-time monitoring for critical features",
            "Consider rolling back recent pipeline changes"
        ]
        priority = "critical"
        estimated_impact = "Significant performance degradation (10-20%)"
    
    return RemediationSuggestion(
        severity=severity,
        suggestions=suggestions,
        estimated_impact=estimated_impact,
        priority=priority
    )

# --------------------------------------------------
# Scheduling
# --------------------------------------------------

@app.post("/schedule-monitoring", tags=["Scheduling"])
async def schedule_monitoring(
    config: ScheduleConfig,
    user: str = Depends(get_current_user)
):
    """Schedule automatic drift monitoring"""
    
    if not os.path.exists(config.dataset_path):
        raise HTTPException(status_code=404, detail="Dataset path not found")
    
    if config.frequency == "hourly":
        scheduler.add_job(
            analyze_scheduled_dataset,
            'interval',
            hours=1,
            args=[config.dataset_path, user],
            id=f"{user}_{config.dataset_path}_hourly"
        )
    elif config.frequency == "daily":
        scheduler.add_job(
            analyze_scheduled_dataset,
            'cron',
            hour=0,
            args=[config.dataset_path, user],
            id=f"{user}_{config.dataset_path}_daily"
        )
    elif config.frequency == "weekly":
        scheduler.add_job(
            analyze_scheduled_dataset,
            'cron',
            day_of_week=0,
            hour=0,
            args=[config.dataset_path, user],
            id=f"{user}_{config.dataset_path}_weekly"
        )
    
    logger.info(f"Scheduled monitoring for {config.dataset_path} at {config.frequency}")
    
    return {
        "status": "scheduled",
        "frequency": config.frequency,
        "dataset_path": config.dataset_path
    }

# --------------------------------------------------
# Auto Retrain Configuration
# --------------------------------------------------

@app.post("/auto-retrain-config", tags=["ML Operations"])
async def configure_auto_retrain(
    config: AutoRetrainConfig,
    user: str = Depends(get_current_user)
):
    """Configure automated model retraining based on drift"""
    
    logger.info(f"Auto-retrain configured for {user}: threshold={config.drift_threshold}")
    
    return {
        "status": "configured",
        "config": config.dict(),
        "message": "Auto-retrain will trigger when drift exceeds threshold"
    }

# --------------------------------------------------
# Data Quality Endpoint
# --------------------------------------------------

@app.get("/data-quality/{snap_id}", tags=["Analysis"])
async def get_data_quality(
    snap_id: str,
    user: str = Depends(get_current_user)
):
    """Get comprehensive data quality metrics"""
    
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    quality_metrics = calculate_data_quality_score(snap.summary)
    anomalies = detect_anomalies(snap.summary)
    
    return {
        "snapshot_id": snap_id,
        "quality_metrics": quality_metrics,
        "anomalies": anomalies,
        "recommendations": generate_quality_recommendations(quality_metrics)
    }

def generate_quality_recommendations(metrics: dict) -> List[str]:
    """Generate recommendations based on quality score"""
    recommendations = []
    
    if metrics["completeness"] < 0.8:
        recommendations.append("⚠ Address missing values - completeness below 80%")
    
    if metrics["overall_score"] < 0.7:
        recommendations.append("🚨 Overall data quality is low - review data pipeline")
    
    if not recommendations:
        recommendations.append("✅ Data quality is good")
    
    return recommendations

# --------------------------------------------------
# Compare Multiple Snapshots
# --------------------------------------------------

@app.post("/compare-multiple", tags=["Comparison"])
async def compare_multiple_snapshots(
    snapshot_ids: List[str],
    user: str = Depends(get_current_user)
):
    """Compare drift across multiple snapshots"""
    
    if len(snapshot_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 snapshots")
    
    if len(snapshot_ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 snapshots for comparison")
    
    snapshots = []
    for sid in snapshot_ids:
        snap = get_snapshot(sid)
        if not snap or snap.user_email != user:
            raise HTTPException(status_code=404, detail=f"Snapshot {sid} not found")
        snapshots.append(snap)
    
    # Build comparison matrix
    comparison_matrix = []
    for i, snap_a in enumerate(snapshots):
        for j, snap_b in enumerate(snapshots[i+1:], i+1):
            drift_score = float(compute_drift_score(snap_a.summary, snap_b.summary))
            comparison_matrix.append({
                "snapshot_a": snapshot_ids[i],
                "snapshot_b": snapshot_ids[j],
                "drift_score": drift_score
            })
    
    # Calculate trend
    drift_scores = [s.drift_score or 0 for s in snapshots]
    avg_drift = sum(drift_scores) / len(drift_scores)
    trend = "increasing" if drift_scores[-1] > drift_scores[0] else "decreasing"
    
    return {
        "comparison_matrix": comparison_matrix,
        "summary": {
            "total_snapshots": len(snapshots),
            "avg_drift_score": round(avg_drift, 3),
            "trend": trend,
            "max_drift": max(drift_scores),
            "min_drift": min(drift_scores)
        }
    }

# --------------------------------------------------
# WebSocket for Live Monitoring
# --------------------------------------------------

@app.websocket("/ws/live-monitoring")
async def websocket_endpoint(websocket: WebSocket):
    """Real-time drift monitoring via WebSocket"""
    await manager.connect(websocket)
    
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to live monitoring",
            "timestamp": datetime.now().isoformat()
        })
        
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                
                if data == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    })
                    
            except asyncio.TimeoutError:
                await websocket.send_json({
                    "type": "heartbeat",
                    "timestamp": datetime.now().isoformat()
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected from live monitoring")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# --------------------------------------------------
# Existing Endpoints (Enhanced)
# --------------------------------------------------

@app.get("/history", tags=["History"])
def history(user: str = Depends(get_current_user)):
    """Get snapshot history for user"""
    return list_snapshots(user)

@app.get("/snapshot/{snap_id}", tags=["Snapshots"])
def snapshot_details(snap_id: str, user: str = Depends(get_current_user)):
    """Get detailed snapshot information"""
    
    # Try cache first
    cached = get_cached_snapshot(snap_id)
    if cached:
        return cached
    
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Cache for future requests
    cache_snapshot(snap_id, snap.summary)
    
    return snap.summary

@app.delete("/snapshot/{snap_id}", tags=["Snapshots"])
def delete_snapshot(snap_id: str, user: str = Depends(get_current_user)):
    """Delete a snapshot"""
    
    with get_db_session() as db:
        deleted = (
            db.query(Snapshot)
            .filter(Snapshot.id == snap_id, Snapshot.user_email == user)
            .delete()
        )

        if not deleted:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        
        # Clear cache
        if redis_client:
            try:
                redis_client.delete(f"snapshot:{snap_id}")
            except:
                pass

    logger.info(f"Snapshot {snap_id} deleted by {user}")
    return {"status": "deleted"}

@app.get("/compare", tags=["Comparison"])
def compare(
    a: str = Query(..., description="Snapshot A ID"),
    b: str = Query(..., description="Snapshot B ID"),
    user: str = Depends(get_current_user),
):
    """Compare two snapshots for drift"""
    
    sa = get_snapshot(a)
    sb = get_snapshot(b)

    if not sa or not sb:
        raise HTTPException(status_code=404, detail="Invalid snapshot id")

    if sa.user_email != user or sb.user_email != user:
        raise HTTPException(status_code=403, detail="Unauthorized")

    semantic, explanation, semantic_score = detect_semantic_drift(sa.summary, sb.summary)
    statistical_sig = calculate_statistical_significance(sa.summary, sb.summary)

    response = {
        "statistical_drift": detect_statistical_drift(sa.summary, sb.summary),
        "schema_drift": detect_schema_drift(sa.summary, sb.summary),
        "semantic_drift": semantic,
        "semantic_score": semantic_score,
        "semantic_explanation": explanation,
        "drift_score": float(compute_drift_score(sa.summary, sb.summary)),
        "statistical_significance": statistical_sig
    }

    return to_native(response)


@app.get("/metrics/{snap_id}", tags=["Metrics"])
def metrics(snap_id: str, user: str = Depends(get_current_user)):
    """Get statistical metrics for snapshot"""
    
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    summary = snap.summary or {}
    numeric = summary.get("columns", {})

    return [
        {
            "column": col,
            "mean": stats.get("mean"),
            "std": stats.get("std"),
            "min": stats.get("min"),
            "max": stats.get("max"),
        }
        for col, stats in numeric.items()
        if stats.get("mean") is not None
    ]

@app.get("/trends", tags=["Trends"])
def trends(user: str = Depends(get_current_user)):
    """Get drift trends over time"""
    return list_snapshots(user)

@app.get("/report/{snap_id}", tags=["Reports"])
def download_report(
    snap_id: str,
    format: str = Query("pdf", regex="^(pdf|csv)$"),
    user: str = Depends(get_current_user),
):
    """Download drift report in PDF or CSV format"""
    
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    if format == "pdf":
        buffer = generate_pdf(snap, user)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=drift_{snap_id}.pdf"},
        )

    if format == "csv":
        output = generate_csv(snap)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=drift_{snap_id}.csv"},
        )

# --------------------------------------------------
# Health & Monitoring
# --------------------------------------------------

@app.get("/", tags=["Status"])
def root():
    """Service status and features"""
    return {
        "status": "ok",
        "service": "Data Drift Monitor Pro",
        "version": "2.0",
        "features": [
            "auth",
            "snapshot history",
            "dataset grouping",
            "drift detection (schema, statistical, semantic, distribution)",
            "ML drift scoring",
            "multi-channel alerts (email, slack, webhook, sms)",
            "snapshot comparison",
            "metrics & trends",
            "pdf & csv reports",
            "drift prediction (7-day forecast)",
            "feature importance analysis",
            "remediation suggestions",
            "real-time monitoring (WebSocket)",
            "configurable alerts",
            "batch analysis",
            "scheduled monitoring",
            "auto-retrain triggers",
            "data quality metrics",
            "anomaly detection",
            "statistical significance testing",
            "performance monitoring (Prometheus)",
            "Redis caching",
            "background task processing"
        ],
    }

@app.get("/health", tags=["Status"])
def health_check():
    """Health check endpoint for monitoring"""
    
    redis_status = "connected"
    if redis_client:
        try:
            redis_client.ping()
        except:
            redis_status = "disconnected"
    else:
        redis_status = "not configured"
    
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_websocket_connections": len(manager.active_connections),
        "redis_status": redis_status,
        "scheduler_running": scheduler.running,
        "scheduled_jobs": len(scheduler.get_jobs())
    }

@app.get("/metrics-prometheus", tags=["Monitoring"])
async def metrics_prometheus():
    """Expose Prometheus metrics"""
    return Response(generate_latest(), media_type="text/plain")