from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from backend.app.core.config import settings
from backend.app.core.firestore import firestore_manager
from backend.app.core.rbac import UserRole, get_current_user
from backend.app.api.avatar import AvatarConfig, generate_svg_agent_avatar
import uuid
import logging

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    HAS_GOOGLE_AUTH = True
except ImportError:
    HAS_GOOGLE_AUTH = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth & Google Identity Platform"])

class QuickRegisterRequest(BaseModel):
    display_name: str
    email: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    google_token: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_config: Optional[AvatarConfig] = None

def verify_google_token_payload(token_str: str) -> Optional[Dict[str, Any]]:
    """Verify Google OAuth / GIS ID token if possible, or extract mock payload."""
    if HAS_GOOGLE_AUTH and token_str and not token_str.startswith("mock") and not token_str.startswith("oauth2-token-mock"):
        try:
            req = google_requests.Request()
            # Verify against Google's public certificates
            # Audience check against GOOGLE_CLIENT_ID
            client_id = settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID != "mock-client-id" else None
            idinfo = id_token.verify_oauth2_token(token_str, req, client_id)
            return idinfo
        except Exception as e:
            logger.debug(f"Google token live verification skipped/failed: {e}")
    return None

@router.get("/config")
def get_auth_config():
    """Return public Google OAuth client configuration."""
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID,
        "gcp_project": settings.GCP_PROJECT
    }

@router.get("/me")
def get_current_user_profile(user: dict = Depends(get_current_user)):
    """Fetch current user profile and avatar configuration from Firestore."""
    fs_user = firestore_manager.get_user(user.get("id", ""))
    if fs_user:
        return {
            "message": "User profile retrieved from Firestore",
            "user": fs_user
        }
    return {
        "message": "User profile retrieved",
        "user": user
    }

@router.post("/register")
def register_participant(req: QuickRegisterRequest):
    user_id = f"user-partic-{uuid.uuid4().hex[:8]}"
    default_config = AvatarConfig()
    user = {
        "id": user_id,
        "email": req.email or f"{user_id}@devfestverse.io",
        "display_name": req.display_name,
        "role": UserRole.PARTICIPANT.value,
        "verified_ticket": False,
        "ticket_ref": None,
        "auth_provider": "local",
        "avatar_config": default_config.model_dump(),
        "avatar_svg": generate_svg_agent_avatar(default_config)
    }
    user = firestore_manager.upsert_user(user)
    return {
        "message": "Participant registered successfully",
        "user_id": user_id,
        "user": user
    }

@router.post("/google-login")
def google_login(req: GoogleAuthRequest):
    # Attempt real token verification
    verified_payload = verify_google_token_payload(req.google_token)
    
    email = req.email
    display_name = req.display_name
    avatar_url = req.avatar_url
    google_sub = None

    if verified_payload:
        email = verified_payload.get("email", email)
        display_name = verified_payload.get("name", display_name)
        avatar_url = verified_payload.get("picture", avatar_url)
        google_sub = verified_payload.get("sub")

    if not email:
        email = f"google-user-{uuid.uuid4().hex[:6]}@gmail.com"
    if not display_name:
        display_name = "Google Developer"

    # Check existing user by email in Firestore
    existing_user = firestore_manager.get_user_by_email(email)
    if existing_user:
        if not existing_user.get("avatar_config"):
            default_config = req.avatar_config or AvatarConfig()
            existing_user["avatar_config"] = default_config.model_dump()
            existing_user["avatar_svg"] = generate_svg_agent_avatar(default_config)
        
        if avatar_url:
            existing_user["avatar_url"] = avatar_url
        if google_sub:
            existing_user["google_sub"] = google_sub
        existing_user["auth_provider"] = "google"
        
        saved_user = firestore_manager.upsert_user(existing_user)
        firestore_manager.save_user_avatar(saved_user["id"], saved_user["avatar_config"])
        return {
            "message": "Google Login successful (Existing Firestore User)",
            "user": saved_user,
            "project_id": settings.GCP_PROJECT
        }

    # Register new user in Firestore
    user_id = f"user-partic-{uuid.uuid4().hex[:8]}"
    config = req.avatar_config or AvatarConfig()
    new_user = {
        "id": user_id,
        "email": email,
        "display_name": display_name,
        "role": UserRole.PARTICIPANT.value,
        "verified_ticket": False,
        "ticket_ref": None,
        "avatar_url": avatar_url,
        "avatar_config": config.model_dump(),
        "avatar_svg": generate_svg_agent_avatar(config),
        "auth_provider": "google",
        "google_sub": google_sub
    }
    saved_user = firestore_manager.upsert_user(new_user)
    firestore_manager.save_user_avatar(user_id, config.model_dump())
    
    return {
        "message": f"Google Sign-In registered new participant in project '{settings.GCP_PROJECT}'",
        "user": saved_user,
        "project_id": settings.GCP_PROJECT
    }

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return user


