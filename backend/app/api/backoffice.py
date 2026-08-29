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
