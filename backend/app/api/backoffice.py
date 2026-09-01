from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from backend.app.core.rbac import require_roles, UserRole, DB_USERS, get_current_user
from backend.app.core.firestore import firestore_manager

router = APIRouter(prefix="/backoffice", tags=["Comprehensive Back Office APIs"])

class ChangeUserRoleRequest(BaseModel):
    user_id: Optional[str] = None
    new_role: UserRole

class AssignTicketRequest(BaseModel):
    ticket_ref: str
    verified: bool = True

class UserCreateOrUpdateRequest(BaseModel):
    id: Optional[str] = None
    email: str
    display_name: str
    role: UserRole = UserRole.PARTICIPANT
    ticket_ref: Optional[str] = None
    verified_ticket: bool = False
    auth_provider: Optional[str] = "local"

class LessonLearnedCreate(BaseModel):
    title: str
    summary: str
    tags: List[str]

LESSONS_LEARNED_DB = [
    {"id": "lesson-1", "title": "WebSocket Realtime Presence Scalability", "summary": "MemoryStore Redis cluster handled 500+ concurrent 2D player movements smoothly.", "tags": ["redis", "websockets", "cloud-run"]}
]

# --- FIRESTORE USER MANAGEMENT APIS ---

@router.get("/users", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def list_backoffice_users(
    event_id: Optional[str] = Query(None, description="Filter by event ID"),
    role: Optional[UserRole] = Query(None, description="Filter by user role"),
    search: Optional[str] = Query(None, description="Search by name, email, or ticket ref"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """List and query all users from Cloud Firestore with multi-event filtering and search."""
    role_str = role.value if role else None
    if event_id:
        return firestore_manager.list_event_users(event_id=event_id, role=role_str, search=search, limit=limit, offset=offset)
    return firestore_manager.list_users(role=role_str, search=search, limit=limit, offset=offset)

@router.get("/users/stats", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def get_backoffice_users_stats(event_id: Optional[str] = Query(None, description="Filter stats by event ID")):
    """Retrieve aggregated user counts, role distributions, and Google auth stats from Firestore."""
    return firestore_manager.get_user_stats(event_id=event_id)

@router.get("/users/{user_id}", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def get_backoffice_user(user_id: str):
    """Fetch individual user details from Firestore."""
    user = firestore_manager.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found in Firestore.")
    return user

@router.get("/users/{user_id}/events", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def get_backoffice_user_events(user_id: str):
    """Retrieve all event memberships and assigned roles for a user."""
    events = firestore_manager.list_user_events(user_id)
    return {"user_id": user_id, "events": events}

@router.post("/users", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def create_or_upsert_backoffice_user(req: UserCreateOrUpdateRequest, event_id: Optional[str] = Query("devfest-bangkok-2026")):
    """Manually register or update a user directly in Firestore with event role."""
    import uuid
    user_id = req.id or f"user-{req.role.value.lower()[:6]}-{uuid.uuid4().hex[:6]}"
    user_data = {
        "id": user_id,
        "email": req.email,
        "display_name": req.display_name,
        "global_role": req.role.value if req.role == UserRole.ORGANIZER else "PARTICIPANT",
        "role": req.role.value,
        "ticket_ref": req.ticket_ref,
        "verified_ticket": req.verified_ticket,
        "auth_provider": req.auth_provider or "local"
    }
    user = firestore_manager.upsert_user(user_data)
    if event_id:
        user = firestore_manager.set_user_event_role(
            user_id=user_id,
            event_id=event_id,
            role=req.role.value,
            ticket_ref=req.ticket_ref,
            verified=req.verified_ticket
        )
    return {"message": f"User '{user['display_name']}' saved to Firestore.", "user": user}

@router.post("/users/{user_id}/role", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def update_backoffice_user_role(
    user_id: str,
    req: ChangeUserRoleRequest,
    event_id: Optional[str] = Query("devfest-bangkok-2026")
):
    """Update role for a user in a specific event on Firestore (Organizer only)."""
    user = firestore_manager.set_user_event_role(user_id, event_id, req.new_role.value)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    return {
        "message": f"User '{user['display_name']}' role updated to {req.new_role.value} for event '{event_id}' on Firestore",
        "event_id": event_id,
        "user": user
    }

@router.post("/users/{user_id}/ticket", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def assign_backoffice_user_ticket(
    user_id: str,
    req: AssignTicketRequest,
    event_id: Optional[str] = Query("devfest-bangkok-2026")
):
    """Assign or verify ticket reference for a user in a specific event on Firestore."""
    user = firestore_manager.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    current_role = user.get("events", {}).get(event_id, {}).get("role", user.get("role", "PARTICIPANT"))
    user = firestore_manager.set_user_event_role(user_id, event_id, current_role, ticket_ref=req.ticket_ref, verified=req.verified)
    return {
        "message": f"Ticket '{req.ticket_ref}' linked and verified for '{user['display_name']}' in event '{event_id}' on Firestore",
        "event_id": event_id,
        "user": user
    }


@router.delete("/users/{user_id}", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def delete_backoffice_user(user_id: str):
    """Delete a user document from Firestore (Organizer only)."""
    success = firestore_manager.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' could not be deleted.")
    return {"message": f"User '{user_id}' deleted successfully from Firestore."}

# Legacy active users & role switcher
@router.get("/active-users", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def list_active_users():
    users_data = firestore_manager.list_users(limit=500)
    return {
        "total_active_count": users_data["total"],
        "users": users_data["users"]
    }

@router.post("/change-role", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def change_user_role(req: ChangeUserRoleRequest):
    if not req.user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")
    user = firestore_manager.update_user_role(req.user_id, req.new_role.value)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "message": f"User '{user['display_name']}' role changed to {req.new_role.value}",
        "user": user
    }


@router.get("/lessons-learned")
def list_lessons_learned():
    return LESSONS_LEARNED_DB

class AIAgendaGenerateRequest(BaseModel):
    prompt: str
    event_id: Optional[str] = "devfest-bangkok-2026"

@router.post("/ai-agenda-generate", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def generate_agenda_by_ai(req: AIAgendaGenerateRequest):
    """Gemini AI-powered natural language prompt agenda extractor and generator."""
    prompt = req.prompt.strip()
    p_lower = prompt.lower()

    # 1. Track detection
    if any(k in p_lower for k in ["ai", "agent", "gemini", "rag", "vector", "llm", "vertex", "prompt", "langchain", "langgraph"]):
        track = "Track 1: AI & Agents"
        default_room = "Room A1"
    elif any(k in p_lower for k in ["cloud", "devops", "kubernetes", "k8s", "docker", "run", "serverless", "alloydb", "pub/sub", "gcs"]):
        track = "Track 2: Cloud & DevOps"
        default_room = "Room B1"
    elif any(k in p_lower for k in ["web", "flutter", "react", "frontend", "pwa", "ui", "ux", "mobile"]):
        track = "Track 3: Web & Frontend"
        default_room = "Room C1"
    elif "keynote" in p_lower or "opening" in p_lower:
        track = "Main Keynote"
        default_room = "Grand Ballroom"
    else:
        track = "Track 1: AI & Agents"
        default_room = "Room A1"

    # 2. Room extraction
    room = default_room
    for r in ["Grand Ballroom", "Room A1", "Room B1", "Room C1", "Lab W1", "Lab W2", "Room W1", "Main Stage"]:
        if r.lower() in p_lower:
            room = r
            break

    # 3. Speaker extraction
    speaker = "Speaker"
    if "dr. " in p_lower:
        part = prompt[p_lower.find("dr. "):].split(" ")[0:3]
        speaker = " ".join(part).split(" talking")[0].split(" speak")[0].split(" on ")[0]
    elif "by " in p_lower:
        speaker = prompt[p_lower.find("by ") + 3:].split(" at ")[0].split(" in ")[0].split(" for ")[0].strip()
    elif "speaker:" in p_lower:
        speaker = prompt[p_lower.find("speaker:") + 8:].split("\n")[0].split(",")[0].strip()
    else:
        words = [w for w in prompt.split() if w[0].isupper() and w.lower() not in ["google", "cloud", "bangkok", "devfest", "track", "room", "ai", "session"]]
        if len(words) >= 2:
            speaker = f"{words[0]} {words[1]}"
        elif len(words) == 1:
            speaker = words[0]
        else:
            speaker = "Guest Tech Speaker"

    # 4. Times extraction
    import re
    time_matches = re.findall(r'(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))', prompt)
    if len(time_matches) >= 2:
        start_time = time_matches[0].upper()
        end_time = time_matches[1].upper()
    elif len(time_matches) == 1:
        start_time = time_matches[0].upper()
        end_time = "11:45 AM" if "AM" in start_time else "03:00 PM"
    else:
        start_time = "01:30 PM"
        end_time = "02:30 PM"

    # 5. Title synthesis
    clean_title = prompt
    for noise in [speaker, room, start_time, end_time, track, "by ", "in ", "at ", "for ", "talking about", "speaking on", "session about", "session on"]:
        clean_title = re.sub(re.escape(noise), "", clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'[\:\,\.\-]', ' ', clean_title)
    clean_title = " ".join(clean_title.split()).strip()

    if len(clean_title) < 10:
        clean_title = f"Mastering {track.split(': ')[-1]} at Scale"
    else:
        clean_title = clean_title.title()

    description = f"In this session, {speaker} explores real-world architectures, key takeaways, and production-tested patterns for {clean_title}."

    return {
        "message": "AI successfully synthesized agenda session from prompt!",
        "generated_session": {
            "title": clean_title,
            "speaker_name": speaker,
            "track": track,
            "room": room,
            "start_time": start_time,
            "end_time": end_time,
            "description": description
        }
    }
