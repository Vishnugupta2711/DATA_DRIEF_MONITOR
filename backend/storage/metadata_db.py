# # backend/storage/metadata_db.py

# import os
# from pathlib import Path
# from dotenv import load_dotenv
# from sqlalchemy import create_engine, Column, String, JSON, DateTime
# from sqlalchemy.orm import declarative_base, sessionmaker
# from datetime import datetime

# # ✅ Get the backend directory path and load .env
# BACKEND_DIR = Path(__file__).resolve().parent.parent
# ENV_PATH = BACKEND_DIR / '.env'
# load_dotenv(dotenv_path=ENV_PATH)

# print(f"🔍 Loading .env from: {ENV_PATH}")
# print(f"📁 .env exists: {ENV_PATH.exists()}")

# # ✅ Get DB_URL - MUST be PostgreSQL
# DB_URL = os.getenv("DB_URL")

# if not DB_URL:
#     raise ValueError(
#         "❌ DB_URL not found in environment variables!\n"
#         "Please create backend/.env with:\n"
#         "DB_URL=postgresql://username:password@localhost:5432/datadrift"
#     )

# print(f"📊 Database URL: {DB_URL.replace(DB_URL.split('@')[0].split('//')[1], '***')}")  # Hide credentials

# # ✅ No connect_args needed for PostgreSQL
# engine = create_engine(DB_URL, pool_pre_ping=True, echo=False)
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base = declarative_base()

# class Snapshot(Base):
#     __tablename__ = "snapshots"

#     id = Column(String, primary_key=True, index=True)
#     timestamp = Column(DateTime, default=datetime.utcnow)
#     summary = Column(JSON)
#     user_email = Column(String, index=True)

# def get_db():
#     """
#     Dependency for getting database session.
#     """
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

# def init_db():
#     """
#     Initialize database tables.
#     """
#     Base.metadata.create_all(engine)


# backend/storage/metadata_db.py

from sqlalchemy import create_engine, Column, String, JSON, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

from backend.config import config


# ==========================
# Database Engine
# ==========================

if not config.DATABASE_URL:
    raise ValueError("❌ DATABASE_URL is not set in environment variables")

engine = create_engine(
    config.DATABASE_URL,
    pool_pre_ping=True,
    echo=False
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# ==========================
# Models
# ==========================

class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    summary = Column(JSON)
    user_email = Column(String, index=True)


# ==========================
# Dependency
# ==========================

def get_db():
    """
    Dependency for getting database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================
# Initialize Tables
# ==========================

def init_db():
    """
    Initialize database tables.
    """
    Base.metadata.create_all(bind=engine)