from sqlalchemy import Column, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from backend.storage.database import Base
import uuid
from datetime import datetime

class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime, default=datetime.utcnow)
    summary = Column(JSONB)
    user_email = Column(Text, nullable=False)

