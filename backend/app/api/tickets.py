from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from backend.app.core.rbac import DB_USERS, get_current_user
from backend.app.core.config import settings

router = APIRouter(prefix="/tickets", tags=["Main Event Tickets"])

# Valid Official Roster Mock DB
OFFICIAL_TICKETS = {
    "TICKET-DEV-001": {"ticket_ref": "TICKET-DEV-001", "email": "organizer@gdgcloudbkk.org"},
    "TICKET-DEV-002": {"ticket_ref": "TICKET-DEV-002", "email": "staff@gdgcloudbkk.org"},
    "TICKET-DEV-003": {"ticket_ref": "TICKET-DEV-003", "email": "speaker@ai-agents.io"},
    "TICKET-DEV-004": {"ticket_ref": "TICKET-DEV-004", "email": "sponsor@google.com"},
    "TICKET-DEV-100": {"ticket_ref": "TICKET-DEV-100", "email": "dev@bangkok.io"},
}

class VerifyTicketRequest(BaseModel):
    ticket_ref: str

@router.get("/info")
def get_ticket_system_info():
    return {
        "official_registration_url": settings.DEFAULT_TICKET_REGISTRATION_URL,
        "verification_active": True
    }

from backend.app.core.firestore import firestore_manager

@router.post("/verify")
def verify_official_ticket(req: VerifyTicketRequest, user: dict = Depends(get_current_user)):
    ticket_clean = req.ticket_ref.upper().strip()
    ticket = OFFICIAL_TICKETS.get(ticket_clean)
    if not ticket:
        raise HTTPException(
            status_code=400,
            detail=f"Ticket reference '{req.ticket_ref}' not found in official DevFest roster. Please register at {settings.DEFAULT_TICKET_REGISTRATION_URL}"
        )
    
    user_id = user["id"]
    event_id = user.get("active_event_id", "devfest-bangkok-2026")
    current_role = user.get("role", "PARTICIPANT")
    
    # Persist ticket verification directly into Firestore
    saved_user = firestore_manager.set_user_event_role(
        user_id=user_id,
        event_id=event_id,
        role=current_role,
        ticket_ref=ticket_clean,
        verified=True
    )
    
    user["verified_ticket"] = True
    user["ticket_ref"] = ticket_clean
    return {
        "message": "Official DevFest Ticket verified successfully!",
        "verified_badge": "Verified Ticket Badge",
        "unlocked_features": ["Lucky Draw Raffle Entry", "Workshop Priority Reservation"],
        "user": saved_user or user
    }
