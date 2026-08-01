from fastapi import APIRouter, HTTPException, Depends
from backend.storage.metadata_db import SessionLocal
from backend.auth.models import User
from backend.auth.security import hash_password, verify_password, create_access_token
import uuid

router = APIRouter()

@router.post("/signup")
def signup(email: str, password: str):
    db = SessionLocal()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(id=str(uuid.uuid4()), email=email, hashed_password=hash_password(password))
    db.add(user)
    db.commit()
    return {"msg": "User created"}

@router.post("/login")
def login(email: str, password: str):
    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}
