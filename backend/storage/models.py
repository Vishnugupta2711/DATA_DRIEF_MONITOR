import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB

from backend.storage.database import Base


class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime, default=datetime.utcnow)
    summary = Column(JSONB, nullable=False)

    user_email = Column(String, nullable=False)
    dataset_name = Column(String, nullable=False)

    drift_score = Column(Float, default=0.0)
    drift_severity = Column(String, default="none")
