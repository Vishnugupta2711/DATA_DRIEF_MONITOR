from sqlalchemy import Column, String
from backend.storage.metadata_db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)


"""
models_production.py
────────────────────────────────────────────────────────────────
SQLAlchemy model additions for production ingestion pipeline.

Add these to your existing models.py (or import and merge).
Includes:
  • IngestionRun  – audit log for every pipeline execution
  • Updated DriftSnapshot fields (comparison_mode, compared_to, etc.)
  • Alembic migration helper at the bottom
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Integer, Boolean,
    DateTime, Text, JSON, ForeignKey, Index,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# ═══════════════════════════════════════════════════════════════════════════
# INGESTION RUN  (audit log)
# ═══════════════════════════════════════════════════════════════════════════

class IngestionRun(Base):
    """
    One record per automated pipeline execution.
    Used by /production/ingestion-runs and pipeline-health endpoints.
    """
    __tablename__ = "ingestion_runs"

    id               = Column(String(36), primary_key=True)
    dataset_name     = Column(String(255), nullable=False, index=True)
    status           = Column(String(20), nullable=False)     # success | failed | skipped | no_data
    started_at       = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    duration_seconds = Column(Float)
    drift_score      = Column(Float)
    severity         = Column(String(20))                     # none | info | warning | critical
    alert_sent       = Column(Boolean, default=False)
    error            = Column(Text)
    run_metadata     = Column("metadata", Text)                            # JSON blob of full result dict
    comparison_mode  = Column(String(30))                     # last_snapshot | baseline | rolling_window
    new_snapshot_id  = Column(String(36))
    compared_to_id   = Column(String(36))
    schema_fingerprint = Column(String(20))
    consecutive_drift  = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_ingestion_runs_dataset_started",
              "dataset_name", "started_at"),
    )

    def to_dict(self):
        return {
            "id":               self.id,
            "dataset_name":     self.dataset_name,
            "status":           self.status,
            "started_at":       self.started_at.isoformat() if self.started_at else None,
            "duration_seconds": self.duration_seconds,
            "drift_score":      self.drift_score,
            "severity":         self.severity,
            "alert_sent":       self.alert_sent,
            "error":            self.error,
            "comparison_mode":  self.comparison_mode,
            "new_snapshot_id":  self.new_snapshot_id,
            "compared_to_id":   self.compared_to_id,
            "consecutive_drift":self.consecutive_drift,
        }


# ═══════════════════════════════════════════════════════════════════════════
# UPDATED DRIFT SNAPSHOT  (add new columns to existing table)
# ═══════════════════════════════════════════════════════════════════════════

class DriftSnapshotExtension:
    """
    Mixin – merge these columns into your existing DriftSnapshot model.

    In your models.py add:
        class DriftSnapshot(Base, DriftSnapshotExtension):
            ...existing columns...
            compared_to      = Column(String(36), nullable=True)
            comparison_mode  = Column(String(30), nullable=True)
            source_run_id    = Column(String(8), nullable=True)
            status           = Column(String(20), default="active")
            schema_fingerprint = Column(String(20), nullable=True)
    """

    # Foreign key to the snapshot this was compared against
    compared_to      = Column(String(36), nullable=True)

    # Which mode was used (last_snapshot / baseline / rolling_window)
    comparison_mode  = Column(String(30), nullable=True, default="last_snapshot")

    # Reference back to the IngestionRun that created it
    source_run_id    = Column(String(8), nullable=True)

    # Lifecycle: active | archived | deleted
    status           = Column(String(20), nullable=False, default="active")

    # MD5 fingerprint of column/dtype signature for schema tracking
    schema_fingerprint = Column(String(20), nullable=True)


# ═══════════════════════════════════════════════════════════════════════════
# ALERT RULE MODEL  (optional – for persistent configurable rules)
# ═══════════════════════════════════════════════════════════════════════════

class AlertRule(Base):
    """
    Per-dataset or global alert rules with feature-level thresholds.
    Stored in DB so they survive restarts and are editable via API.
    """
    __tablename__ = "alert_rules"

    id                   = Column(String(36), primary_key=True)
    dataset_name         = Column(String(255), nullable=True)  # NULL = global
    feature_name         = Column(String(255), nullable=True)  # NULL = dataset-level
    threshold_info       = Column(Float, default=0.10)
    threshold_warning    = Column(Float, default=0.25)
    threshold_critical   = Column(Float, default=0.45)
    persistence_cycles   = Column(Integer, default=2)
    cooldown_minutes     = Column(Integer, default=30)
    channels             = Column(JSON, default=lambda: {"email": True, "slack": False})
    enabled              = Column(Boolean, default=True)
    created_at           = Column(DateTime(timezone=True),
                                  default=lambda: datetime.now(timezone.utc))
    updated_at           = Column(DateTime(timezone=True),
                                  onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id":                 self.id,
            "dataset_name":       self.dataset_name,
            "feature_name":       self.feature_name,
            "threshold_info":     self.threshold_info,
            "threshold_warning":  self.threshold_warning,
            "threshold_critical": self.threshold_critical,
            "persistence_cycles": self.persistence_cycles,
            "cooldown_minutes":   self.cooldown_minutes,
            "channels":           self.channels,
            "enabled":            self.enabled,
        }


# ═══════════════════════════════════════════════════════════════════════════
# ALEMBIC MIGRATION SCRIPT  (paste into a new migration file)
# ═══════════════════════════════════════════════════════════════════════════

ALEMBIC_MIGRATION = """
\"\"\"Add production ingestion tables and snapshot columns

