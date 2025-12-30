import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, String, JSON, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime
from sqlalchemy.ext.declarative import declarative_base
load_dotenv()

engine = create_engine(os.getenv("DB_URL"))
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()

class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(String, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    summary = Column(JSON)
    user_email = Column(String, index=True) 

def init_db():
    Base.metadata.create_all(engine)
