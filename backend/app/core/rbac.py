from enum import Enum
from typing import List, Callable
from fastapi import HTTPException, status, Depends, Header

class UserRole(str, Enum):
    ORGANIZER = "ORGANIZER"
    STAFF = "STAFF"
    SPEAKER = "SPEAKER"
    SPONSOR = "SPONSOR"
    PARTICIPANT = "PARTICIPANT"

# In-memory mock user DB for state demonstration
DB_USERS = {
    "user-org-1": {"id": "user-org-1", "email": "organizer@gdgcloudbkk.org", "display_name": "GDG Lead", "role": UserRole.ORGANIZER, "verified_ticket": True, "ticket_ref": "TICKET-DEV-001"},
    "user-staff-1": {"id": "user-staff-1", "email": "staff@gdgcloudbkk.org", "display_name": "Event Staff", "role": UserRole.STAFF, "verified_ticket": True, "ticket_ref": "TICKET-DEV-002"},
    "user-speaker-1": {"id": "user-speaker-1", "email": "speaker@ai-agents.io", "display_name": "Dr. Agent", "role": UserRole.SPEAKER, "verified_ticket": True, "ticket_ref": "TICKET-DEV-003"},
    "user-sponsor-1": {"id": "user-sponsor-1", "email": "sponsor@google.com", "display_name": "Google Cloud", "role": UserRole.SPONSOR, "verified_ticket": True, "ticket_ref": "TICKET-DEV-004"},
    "user-partic-1": {"id": "user-partic-1", "email": "dev@bangkok.io", "display_name": "Pixel Dev", "role": UserRole.PARTICIPANT, "verified_ticket": False, "ticket_ref": None},
}

def get_current_user(x_user_id: str = Header(default="user-partic-1")):
    user = DB_USERS.get(x_user_id)
    if not user:
        # Default transient participant
        user = {
            "id": x_user_id,
            "email": f"{x_user_id}@devfestverse.io",
            "display_name": "Guest Participant",
            "role": UserRole.PARTICIPANT,
            "verified_ticket": False,
            "ticket_ref": None
        }
        DB_USERS[x_user_id] = user
    return user

def require_roles(allowed_roles: List[UserRole]):
    def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user['role']}' not authorized. Allowed: {[r.value for r in allowed_roles]}"
            )
        return user
    return role_checker
