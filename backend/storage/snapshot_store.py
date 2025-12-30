from backend.storage.metadata_db import SessionLocal, Snapshot
from datetime import datetime
import uuid

def save_snapshot(summary: dict) -> str:
    db = SessionLocal()
    sid = str(uuid.uuid4())

    snap = Snapshot(
        id=sid,
        timestamp=datetime.utcnow(),
        summary=summary
    )

    db.add(snap)
    db.commit()
    db.close()

    return sid


def list_snapshots():
    db = SessionLocal()
    snaps = db.query(Snapshot).order_by(Snapshot.timestamp).all()
    db.close()
    return [{"id": s.id, "timestamp": s.timestamp} for s in snaps]


def load_snapshot(sid: str) -> dict:
    db = SessionLocal()
    snap = db.query(Snapshot).filter(Snapshot.id == sid).first()
    db.close()
    return snap.summary if snap else None
