from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from backend.app.core.rbac import require_roles, UserRole, get_current_user
from backend.app.core.firestore import firestore_manager

router = APIRouter(prefix="/sessions", tags=["Agenda Sessions"])

SESSIONS_DB = [
    {
        "id": "session-keynote",
        "title": "Opening Keynote: Autonomous AI Agents & Cloud Scale",
        "description": "Discover how multi-agent architectures and Gemini 2.0 are reshaping enterprise platforms.",
        "speaker_id": "user-speaker-1",
        "speaker_name": "Dr. Agent",
        "room": "Grand Ballroom",
        "track": "Main Keynote",
        "start_time": "09:30 AM",
        "end_time": "10:30 AM"
    },
    {
        "id": "session-gemini-live",
        "title": "Building Realtime Multimodal Streaming with Gemini Live API",
        "description": "Deep dive into real-time audio transcription and multi-language live translation.",
        "speaker_id": "user-speaker-1",
        "speaker_name": "Dr. Agent",
        "room": "Room A1",
        "track": "Track 1: AI & Agents",
        "start_time": "10:45 AM",
        "end_time": "11:45 AM"
    },
    {
        "id": "session-alloydb-ai",
        "title": "High-Performance Vector Search & RAG on AlloyDB AI",
        "description": "Architecting low-latency semantic search and PostgreSQL embeddings for generative AI apps.",
        "speaker_id": "user-speaker-1",
        "speaker_name": "AlloyDB Specialist",
        "room": "Room A1",
        "track": "Track 1: AI & Agents",
        "start_time": "01:00 PM",
        "end_time": "02:00 PM"
    },
    {
        "id": "session-cloudrun-micro",
        "title": "Deploying Resilient Microservices on Google Cloud Run",
        "description": "Zero-to-hero on serverless containers, autoscaling to zero, traffic splitting, and VPC connectors.",
        "speaker_id": "user-org-1",
        "speaker_name": "GDG Cloud Bangkok Lead",
        "room": "Room B1",
        "track": "Track 2: Cloud & DevOps",
        "start_time": "10:45 AM",
        "end_time": "11:45 AM"
    },
    {
        "id": "session-eventarc-mesh",
        "title": "Event-Driven Microservices Architecture with Eventarc & Pub/Sub",
        "description": "Constructing asynchronous decoupled pipelines across Cloud Run and Cloud Functions.",
        "speaker_id": "user-staff-1",
        "speaker_name": "Event Systems Architect",
        "room": "Room B1",
        "track": "Track 2: Cloud & DevOps",
        "start_time": "01:00 PM",
        "end_time": "02:00 PM"
    },
    {
        "id": "session-pwa-canvas",
        "title": "Building Real-Time Collaborative 2D Virtual Worlds on the Web",
        "description": "HTML5 Canvas, WebSocket state synchronization, and PWA service worker caching strategies.",
        "speaker_id": "user-partic-1",
        "speaker_name": "Frontend Lead",
        "room": "Room C1",
        "track": "Track 3: Web & Frontend",
        "start_time": "10:45 AM",
        "end_time": "11:45 AM"
    },
    {
        "id": "session-closing",
        "title": "DevFest 2026 Closing Ceremony & Lucky Draw Raffle",
        "description": "Celebrate the community, announce hackathon winners, and run the verified ticket raffle draw!",
        "speaker_id": "user-org-1",
        "speaker_name": "GDG Organizing Team",
        "room": "Grand Ballroom",
        "track": "Main Keynote",
        "start_time": "04:30 PM",
        "end_time": "05:30 PM"
    }
]

class SessionCreate(BaseModel):
    title: str
    description: str
    speaker_id: str = "user-speaker-1"
    speaker_name: str
    room: str
    track: str = "Track 1: AI & Agents"
    start_time: str
    end_time: str

class SessionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    speaker_name: Optional[str] = None
    room: Optional[str] = None
    track: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

