from fastapi import FastAPI, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os

from backend.core.analyzer import analyze_csv
from backend.storage.snapshot_store import save_snapshot, load_snapshot, list_snapshots
from backend.core.drift import detect_schema_drift, detect_statistical_drift
from backend.core.semantic_drift import detect_semantic_drift
from backend.services.alerts import send_email_alert

from backend.auth.dependencies import get_current_user
from backend.auth.routes import router as auth_router


app = FastAPI()

# Register auth routes
app.include_router(auth_router, prefix="/auth")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze")
async def analyze(file: UploadFile, user: str = Depends(get_current_user)):
    os.makedirs("data/raw", exist_ok=True)
    path = f"data/raw/{file.filename}"

    # Save uploaded file
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Analyze dataset
    summary = analyze_csv(path)

    # Save snapshot to DB
    snap_id = save_snapshot(summary)

    # Load history
    snapshots = list_snapshots()
    drift = []

    # Detect drift if at least 2 snapshots exist
    if len(snapshots) > 1:
        old = load_snapshot(snapshots[-2]["id"])
        new = load_snapshot(snapshots[-1]["id"])

        drift = (
            detect_schema_drift(old, new)
            + detect_statistical_drift(old, new)
            + detect_semantic_drift(old, new)
        )

        # Try sending alert (non-blocking)
        if drift:
            try:
                send_email_alert(
                    subject="⚠ Data Drift Detected",
                    message="\n".join(drift)
                )
            except Exception as e:
                print("Email alert failed:", e)

    return {
        "snapshot_id": snap_id,
        "drift": drift
    }


@app.get("/history")
def history(user: str = Depends(get_current_user)):
    return list_snapshots()
