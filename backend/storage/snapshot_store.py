from backend.storage.database import SessionLocal
from backend.storage.models import Snapshot
from contextlib import contextmanager
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@contextmanager
def get_db_session():
    """
    Context manager for database sessions with automatic cleanup.
    Ensures connections are always closed and transactions are handled properly.
    """
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


def save_snapshot(
    summary: Dict[str, Any],
    user_email: str,
    dataset_name: str,
    drift_score: float,
    drift_severity: str,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Save a new snapshot to the database.
    
    Args:
        summary: Dictionary containing analysis results
        user_email: User's email address
        dataset_name: Name of the dataset
        drift_score: Calculated drift score (0-1)
        drift_severity: Severity level (low/medium/high)
        metadata: Optional additional metadata
        
    Returns:
        String ID of the created snapshot
        
    Raises:
        ValueError: If required fields are invalid
        DatabaseError: If save operation fails
    """
    # Validation
    if not user_email or not isinstance(user_email, str):
        raise ValueError("Valid user_email is required")
    
    if not dataset_name or not isinstance(dataset_name, str):
        raise ValueError("Valid dataset_name is required")
    
    if not 0 <= drift_score <= 1:
        logger.warning(f"Drift score {drift_score} out of range, clamping to [0,1]")
        drift_score = max(0.0, min(1.0, drift_score))
    
    if drift_severity not in ["low", "medium", "high", "none"]:
        logger.warning(f"Invalid severity '{drift_severity}', defaulting to 'none'")
        drift_severity = "none"
    
    try:
        with get_db_session() as db:
            snap = Snapshot(
                summary=summary,
                user_email=user_email.strip().lower(),
                dataset_name=dataset_name.strip(),
                drift_score=float(drift_score),
                drift_severity=drift_severity,
            )
            
            # Add metadata if provided
            if metadata:
                snap.summary["metadata"] = metadata
            
            db.add(snap)
            db.flush()  # Get the ID before commit
            snap_id = str(snap.id)
            
            logger.info(f"Snapshot saved: {snap_id} for user {user_email}")
            return snap_id
            
    except Exception as e:
        logger.error(f"Failed to save snapshot: {e}")
        raise


def list_snapshots(
    user_email: str,
    dataset_name: Optional[str] = None,
    severity: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    """
    List snapshots for a user with optional filtering.
    
    Args:
        user_email: User's email address
        dataset_name: Filter by specific dataset
        severity: Filter by severity level
        limit: Maximum number of results
        offset: Number of results to skip (pagination)
        start_date: Filter snapshots after this date
        end_date: Filter snapshots before this date
        
    Returns:
        List of snapshot dictionaries with summary information
    """
    if not user_email:
        raise ValueError("user_email is required")
    
    try:
        with get_db_session() as db:
            query = db.query(Snapshot).filter(
                Snapshot.user_email == user_email.strip().lower()
            )
            
            # Apply filters
            if dataset_name:
                query = query.filter(Snapshot.dataset_name == dataset_name.strip())
            
            if severity:
                query = query.filter(Snapshot.drift_severity == severity)
            
            if start_date:
                query = query.filter(Snapshot.timestamp >= start_date)
            
            if end_date:
                query = query.filter(Snapshot.timestamp <= end_date)
            
            # Order and paginate
            query = query.order_by(Snapshot.timestamp.desc())
            
            if offset:
                query = query.offset(offset)
            
            if limit:
                query = query.limit(limit)
            
            snaps = query.all()
            
            # Convert to dictionaries
            result = [
                {
                    "id": str(s.id),
                    "timestamp": s.timestamp.isoformat(),
                    "dataset_name": s.dataset_name,
                    "drift_score": float(s.drift_score) if s.drift_score else 0.0,
                    "drift_severity": s.drift_severity,
                }
                for s in snaps
            ]
            
            logger.info(f"Retrieved {len(result)} snapshots for user {user_email}")
            return result
            
    except Exception as e:
        logger.error(f"Failed to list snapshots: {e}")
        return []


def get_snapshot(snap_id: str) -> Optional[Snapshot]:
    """
    Get a single snapshot by ID.
    
    Args:
        snap_id: Snapshot UUID as string
        
    Returns:
        Snapshot object or None if not found
    """
    if not snap_id:
        raise ValueError("snap_id is required")
    
    try:
        with get_db_session() as db:
            snap = db.query(Snapshot).filter(Snapshot.id == snap_id).first()
            
            if snap:
                # Detach from session to avoid lazy loading issues
                db.expunge(snap)
            
            return snap
            
    except Exception as e:
        logger.error(f"Failed to get snapshot {snap_id}: {e}")
        return None


def load_snapshot(snap_id: str) -> Optional[Dict[str, Any]]:
    """
    Load snapshot summary by ID.
    
    Args:
        snap_id: Snapshot UUID as string
        
    Returns:
        Summary dictionary or None if not found
    """
    snap = get_snapshot(snap_id)
    return snap.summary if snap else None


def delete_snapshot(snap_id: str, user_email: str) -> bool:
    """
    Delete a snapshot by ID (with authorization check).
    
    Args:
        snap_id: Snapshot UUID as string
        user_email: User's email for authorization
        
    Returns:
        True if deleted successfully, False otherwise
    """
    if not snap_id or not user_email:
        raise ValueError("snap_id and user_email are required")
    
    try:
        with get_db_session() as db:
            deleted = db.query(Snapshot).filter(
                Snapshot.id == snap_id,
                Snapshot.user_email == user_email.strip().lower()
            ).delete()
            
            if deleted:
                logger.info(f"Snapshot {snap_id} deleted by {user_email}")
                return True
            else:
                logger.warning(f"Snapshot {snap_id} not found or unauthorized")
                return False
                
    except Exception as e:
        logger.error(f"Failed to delete snapshot {snap_id}: {e}")
        return False


def update_snapshot(
    snap_id: str,
    user_email: str,
    **updates
) -> bool:
    """
    Update snapshot fields.
    
    Args:
        snap_id: Snapshot UUID as string
        user_email: User's email for authorization
        **updates: Fields to update (drift_score, drift_severity, summary)
        
    Returns:
        True if updated successfully, False otherwise
    """
    if not snap_id or not user_email:
        raise ValueError("snap_id and user_email are required")
    
    try:
        with get_db_session() as db:
            snap = db.query(Snapshot).filter(
                Snapshot.id == snap_id,
                Snapshot.user_email == user_email.strip().lower()
            ).first()
            
            if not snap:
                logger.warning(f"Snapshot {snap_id} not found or unauthorized")
                return False
            
            # Update allowed fields
            allowed_fields = {"drift_score", "drift_severity", "summary", "dataset_name"}
            for key, value in updates.items():
                if key in allowed_fields:
                    setattr(snap, key, value)
            
            logger.info(f"Snapshot {snap_id} updated by {user_email}")
            return True
            
    except Exception as e:
        logger.error(f"Failed to update snapshot {snap_id}: {e}")
        return False


def get_snapshot_count(user_email: str, dataset_name: Optional[str] = None) -> int:
    """
    Get total count of snapshots for a user.
    
    Args:
        user_email: User's email address
        dataset_name: Optional filter by dataset
        
    Returns:
        Total count of snapshots
    """
    if not user_email:
        return 0
    
    try:
        with get_db_session() as db:
            query = db.query(Snapshot).filter(
                Snapshot.user_email == user_email.strip().lower()
            )
            
            if dataset_name:
                query = query.filter(Snapshot.dataset_name == dataset_name.strip())
            
            count = query.count()
            return count
            
    except Exception as e:
        logger.error(f"Failed to count snapshots: {e}")
        return 0


def get_dataset_statistics(user_email: str) -> Dict[str, Any]:
    """
    Get statistics about datasets for a user.
    
    Args:
        user_email: User's email address
        
    Returns:
        Dictionary with dataset statistics
    """
    if not user_email:
        return {}
    
    try:
        with get_db_session() as db:
            snapshots = db.query(Snapshot).filter(
                Snapshot.user_email == user_email.strip().lower()
            ).all()
            
            if not snapshots:
                return {
                    "total_snapshots": 0,
                    "datasets": [],
                    "severity_distribution": {},
                    "avg_drift_score": 0.0
                }
            
            # Calculate statistics
            datasets = {}
            severity_counts = {"low": 0, "medium": 0, "high": 0, "none": 0}
            total_drift = 0.0
            
            for snap in snapshots:
                # Dataset stats
                ds_name = snap.dataset_name
                if ds_name not in datasets:
                    datasets[ds_name] = {
                        "count": 0,
                        "avg_drift": 0.0,
                        "last_snapshot": None,
                        "total_drift": 0.0
                    }
                
                datasets[ds_name]["count"] += 1
                datasets[ds_name]["total_drift"] += snap.drift_score or 0.0
                datasets[ds_name]["last_snapshot"] = snap.timestamp.isoformat()
                
                # Severity distribution
                severity_counts[snap.drift_severity] += 1
                
                # Total drift
                total_drift += snap.drift_score or 0.0
            
            # Calculate averages
            for ds in datasets.values():
                ds["avg_drift"] = ds["total_drift"] / ds["count"] if ds["count"] > 0 else 0.0
                del ds["total_drift"]
            
            return {
                "total_snapshots": len(snapshots),
                "datasets": [
                    {"name": name, **stats} for name, stats in datasets.items()
                ],
                "severity_distribution": severity_counts,
                "avg_drift_score": total_drift / len(snapshots) if snapshots else 0.0,
                "dataset_count": len(datasets)
            }
            
    except Exception as e:
        logger.error(f"Failed to get dataset statistics: {e}")
        return {}


def get_recent_high_drift_snapshots(
    user_email: str,
    hours: int = 24,
    threshold: float = 0.5
) -> List[Dict[str, Any]]:
    """
    Get recent snapshots with high drift scores.
    
    Args:
        user_email: User's email address
        hours: Look back this many hours
        threshold: Minimum drift score to include
        
    Returns:
        List of high-drift snapshots
    """
    if not user_email:
        return []
    
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        
        with get_db_session() as db:
            snaps = db.query(Snapshot).filter(
                Snapshot.user_email == user_email.strip().lower(),
                Snapshot.timestamp >= cutoff_time,
                Snapshot.drift_score >= threshold
            ).order_by(Snapshot.drift_score.desc()).all()
            
            return [
                {
                    "id": str(s.id),
                    "dataset_name": s.dataset_name,
                    "drift_score": float(s.drift_score),
                    "drift_severity": s.drift_severity,
                    "timestamp": s.timestamp.isoformat()
                }
                for s in snaps
            ]
            
    except Exception as e:
        logger.error(f"Failed to get high drift snapshots: {e}")
        return []


def bulk_delete_snapshots(
    user_email: str,
    snapshot_ids: List[str]
) -> Dict[str, int]:
    """
    Delete multiple snapshots at once.
    
    Args:
        user_email: User's email for authorization
        snapshot_ids: List of snapshot IDs to delete
        
    Returns:
        Dictionary with deleted count and failed count
    """
    if not user_email or not snapshot_ids:
        raise ValueError("user_email and snapshot_ids are required")
    
    deleted = 0
    failed = 0
    
    try:
        with get_db_session() as db:
            for snap_id in snapshot_ids:
                try:
                    result = db.query(Snapshot).filter(
                        Snapshot.id == snap_id,
                        Snapshot.user_email == user_email.strip().lower()
                    ).delete()
                    
                    if result:
                        deleted += 1
                    else:
                        failed += 1
                        
                except Exception:
                    failed += 1
            
            logger.info(f"Bulk delete: {deleted} deleted, {failed} failed")
            return {"deleted": deleted, "failed": failed}
            
    except Exception as e:
        logger.error(f"Failed bulk delete: {e}")
        return {"deleted": deleted, "failed": failed}


def search_snapshots(
    user_email: str,
    search_term: str,
    search_in: str = "dataset_name"
) -> List[Dict[str, Any]]:
    """
    Search snapshots by dataset name or other fields.
    
    Args:
        user_email: User's email address
        search_term: Term to search for
        search_in: Field to search in (dataset_name, severity)
        
    Returns:
        List of matching snapshots
    """
    if not user_email or not search_term:
        return []
    
    try:
        with get_db_session() as db:
            query = db.query(Snapshot).filter(
                Snapshot.user_email == user_email.strip().lower()
            )
            
            if search_in == "dataset_name":
                query = query.filter(
                    Snapshot.dataset_name.ilike(f"%{search_term}%")
                )
            elif search_in == "severity":
                query = query.filter(Snapshot.drift_severity == search_term)
            
            snaps = query.order_by(Snapshot.timestamp.desc()).all()
            
            return [
                {
                    "id": str(s.id),
                    "timestamp": s.timestamp.isoformat(),
                    "dataset_name": s.dataset_name,
                    "drift_score": float(s.drift_score),
                    "drift_severity": s.drift_severity,
                }
                for s in snaps
            ]
            
    except Exception as e:
        logger.error(f"Failed to search snapshots: {e}")
        return []


def cleanup_old_snapshots(
    user_email: str,
    days_old: int = 90,
    keep_minimum: int = 10
) -> int:
    """
    Clean up old snapshots while keeping a minimum number.
    
    Args:
        user_email: User's email address
        days_old: Delete snapshots older than this many days
        keep_minimum: Always keep at least this many recent snapshots
        
    Returns:
        Number of snapshots deleted
    """
    if not user_email:
        return 0
    
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)
        
        with get_db_session() as db:
            # Get total count
            total = db.query(Snapshot).filter(
                Snapshot.user_email == user_email.strip().lower()
            ).count()
            
            if total <= keep_minimum:
                logger.info(f"Not cleaning up, only {total} snapshots (minimum: {keep_minimum})")
                return 0
            
            # Delete old ones
            deleted = db.query(Snapshot).filter(
                Snapshot.user_email == user_email.strip().lower(),
                Snapshot.timestamp < cutoff_date
            ).delete()
            
            logger.info(f"Cleaned up {deleted} old snapshots for {user_email}")
            return deleted
            
    except Exception as e:
        logger.error(f"Failed to cleanup snapshots: {e}")
        return 0