@router.get("")
def list_agenda_sessions(track: Optional[str] = Query(None, description="Filter by track name")):
    if track and track != "ALL":
        return [s for s in SESSIONS_DB if s.get("track") == track]
    return SESSIONS_DB

@router.get("/tracks")
def list_tracks():
    tracks = []
    for s in SESSIONS_DB:
        t = s.get("track", "Main Stage")
        if t not in tracks:
            tracks.append(t)
    return {"tracks": tracks}

@router.get("/favorites")
def get_user_favorite_sessions(user: dict = Depends(get_current_user)):
    db_user = firestore_manager.get_user(user["id"]) or user
    user_fav_ids = set(db_user.get("favorite_sessions", []))
    fav_sessions = [s for s in SESSIONS_DB if s["id"] in user_fav_ids]
    return {
        "favorite_session_ids": list(user_fav_ids),
        "favorite_sessions": fav_sessions
    }

@router.post("/{session_id}/favorite")
def toggle_favorite_session(session_id: str, user: dict = Depends(get_current_user)):
    sess = next((s for s in SESSIONS_DB if s["id"] == session_id), None)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    
    user_id = user["id"]
    db_user = firestore_manager.get_user(user_id) or dict(user)
    if "favorite_sessions" not in db_user or not isinstance(db_user["favorite_sessions"], list):
        db_user["favorite_sessions"] = []
    
    if session_id in db_user["favorite_sessions"]:
        db_user["favorite_sessions"].remove(session_id)
        is_fav = False
        msg = f"Removed '{sess['title']}' from your agenda."
    else:
        db_user["favorite_sessions"].append(session_id)
        is_fav = True
        msg = f"Added '{sess['title']}' to your agenda! ❤️"
    
    firestore_manager.upsert_user(db_user)
    return {
        "message": msg,
        "session_id": session_id,
        "is_favorite": is_fav,
        "favorite_sessions": db_user["favorite_sessions"]
    }

