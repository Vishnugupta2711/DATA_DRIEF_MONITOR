from backend.storage.database import SessionLocal
from backend.storage.models import Snapshot


def save_snapshot(summary, user_email, dataset_name=None, drift_score=None, drift_severity=None):
    db = SessionLocal()
    snap = Snapshot(
        summary=summary,
        user_email=user_email,
        dataset_name=dataset_name,
        drift_score=drift_score,
        drift_severity=drift_severity
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    db.close()
    return snap.id

def get_snapshot(snap_id):
    db = SessionLocal()
    snap = db.query(Snapshot).filter(Snapshot.id == snap_id).first()
    db.close()
    return snap


def list_snapshots(user_email: str):
    db = SessionLocal()
    snaps = (
        db.query(Snapshot)
        .filter(Snapshot.user_email == user_email)
        .order_by(Snapshot.timestamp.desc())
        .all()
    )
    db.close()
    return [
        {
            "id": str(s.id),
            "timestamp": s.timestamp.isoformat()
        }
        for s in snaps
    ]


def load_snapshot(snap_id: str):
    db = SessionLocal()
    snap = db.query(Snapshot).filter(Snapshot.id == snap_id).first()
    db.close()
    return snap.summary if snap else None
