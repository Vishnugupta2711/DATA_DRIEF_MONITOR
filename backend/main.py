from fastapi import FastAPI, UploadFile, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import shutil
import os

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
# App Init
# --------------------------------------------------

app = FastAPI(title="Data Drift Monitor")

app.include_router(auth_router, prefix="/auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = "data/raw"
os.makedirs(DATA_DIR, exist_ok=True)
# --------------------------------------------------
# Analyze Dataset
# --------------------------------------------------
# --------------------------------------------------
# Analyze Dataset
# --------------------------------------------------

@app.post("/analyze")
async def analyze(
    file: UploadFile,
    dataset_name: str = Query("", description="Optional dataset name"),
    user: str = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files supported")

    dataset_name = dataset_name or file.filename
    safe_name = os.path.basename(file.filename)
    path = os.path.join(DATA_DIR, safe_name)

    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    summary = analyze_csv(path)

    # 🔍 DEBUG PRINTS
    print("\n===== SUMMARY DEBUG =====")
    print(summary)
    print("========================")

    history = list_snapshots(user)
    drift = []
    drift_score = 0.0
    severity = "none"

    if history:
        last_summary = load_snapshot(history[0]["id"])

        # 🔍 DEBUG PRINT OLD SUMMARY
        print("\n===== LAST SUMMARY DEBUG =====")
        print(last_summary)
        print("=============================")

        if last_summary:
            drift = (
                detect_schema_drift(last_summary, summary)
                + detect_statistical_drift(last_summary, summary)
                + detect_semantic_drift(last_summary, summary)
            )

            drift_score = compute_drift_score(last_summary, summary)
            severity = classify_severity(drift_score)

    snap_id = save_snapshot(
        summary=summary,
        user_email=user,
        dataset_name=dataset_name,
        drift_score=drift_score,
        drift_severity=severity,
    )

    if severity in {"medium", "high"}:
        try:
            send_email_alert(
                subject=f"⚠ Drift Alert ({severity.upper()})",
                message=f"""
Dataset: {dataset_name}
User: {user}
Score: {drift_score}
Severity: {severity}
""",
            )
        except Exception as e:
            print("Email alert failed:", e)

    return {
        "snapshot_id": snap_id,
        "drift": drift,
        "score": drift_score,
        "severity": severity,
    }

# --------------------------------------------------
# Snapshot History
# --------------------------------------------------

@app.get("/history")
def history(user: str = Depends(get_current_user)):
    return list_snapshots(user)

@app.get("/snapshot/{snap_id}")
def snapshot_details(snap_id: str, user: str = Depends(get_current_user)):
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snap.summary

@app.delete("/snapshot/{snap_id}")
def delete_snapshot(snap_id: str, user: str = Depends(get_current_user)):
    db = SessionLocal()
    deleted = (
        db.query(Snapshot)
        .filter(Snapshot.id == snap_id, Snapshot.user_email == user)
        .delete()
    )
    db.commit()
    db.close()

    if not deleted:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    return {"status": "deleted"}

# --------------------------------------------------
# Compare Snapshots
# --------------------------------------------------

@app.get("/compare")
def compare(
    a: str = Query(..., description="Snapshot A ID"),
    b: str = Query(..., description="Snapshot B ID"),
    user: str = Depends(get_current_user),
):
    sa = get_snapshot(a)
    sb = get_snapshot(b)

    if not sa or not sb:
        raise HTTPException(status_code=404, detail="Invalid snapshot id")

    if sa.user_email != user or sb.user_email != user:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return {
        "statistical_drift": detect_statistical_drift(sa.summary, sb.summary),
        "schema_drift": detect_schema_drift(sa.summary, sb.summary),
        "semantic_drift": detect_semantic_drift(sa.summary, sb.summary),
        "drift_score": compute_drift_score(sa.summary, sb.summary),
    }

# --------------------------------------------------
# Metrics
# --------------------------------------------------

@app.get("/metrics/{snap_id}")
def metrics(snap_id: str, user=Depends(get_current_user)):
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    summary = snap.summary or {}
    numeric = summary.get("numeric", {})

    return [
        {
            "column": col,
            "mean": stats.get("mean"),
            "std": stats.get("std"),
            "min": stats.get("min"),
            "max": stats.get("max"),
        }
        for col, stats in numeric.items()
    ]

# --------------------------------------------------
# Trends
# --------------------------------------------------

@app.get("/trends")
def trends(user=Depends(get_current_user)):
    return list_snapshots(user)

# --------------------------------------------------
# Reports
# --------------------------------------------------

@app.get("/report/{snap_id}")
def download_report(
    snap_id: str,
    format: str = Query("pdf"),
    user: str = Depends(get_current_user),
):
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

    raise HTTPException(status_code=400, detail="Invalid format")

# --------------------------------------------------
# Health Check
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Data Drift Monitor",
        "features": [
            "auth",
            "snapshot history",
            "dataset grouping",
            "drift detection",
            "ML scoring",
            "email alerts",
            "snapshot comparison",
            "metrics",
            "trend visualization",
            "pdf & csv reports",
        ],
    }
from fastapi import FastAPI, UploadFile, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import shutil
import os

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
# App Init
# --------------------------------------------------

app = FastAPI(title="Data Drift Monitor")

app.include_router(auth_router, prefix="/auth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = "data/raw"
os.makedirs(DATA_DIR, exist_ok=True)

# --------------------------------------------------
# Analyze Dataset
# --------------------------------------------------

@app.post("/analyze")
async def analyze(
    file: UploadFile,
    dataset_name: str = Query("", description="Optional dataset name"),
    user: str = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files supported")

    dataset_name = dataset_name or file.filename
    safe_name = os.path.basename(file.filename)
    path = os.path.join(DATA_DIR, safe_name)

    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    summary = analyze_csv(path)

    history = list_snapshots(user)
    drift = []
    drift_score = 0.0
    severity = "none"

    if history:
        last_summary = load_snapshot(history[0]["id"])
        if last_summary:
            drift = (
                detect_schema_drift(last_summary, summary)
                + detect_statistical_drift(last_summary, summary)
                + detect_semantic_drift(last_summary, summary)
            )

            drift_score = compute_drift_score(last_summary, summary)
            severity = classify_severity(drift_score)

    snap_id = save_snapshot(
        summary=summary,
        user_email=user,
        dataset_name=dataset_name,
        drift_score=drift_score,
        drift_severity=severity,
    )

    if severity in {"medium", "high"}:
        try:
            send_email_alert(
                subject=f"⚠ Drift Alert ({severity.upper()})",
                message=f"""
Dataset: {dataset_name}
User: {user}
Score: {drift_score}
Severity: {severity}
""",
            )
        except Exception as e:
            print("Email alert failed:", e)

    return {
        "snapshot_id": snap_id,
        "drift": drift,
        "score": drift_score,
        "severity": severity,
    }

# --------------------------------------------------
# Snapshot History
# --------------------------------------------------

@app.get("/history")
def history(user: str = Depends(get_current_user)):
    return list_snapshots(user)

@app.get("/snapshot/{snap_id}")
def snapshot_details(snap_id: str, user: str = Depends(get_current_user)):
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snap.summary

@app.delete("/snapshot/{snap_id}")
def delete_snapshot(snap_id: str, user: str = Depends(get_current_user)):
    db = SessionLocal()
    deleted = (
        db.query(Snapshot)
        .filter(Snapshot.id == snap_id, Snapshot.user_email == user)
        .delete()
    )
    db.commit()
    db.close()

    if not deleted:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    return {"status": "deleted"}

# --------------------------------------------------
# Compare Snapshots
# --------------------------------------------------

@app.get("/compare")
def compare(
    a: str = Query(..., description="Snapshot A ID"),
    b: str = Query(..., description="Snapshot B ID"),
    user: str = Depends(get_current_user),
):
    sa = get_snapshot(a)
    sb = get_snapshot(b)

    if not sa or not sb:
        raise HTTPException(status_code=404, detail="Invalid snapshot id")

    if sa.user_email != user or sb.user_email != user:
        raise HTTPException(status_code=403, detail="Unauthorized")

    return {
        "statistical_drift": detect_statistical_drift(sa.summary, sb.summary),
        "schema_drift": detect_schema_drift(sa.summary, sb.summary),
        "semantic_drift": detect_semantic_drift(sa.summary, sb.summary),
        "drift_score": compute_drift_score(sa.summary, sb.summary),
    }

# --------------------------------------------------
# Metrics
# --------------------------------------------------

@app.get("/metrics/{snap_id}")
def metrics(snap_id: str, user=Depends(get_current_user)):
    snap = get_snapshot(snap_id)
    if not snap or snap.user_email != user:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    summary = snap.summary or {}
    numeric = summary.get("numeric", {})

    return [
        {
            "column": col,
            "mean": stats.get("mean"),
            "std": stats.get("std"),
            "min": stats.get("min"),
            "max": stats.get("max"),
        }
        for col, stats in numeric.items()
    ]

# --------------------------------------------------
# Trends
# --------------------------------------------------

@app.get("/trends")
def trends(user=Depends(get_current_user)):
    return list_snapshots(user)

# --------------------------------------------------
# Reports
# --------------------------------------------------

@app.get("/report/{snap_id}")
def download_report(
    snap_id: str,
    format: str = Query("pdf"),
    user: str = Depends(get_current_user),
):
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

    raise HTTPException(status_code=400, detail="Invalid format")

# --------------------------------------------------
# Health Check
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "status": "ok",
        "service": "Data Drift Monitor",
        "features": [
            "auth",
            "snapshot history",
            "dataset grouping",
            "drift detection",
            "ML scoring",
            "email alerts",
            "snapshot comparison",
            "metrics",
            "trend visualization",
            "pdf & csv reports",
        ],
    }