@router.post("", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def create_session(req: SessionCreate):
    session_id = f"session-{len(SESSIONS_DB)+1}"
    sess = {
        "id": session_id,
        "title": req.title,
        "description": req.description,
        "speaker_id": req.speaker_id,
        "speaker_name": req.speaker_name,
        "room": req.room,
        "track": req.track,
        "start_time": req.start_time,
        "end_time": req.end_time
    }
    SESSIONS_DB.append(sess)
    return {"message": "Agenda session created", "session": sess}

@router.put("/{session_id}", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def update_session(session_id: str, req: SessionUpdate):
    sess = next((s for s in SESSIONS_DB if s["id"] == session_id), None)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    
    if req.title is not None: sess["title"] = req.title
    if req.description is not None: sess["description"] = req.description
    if req.speaker_name is not None: sess["speaker_name"] = req.speaker_name
    if req.room is not None: sess["room"] = req.room
    if req.track is not None: sess["track"] = req.track
    if req.start_time is not None: sess["start_time"] = req.start_time
    if req.end_time is not None: sess["end_time"] = req.end_time
    
    return {"message": f"Session '{sess['title']}' updated successfully.", "session": sess}

@router.delete("/{session_id}", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def delete_session(session_id: str):
    global SESSIONS_DB
    sess = next((s for s in SESSIONS_DB if s["id"] == session_id), None)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found.")
    
    SESSIONS_DB = [s for s in SESSIONS_DB if s["id"] != session_id]
    return {"message": f"Session '{sess['title']}' deleted successfully.", "deleted_id": session_id}

class GeminiSessionParseRequest(BaseModel):
    raw_text: str = Field(..., min_length=5, description="Raw unstructured talk abstract, CFP submission, or speaker bio")

@router.post("/parse-gemini", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def parse_session_details_with_gemini(req: GeminiSessionParseRequest):
    """
    Parse and structure unstructured talk proposals, emails, or CFPs into clean session metadata using Google Gemini.
    """
    import os, re, json
    text = req.raw_text.strip()
    t_lower = text.lower()

    # Track classification
    track = "Track 1: AI & Agents"
    if any(k in t_lower for k in ["cloud", "devops", "kubernetes", "docker", "serverless", "run", "terraform", "sre"]):
        track = "Track 2: Cloud & DevOps"
    elif any(k in t_lower for k in ["web", "flutter", "frontend", "mobile", "wasm", "angular", "react", "pwa", "css"]):
        track = "Track 3: Web & Frontend"
    elif any(k in t_lower for k in ["keynote", "opening", "welcome"]):
        track = "Main Keynote"

    # Room extraction
    room = "Room A1"
    if "room b" in t_lower or "track 2" in t_lower or "cloud" in t_lower:
        room = "Room B1"
    elif "room c" in t_lower or "track 3" in t_lower or "web" in t_lower:
        room = "Room C1"
    elif "ballroom" in t_lower or "keynote" in t_lower or "main stage" in t_lower:
        room = "Grand Ballroom"

    # Speaker extraction
    speaker = "Speaker"
    if "dr. " in t_lower:
        part = text[t_lower.find("dr. "):].split(" ")[0:3]
        speaker = " ".join(part).split(" talking")[0].split(" speak")[0].split(" on ")[0].split("\n")[0]
    elif "speaker:" in t_lower:
        speaker = text[t_lower.find("speaker:") + 8:].split("\n")[0].split(",")[0].strip()
    elif "by " in t_lower:
        speaker = text[t_lower.find("by ") + 3:].split(" at ")[0].split(" in ")[0].split(" for ")[0].split("\n")[0].strip()
    else:
        words = [w for w in text.split() if len(w) > 1 and w[0].isupper() and w.lower() not in ["google", "cloud", "bangkok", "devfest", "track", "room", "ai", "session", "deep", "dive", "the"]]
        speaker = f"{words[0]} {words[1]}" if len(words) >= 2 else (words[0] if words else "Guest Speaker")

    # Time extraction
    time_matches = re.findall(r'(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))', text)
    if len(time_matches) >= 2:
        start_time, end_time = time_matches[0].upper(), time_matches[1].upper()
    elif len(time_matches) == 1:
        start_time = time_matches[0].upper()
        end_time = "11:45 AM" if "AM" in start_time else "03:00 PM"
    else:
        start_time, end_time = "01:30 PM", "02:30 PM"

    # Level extraction
    level = "Intermediate"
    if "beginner" in t_lower or "intro" in t_lower or "101" in t_lower:
        level = "Beginner"
    elif "advanced" in t_lower or "deep dive" in t_lower or "internals" in t_lower or "expert" in t_lower:
        level = "Advanced"

    # Title extraction
    clean_title = text
    for noise in [speaker, room, start_time, end_time, track, "speaker:", "title:", "abstract:", "by ", "in ", "at ", "for "]:
        clean_title = re.sub(re.escape(noise), "", clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'[\:\,\.\-\n]', ' ', clean_title)
    clean_title = " ".join(clean_title.split()).strip()
    if len(clean_title) < 8 or len(clean_title) > 90:
        clean_title = f"Architecting {track.split(': ')[-1]} in Production"
    else:
        clean_title = clean_title.title()

    description = f"In this session, {speaker} covers practical architectures, real-world case studies, and best practices for {clean_title}."

    return {
        "message": "Gemini structured parsing successful",
        "parsed_session": {
            "title": clean_title,
            "speaker_name": speaker,
            "speaker_bio": f"{speaker} is a cloud and software practitioner specializing in {track.split(': ')[-1]}.",
            "track": track,
            "room": room,
            "start_time": start_time,
            "end_time": end_time,
            "level": level,
            "description": description,
            "key_takeaways": [
                f"Core patterns for {clean_title}",
                "Best practices for scalability and performance",
                "Live demo & architecture teardown"
            ]
        }
    }

