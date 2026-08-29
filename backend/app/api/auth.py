from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from backend.app.core.rbac import DB_USERS, UserRole, get_current_user
from backend.app.api.avatar import AvatarConfig, generate_svg_agent_avatar
import uuid

router = APIRouter(prefix="/auth", tags=["Auth"])

class QuickRegisterRequest(BaseModel):
    display_name: str
    email: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    google_token: str
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    avatar_config: Optional[AvatarConfig] = None

@router.post("/register")
def register_participant(req: QuickRegisterRequest):
    user_id = f"user-partic-{uuid.uuid4().hex[:8]}"
    default_config = AvatarConfig()
    user = {
        "id": user_id,
        "email": req.email or f"{user_id}@devfestverse.io",
        "display_name": req.display_name,
        "role": UserRole.PARTICIPANT,
        "verified_ticket": False,
        "ticket_ref": None,
        "avatar_config": default_config.model_dump(),
        "avatar_svg": generate_svg_agent_avatar(default_config)
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
        if "avatar_config" not in existing_user:
            default_config = AvatarConfig()
            existing_user["avatar_config"] = default_config.model_dump()
            existing_user["avatar_svg"] = generate_svg_agent_avatar(default_config)
        return {"message": "Google Login successful", "user": existing_user}
    
    user_id = f"user-partic-{uuid.uuid4().hex[:8]}"
    config = req.avatar_config or AvatarConfig()
    user = {
        "id": user_id,
        "email": req.email,
        "display_name": req.display_name,
        "role": UserRole.PARTICIPANT,
        "verified_ticket": False,
        "ticket_ref": None,
        "avatar_url": req.avatar_url,
        "avatar_config": config.model_dump(),
        "avatar_svg": generate_svg_agent_avatar(config)
    }
    DB_USERS[user_id] = user
    return {"message": "Google Sign-In registered new participant", "user": user}

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return user

