from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional
from backend.app.core.rbac import DB_USERS, UserRole, require_roles, get_current_user
import uuid

router = APIRouter(prefix="/invites", tags=["Role Invites"])

# Store generated invite tokens
INVITE_TOKENS = {
    "token-speaker-demo": {"token": "token-speaker-demo", "role": UserRole.SPEAKER, "used": False},
    "token-sponsor-demo": {"token": "token-sponsor-demo", "role": UserRole.SPONSOR, "used": False},
    "token-staff-demo": {"token": "token-staff-demo", "role": UserRole.STAFF, "used": False},
}

class CreateInviteRequest(BaseModel):
    role: UserRole

class RedeemInviteRequest(BaseModel):
    token: str
    user_id: str

@router.post("/generate", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def generate_invite_link(req: CreateInviteRequest):
    if req.role in [UserRole.ORGANIZER, UserRole.PARTICIPANT]:
        raise HTTPException(status_code=400, detail="Invite links are only for SPEAKER, SPONSOR, or STAFF roles.")
    
    token = f"token-{req.role.value.lower()}-{uuid.uuid4().hex[:8]}"
    INVITE_TOKENS[token] = {
        "token": token,
        "role": req.role,
        "used": False
    }
    invite_url = f"/invite/{req.role.value.lower()}?token={token}"
    return {
        "token": token,
        "role": req.role.value,
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
    return {"valid": True, "role": invite_data["role"].value}

@router.post("/redeem")
def redeem_invite_token(req: RedeemInviteRequest):
    invite_data = INVITE_TOKENS.get(req.token)
    if not invite_data or invite_data["used"]:
        raise HTTPException(status_code=400, detail="Invalid or spent invitation token.")
    
    user = DB_USERS.get(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    # Promote user role
    user["role"] = invite_data["role"]
    invite_data["used"] = True
    return {
        "message": f"Successfully promoted to {invite_data['role'].value} role!",
        "user": user
    }