Revision ID: prod_ingestion_001
Revises: <previous_revision>
\"\"\"
from alembic import op
import sqlalchemy as sa

def upgrade():
    # ── ingestion_runs ──────────────────────────────────────────────────────
    op.create_table(
        'ingestion_runs',
        sa.Column('id',                 sa.String(36),  primary_key=True),
        sa.Column('dataset_name',       sa.String(255), nullable=False),
        sa.Column('status',             sa.String(20),  nullable=False),
        sa.Column('started_at',         sa.DateTime(timezone=True)),
        sa.Column('duration_seconds',   sa.Float),
        sa.Column('drift_score',        sa.Float),
        sa.Column('severity',           sa.String(20)),
        sa.Column('alert_sent',         sa.Boolean, default=False),
        sa.Column('error',              sa.Text),
        sa.Column('run_metadata',       sa.Text),
        sa.Column('comparison_mode',    sa.String(30)),
        sa.Column('new_snapshot_id',    sa.String(36)),
        sa.Column('compared_to_id',     sa.String(36)),
        sa.Column('schema_fingerprint', sa.String(20)),
        sa.Column('consecutive_drift',  sa.Integer, default=0),
    )
    op.create_index('ix_ingestion_runs_dataset_started',
                    'ingestion_runs', ['dataset_name', 'started_at'])

    # ── alert_rules ─────────────────────────────────────────────────────────
    op.create_table(
        'alert_rules',
        sa.Column('id',                  sa.String(36),  primary_key=True),
        sa.Column('dataset_name',        sa.String(255), nullable=True),
        sa.Column('feature_name',        sa.String(255), nullable=True),
        sa.Column('threshold_info',      sa.Float, default=0.10),
        sa.Column('threshold_warning',   sa.Float, default=0.25),
        sa.Column('threshold_critical',  sa.Float, default=0.45),
        sa.Column('persistence_cycles',  sa.Integer, default=2),
        sa.Column('cooldown_minutes',    sa.Integer, default=30),
        sa.Column('channels',            sa.JSON),
        sa.Column('enabled',             sa.Boolean, default=True),
        sa.Column('created_at',          sa.DateTime(timezone=True)),
        sa.Column('updated_at',          sa.DateTime(timezone=True)),
    )

    # ── new columns on drift_snapshots ──────────────────────────────────────
    op.add_column('drift_snapshots', sa.Column('compared_to',        sa.String(36)))
    op.add_column('drift_snapshots', sa.Column('comparison_mode',    sa.String(30)))
    op.add_column('drift_snapshots', sa.Column('source_run_id',      sa.String(8)))
    op.add_column('drift_snapshots', sa.Column('status',             sa.String(20), server_default='active'))
    op.add_column('drift_snapshots', sa.Column('schema_fingerprint', sa.String(20)))


def downgrade():
    op.drop_table('ingestion_runs')
    op.drop_table('alert_rules')
    op.drop_column('drift_snapshots', 'compared_to')
    op.drop_column('drift_snapshots', 'comparison_mode')
    op.drop_column('drift_snapshots', 'source_run_id')
    op.drop_column('drift_snapshots', 'status')
    op.drop_column('drift_snapshots', 'schema_fingerprint')
"""