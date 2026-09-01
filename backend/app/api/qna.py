from fastapi import APIRouter, HTTPException, Depends, Query, Header
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from backend.app.core.rbac import get_current_user, require_roles, UserRole
from backend.app.core.firestore import firestore_manager

router = APIRouter(prefix="/qna", tags=["Stage Q&A"])

QNA_QUEUE_DB = [
    {
        "id": "q-1",
        "author": "Pixel Dev",
        "user_id": "user-partic-1",
        "question": "How do AI Agents handle state synchronization across WebSockets?",
        "upvotes": 14,
        "upvoted_by": ["user-partic-1"],
        "displayed": True,
        "event_id": "devfest-bangkok-2026",
        "created_at": "2026-08-29T10:00:00Z"
    },
    {
        "id": "q-2",
        "author": "Cloud Enthusiast",
        "user_id": "user-partic-2",
        "question": "What is the cost model for Cloud Run auto-scaling with high WebSocket concurrency?",
        "upvotes": 8,
        "upvoted_by": [],
        "displayed": False,
        "event_id": "devfest-bangkok-2026",
        "created_at": "2026-08-29T10:30:00Z"
    }
]

class QuestionCreate(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    event_id: Optional[str] = "devfest-bangkok-2026"

class QueueReorderRequest(BaseModel):
    question_ids: List[str]
    event_id: Optional[str] = "devfest-bangkok-2026"

@router.get("")
def list_questions(
    event_id: Optional[str] = Query(None, description="Filter Q&A by event ID"),
    x_event_id: Optional[str] = Header(None, alias="x-event-id")
):
    target_event_id = event_id or x_event_id or "devfest-bangkok-2026"
    
    # Read from Firestore per-event collection (events/{event_id}/qna)
    fs_items = firestore_manager.list_qna(target_event_id)
    if fs_items:
        return fs_items

    # In-memory fallback
    return [q for q in QNA_QUEUE_DB if q.get("event_id", "devfest-bangkok-2026") == target_event_id]

@router.post("")
def submit_question(req: QuestionCreate, user: dict = Depends(get_current_user)):
    target_event_id = req.event_id or "devfest-bangkok-2026"
    q_id = f"q-{uuid.uuid4().hex[:6]}"
    q = {
        "id": q_id,
        "author": user.get("display_name", "Participant"),
        "user_id": user.get("id", "anonymous"),
        "question": req.question.strip(),
        "upvotes": 1,
        "upvoted_by": [user.get("id", "anonymous")],
        "displayed": False,
        "event_id": target_event_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    QNA_QUEUE_DB.append(q)

    # Save to Firestore per-event collection (events/{event_id}/qna/{q_id})
    if firestore_manager.is_configured():
        firestore_manager.save_qna(target_event_id, q)

    return {"message": "Question submitted to stage Q&A queue!", "question": q}

@router.post("/{qna_id}/upvote")
def upvote_question(
    qna_id: str,
    event_id: Optional[str] = Query(None),
    x_event_id: Optional[str] = Header(None, alias="x-event-id"),
    user: dict = Depends(get_current_user)
):
    target_event_id = event_id or x_event_id or "devfest-bangkok-2026"
    user_id = user.get("id", "anonymous")

    # Upvote in memory
    item = next((q for q in QNA_QUEUE_DB if q["id"] == qna_id), None)
    if item:
        if "upvoted_by" not in item:
            item["upvoted_by"] = []
        if user_id in item["upvoted_by"]:
            item["upvoted_by"].remove(user_id)
            item["upvotes"] = max(0, item["upvotes"] - 1)
            has_upvoted = False
        else:
            item["upvoted_by"].append(user_id)
            item["upvotes"] = item["upvotes"] + 1
            has_upvoted = True
    else:
        has_upvoted = True

    # Upvote in Firestore
    if firestore_manager.is_configured():
        firestore_manager.upvote_qna(target_event_id, qna_id, user_id)

    return {
        "message": "Upvote updated",
        "qna_id": qna_id,
        "upvotes": item["upvotes"] if item else 1,
        "has_upvoted": has_upvoted
    }

@router.post("/reorder", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def reorder_qna_queue(req: QueueReorderRequest):
    global QNA_QUEUE_DB
    reordered = []
    for q_id in req.question_ids:
        item = next((q for q in QNA_QUEUE_DB if q["id"] == q_id), None)
        if item:
            reordered.append(item)
    for item in QNA_QUEUE_DB:
        if item not in reordered:
            reordered.append(item)
    QNA_QUEUE_DB = reordered
    return {"message": "Q&A queue order updated", "queue": QNA_QUEUE_DB}

