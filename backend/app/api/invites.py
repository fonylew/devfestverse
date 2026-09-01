from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from backend.app.core.rbac import DB_USERS, UserRole, require_roles, get_current_user
from backend.app.core.firestore import firestore_manager
import uuid

router = APIRouter(prefix="/invites", tags=["Role Invites"])

# Store generated invite tokens in-memory (generated exclusively by ORGANIZER)
INVITE_TOKENS = {}

class CreateInviteRequest(BaseModel):
    role: UserRole
    event_id: Optional[str] = "devfest-bangkok-2026"

class RedeemInviteRequest(BaseModel):
    token: str
    user_id: Optional[str] = None

@router.post("/generate", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def generate_invite_link(req: CreateInviteRequest):
    if req.role in [UserRole.ORGANIZER, UserRole.PARTICIPANT]:
        raise HTTPException(status_code=400, detail="Invite links are only for SPEAKER, SPONSOR, or STAFF roles. Organizers must be provisioned directly.")
    
    event_id = req.event_id or "devfest-bangkok-2026"
    token = f"token-{req.role.value.lower()}-{uuid.uuid4().hex[:12]}"
    INVITE_TOKENS[token] = {
        "token": token,
        "role": req.role,
        "event_id": event_id,
        "used": False
    }
    invite_url = f"/invite/{req.role.value.lower()}?token={token}&event_id={event_id}"
    return {
        "token": token,
        "role": req.role.value,
        "event_id": event_id,
        "invite_url": invite_url,
        "qr_code_data": f"https://devfestverse.gdgcloudbkk.org{invite_url}"
    }

@router.get("/validate")
def validate_invite_token(token: str = Query(...)):
    invite_data = INVITE_TOKENS.get(token)
    if not invite_data:
        raise HTTPException(status_code=404, detail="Invalid invitation token.")
    if invite_data["used"]:
        raise HTTPException(status_code=400, detail="Invitation token has already been redeemed.")
    return {
        "valid": True,
        "role": invite_data["role"].value if isinstance(invite_data["role"], UserRole) else str(invite_data["role"]),
        "event_id": invite_data.get("event_id", "devfest-bangkok-2026")
    }

@router.post("/redeem")
def redeem_invite_token(req: RedeemInviteRequest, current_user: dict = Depends(get_current_user)):
    invite_data = INVITE_TOKENS.get(req.token)
    if not invite_data or invite_data["used"]:
        raise HTTPException(status_code=400, detail="Invalid or spent invitation token.")
    
    target_user_id = req.user_id or current_user.get("id")
    if not target_user_id:
        raise HTTPException(status_code=400, detail="User identification required.")
    
    role_str = invite_data["role"].value if isinstance(invite_data["role"], UserRole) else str(invite_data["role"])
    
    # Extra guard: Never allow promotion to ORGANIZER via invite tokens
    if role_str == UserRole.ORGANIZER.value:
        raise HTTPException(status_code=403, detail="Privilege escalation prohibited: ORGANIZER cannot be redeemed via invite.")
    
    event_id = invite_data.get("event_id", "devfest-bangkok-2026")
    
    user = firestore_manager.set_user_event_role(target_user_id, event_id, role_str)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    invite_data["used"] = True
    return {
        "message": f"Successfully promoted to {role_str} role for event '{event_id}' on Firestore!",
        "event_id": event_id,
        "user": user
    }

