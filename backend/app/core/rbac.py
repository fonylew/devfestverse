from enum import Enum
from typing import List, Callable
from fastapi import HTTPException, status, Depends, Header
from backend.app.core.firestore import firestore_manager, IN_MEMORY_USERS

class UserRole(str, Enum):
    ORGANIZER = "ORGANIZER"
    STAFF = "STAFF"
    SPEAKER = "SPEAKER"
    SPONSOR = "SPONSOR"
    PARTICIPANT = "PARTICIPANT"

# Live reference to in-memory / cache store for backwards compatibility
DB_USERS = IN_MEMORY_USERS

def get_current_user(
    x_user_id: str = Header(default="user-partic-1"),
    x_event_id: str = Header(default="devfest-bangkok-2026")
):
    user = firestore_manager.get_user(x_user_id)
    if not user:
        # Default transient participant registered into Firestore
        user = {
            "id": x_user_id,
            "email": f"{x_user_id}@devfestverse.io",
            "display_name": "Guest Participant",
            "global_role": UserRole.PARTICIPANT.value,
            "role": UserRole.PARTICIPANT.value,
            "verified_ticket": False,
            "ticket_ref": None,
            "auth_provider": "local",
            "events": {
                x_event_id: {
                    "role": UserRole.PARTICIPANT.value,
                    "ticket_ref": None,
                    "verified_ticket": False,
                    "attended": False
                }
            }
        }
        user = firestore_manager.upsert_user(user)
    
    # Resolve event-specific role and ticket context
    event_role_info = firestore_manager.get_user_role_in_event(user["id"], x_event_id)
    context_user = dict(user)
    context_user["active_event_id"] = x_event_id
    context_user["effective_role"] = event_role_info["role"]
    context_user["role"] = event_role_info["role"]
    context_user["ticket_ref"] = event_role_info["ticket_ref"]
    context_user["verified_ticket"] = event_role_info["verified_ticket"]
    context_user["attended"] = event_role_info.get("attended", False)
    
    return context_user


def require_roles(allowed_roles: List[UserRole]):
    allowed_values = [r.value if isinstance(r, UserRole) else str(r) for r in allowed_roles]
    def role_checker(user: dict = Depends(get_current_user)):
        user_role = user.get("role")
        if isinstance(user_role, UserRole):
            user_role = user_role.value
        if user_role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' not authorized. Allowed: {allowed_values}"
            )
        return user
    return role_checker

