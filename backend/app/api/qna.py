from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from backend.app.core.rbac import get_current_user, require_roles, UserRole

router = APIRouter(prefix="/qna", tags=["Q&A"])

QNA_QUEUE_DB = [
    {"id": "q-1", "author": "Pixel Dev", "question": "How do AI Agents handle state synchronization across WebSockets?", "upvotes": 14, "displayed": True},
    {"id": "q-2", "author": "Cloud Enthusiast", "question": "What is the cost model for Cloud Run auto-scaling?", "upvotes": 8, "displayed": False}
]

class QuestionCreate(BaseModel):
    question: str

class QueueReorderRequest(BaseModel):
    question_ids: List[str]

@router.get("")
def list_questions():
    return QNA_QUEUE_DB

@router.post("")
def submit_question(req: QuestionCreate, user: dict = Depends(get_current_user)):
    q = {
        "id": f"q-{len(QNA_QUEUE_DB)+1}",
        "author": user.get("display_name", "Participant"),
        "question": req.question,
        "upvotes": 1,
        "displayed": False
    }
    QNA_QUEUE_DB.append(q)
    return {"message": "Question submitted successfully", "question": q}

@router.post("/reorder", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def reorder_qna_queue(req: QueueReorderRequest):
    global QNA_QUEUE_DB
    reordered = []
    for q_id in req.question_ids:
        item = next((q for q in QNA_QUEUE_DB if q["id"] == q_id), None)
        if item:
            reordered.append(item)
    # Add any remaining unlisted items
    for item in QNA_QUEUE_DB:
        if item not in reordered:
            reordered.append(item)
    QNA_QUEUE_DB = reordered
    return {"message": "Q&A queue order updated", "queue": QNA_QUEUE_DB}
