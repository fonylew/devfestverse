from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from backend.app.core.rbac import DB_USERS, UserRole, get_current_user
import uuid

router = APIRouter(prefix="/auth", tags=["Auth"])

class QuickRegisterRequest(BaseModel):
    display_name: str
    email: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    google_token: str
    email: str
    display_name: str

@router.post("/register")
def register_participant(req: QuickRegisterRequest):
    user_id = f"user-partic-{uuid.uuid4().hex[:8]}"
    user = {
        "id": user_id,
        "email": req.email or f"{user_id}@devfestverse.io",
        "display_name": req.display_name,
        "role": UserRole.PARTICIPANT,
        "verified_ticket": False,
        "ticket_ref": None
    }
    DB_USERS[user_id] = user
    return {
        "message": "Participant registered successfully",
        "user_id": user_id,
        "user": user
    }

@router.post("/google-login")
def google_login(req: GoogleAuthRequest):
    # Mock Google OAuth token verification
    existing_user = next((u for u in DB_USERS.values() if u["email"] == req.email), None)
    if existing_user:
        return {"message": "Google Login successful", "user": existing_user}
    
    user_id = f"user-partic-{uuid.uuid4().hex[:8]}"
    user = {
        "id": user_id,
        "email": req.email,
        "display_name": req.display_name,
        "role": UserRole.PARTICIPANT,
        "verified_ticket": False,
        "ticket_ref": None
    }
    DB_USERS[user_id] = user
    return {"message": "Google Sign-In registered new participant", "user": user}

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return user
