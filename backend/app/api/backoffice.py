from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from backend.app.core.rbac import require_roles, UserRole, DB_USERS, get_current_user

router = APIRouter(prefix="/backoffice", tags=["Comprehensive Back Office APIs"])

class ChangeUserRoleRequest(BaseModel):
    user_id: str
    new_role: UserRole

class LessonLearnedCreate(BaseModel):
    title: str
    summary: str
    tags: List[str]

LESSONS_LEARNED_DB = [
    {"id": "lesson-1", "title": "WebSocket Realtime Presence Scalability", "summary": "MemoryStore Redis cluster handled 500+ concurrent 2D player movements smoothly.", "tags": ["redis", "websockets", "cloud-run"]}
]

@router.get("/active-users", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def list_active_users():
    return {
        "total_active_count": len(DB_USERS),
        "users": list(DB_USERS.values())
    }

@router.post("/change-role", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def change_user_role(req: ChangeUserRoleRequest):
    user = DB_USERS.get(req.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    old_role = user["role"]
    user["role"] = req.new_role
    return {
        "message": f"User '{user['display_name']}' role changed from {old_role} to {req.new_role.value}",
        "user": user
    }

@router.get("/lessons-learned")
def list_lessons_learned():
    return LESSONS_LEARNED_DB

@router.post("/lessons-learned", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def create_lesson_learned(req: LessonLearnedCreate):
    item = {
        "id": f"lesson-{len(LESSONS_LEARNED_DB)+1}",
        "title": req.title,
        "summary": req.summary,
        "tags": req.tags
    }
    LESSONS_LEARNED_DB.append(item)
    return {"message": "Lesson Learned retrospective published", "lesson": item}
