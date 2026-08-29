from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from backend.app.core.rbac import require_roles, UserRole, get_current_user

router = APIRouter(prefix="/announcements", tags=["Announcements"])

PUBLIC_ANNOUNCEMENTS = [
    {"id": "ann-1", "channel": "PUBLIC", "message": "Welcome to DevFestVerse! Verify your official ticket at the Main Entrance billboard.", "priority": "HIGH"}
]
STAFF_ANNOUNCEMENTS = [
    {"id": "ann-staff-1", "channel": "STAFF", "message": "Staff Team Alert: Keynote speaker is ready at Main Stage.", "priority": "URGENT"}
]

class CreateAnnouncement(BaseModel):
    channel: str = "PUBLIC" # "PUBLIC" or "STAFF"
    message: str
    priority: str = "NORMAL"

@router.get("/public")
def list_public_announcements():
    return PUBLIC_ANNOUNCEMENTS

@router.get("/staff", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def list_staff_announcements():
    return STAFF_ANNOUNCEMENTS

@router.post("", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def create_announcement(req: CreateAnnouncement):
    ann = {
        "id": f"ann-{len(PUBLIC_ANNOUNCEMENTS)+len(STAFF_ANNOUNCEMENTS)+1}",
        "channel": req.channel.upper(),
        "message": req.message,
        "priority": req.priority
    }
    if req.channel.upper() == "STAFF":
        STAFF_ANNOUNCEMENTS.append(ann)
    else:
        PUBLIC_ANNOUNCEMENTS.append(ann)
    return {"message": f"Announcement published to {req.channel.upper()} channel", "announcement": ann}
