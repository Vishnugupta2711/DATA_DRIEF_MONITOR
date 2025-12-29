from fastapi import FastAPI, UploadFile
from backend.core.analyzer import analyze_csv
from backend.storage.snapshot_store import save_snapshot, load_snapshot, list_snapshots
from backend.core.drift import detect_schema_drift, detect_statistical_drift
from fastapi.middleware.cors import CORSMiddleware
from backend.services.alerts import send_email_alert
import shutil

app = FastAPI()

@app.post("/analyze")
async def analyze(file: UploadFile):
    path = f"data/raw/{file.filename}"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    summary = analyze_csv(path)
    snap_path = save_snapshot(summary)

    snapshots = list_snapshots()
    drift = []

    if drift:
        send_email_alert(
        subject="⚠ Data Drift Detected",
        message="\n".join(drift)
    )
        
    if len(snapshots) > 1:
        old = load_snapshot(f"snapshots/{snapshots[-2]}")
        new = load_snapshot(f"snapshots/{snapshots[-1]}")
        drift = detect_schema_drift(old, new) + detect_statistical_drift(old, new)

    return {
        "snapshot": snap_path,
        "drift": drift
    }
    



@app.get("/history")
def history():
    return list_snapshots()



app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)