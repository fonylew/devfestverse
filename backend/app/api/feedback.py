from fastapi import APIRouter, HTTPException, Depends, Query, Header
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from backend.app.core.rbac import get_current_user, require_roles, UserRole
from backend.app.core.firestore import firestore_manager

router = APIRouter(prefix="/feedback", tags=["Feedback"])

FEEDBACK_SETTINGS = {"enabled": True}
FEEDBACK_ITEMS = [
    {
        "id": "fb-1",
        "user_id": "user-demo-1",
        "user_name": "Alex Dev",
        "overall_rating": 5,
        "content_rating": 5,
        "venue_rating": 4,
        "nps_score": 10,
        "comments": "The 2D virtual venue and live Gemini transcripts were mind-blowing!",
        "event_id": "devfest-bangkok-2026",
        "created_at": "2026-08-29T14:30:00Z"
    },
    {
        "id": "fb-2",
        "user_id": "user-demo-2",
        "user_name": "Sara Cloud",
        "overall_rating": 5,
        "content_rating": 4,
        "venue_rating": 5,
        "nps_score": 9,
        "comments": "Loved the avatar studio and interactive sponsor booths. Great community vibes!",
        "event_id": "devfest-bangkok-2026",
        "created_at": "2026-08-29T15:15:00Z"
    }
]

class FeedbackSubmission(BaseModel):
    # Section 1: Feedback for Event
    overall_rating: int = Field(5, ge=1, le=5)
    content_rating: Optional[int] = Field(5, ge=1, le=5)
    venue_rating: Optional[int] = Field(5, ge=1, le=5)
    nps_score: Optional[int] = Field(10, ge=0, le=10)
    comments: Optional[str] = ""
    event_comments: Optional[str] = ""

    # Section 2: Feedback for Platform (DevFestVerse)
    platform_rating: Optional[int] = Field(5, ge=1, le=5)
    platform_avatar_rating: Optional[int] = Field(5, ge=1, le=5)
    platform_navigation_rating: Optional[int] = Field(5, ge=1, le=5)
    platform_comments: Optional[str] = ""

    event_id: Optional[str] = "devfest-bangkok-2026"

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
        raise HTTPException(status_code=400, detail="Feedback collection is currently closed.")
    
    target_event_id = req.event_id or "devfest-bangkok-2026"
    event_comm = (req.event_comments or req.comments or "").strip()
    plat_comm = (req.platform_comments or "").strip()
    combined_comments = event_comm
    if plat_comm:
        combined_comments = f"Event: {event_comm} | Platform: {plat_comm}" if event_comm else plat_comm

    fb = {
        "id": f"fb-{len(FEEDBACK_ITEMS)+1}",
        "user_id": user.get("id", "anonymous"),
        "user_name": user.get("display_name", "Attendee"),
        # Section 1: Event
        "overall_rating": req.overall_rating,
        "content_rating": req.content_rating or req.overall_rating,
        "venue_rating": req.venue_rating or req.overall_rating,
        "nps_score": req.nps_score if req.nps_score is not None else 10,
        "event_comments": event_comm,
        # Section 2: Platform
        "platform_rating": req.platform_rating or req.overall_rating,
        "platform_avatar_rating": req.platform_avatar_rating or 5,
        "platform_navigation_rating": req.platform_navigation_rating or 5,
        "platform_comments": plat_comm,
        # General
        "comments": combined_comments,
        "event_id": target_event_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    FEEDBACK_ITEMS.append(fb)

    # Save to Firestore per-event collection (events/{event_id}/feedbacks)
    if firestore_manager.is_configured():
        firestore_manager.save_feedback(target_event_id, fb)

    return {"message": "Thank you! Your feedback for the event & platform has been recorded.", "feedback": fb}

@router.get("/all", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def list_all_feedback(
    event_id: Optional[str] = Query(None, description="Filter feedback by Event ID"),
    x_event_id: Optional[str] = Header(None, alias="x-event-id")
):
    target_event_id = event_id or x_event_id or "devfest-bangkok-2026"
    
    # Read from Firestore per-event if configured
    fs_items = firestore_manager.list_feedback(target_event_id)
    feedbacks = fs_items if fs_items else [f for f in FEEDBACK_ITEMS if f.get("event_id", "devfest-bangkok-2026") == target_event_id]
    if not feedbacks and not event_id:
        feedbacks = FEEDBACK_ITEMS

    total = len(feedbacks)
    # Event averages
    avg_overall = sum(f.get("overall_rating", 5) for f in feedbacks) / total if total else 5.0
    avg_content = sum(f.get("content_rating", 5) for f in feedbacks) / total if total else 5.0
    avg_venue = sum(f.get("venue_rating", 5) for f in feedbacks) / total if total else 5.0
    
    # Platform averages
    avg_platform = sum(f.get("platform_rating", 5) for f in feedbacks) / total if total else 5.0
    avg_platform_nav = sum(f.get("platform_navigation_rating", 5) for f in feedbacks) / total if total else 5.0

    promoters = sum(1 for f in feedbacks if f.get("nps_score", 10) >= 9)
    detractors = sum(1 for f in feedbacks if f.get("nps_score", 10) <= 6)
    nps = int(((promoters - detractors) / total) * 100) if total else 100

    return {
        "event_id": target_event_id,
        "total_responses": total,
        "average_overall": round(avg_overall, 2),
        "average_content": round(avg_content, 2),
        "average_venue": round(avg_venue, 2),
        "average_platform": round(avg_platform, 2),
        "average_platform_nav": round(avg_platform_nav, 2),
        "nps_score": nps,
        "feedbacks": feedbacks
    }
