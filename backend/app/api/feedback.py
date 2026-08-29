from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from backend.app.core.rbac import get_current_user, require_roles, UserRole

router = APIRouter(prefix="/feedback", tags=["Feedback"])

FEEDBACK_SETTINGS = {"enabled": True}
FEEDBACK_ITEMS = []

class FeedbackSubmission(BaseModel):
    rating: int
    comments: str

@router.get("/settings")
def get_feedback_settings():
    return FEEDBACK_SETTINGS

@router.post("/toggle", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def toggle_feedback_session(enabled: bool):
    FEEDBACK_SETTINGS["enabled"] = enabled
    return {"message": f"Feedback collection {'enabled' if enabled else 'disabled'}", "enabled": enabled}

@router.post("")
def submit_feedback(req: FeedbackSubmission, user: dict = Depends(get_current_user)):
    if not FEEDBACK_SETTINGS["enabled"]:
        raise HTTPException(status_code=400, detail="Feedback session is currently closed.")
    fb = {
        "user_id": user["id"],
        "rating": req.rating,
        "comments": req.comments
    }
    FEEDBACK_ITEMS.append(fb)
    return {"message": "Thank you for your feedback!", "feedback": fb}

@router.get("/all", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def list_all_feedback():
    return FEEDBACK_ITEMS
