from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from backend.app.core.rbac import require_roles, UserRole, get_current_user

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
    user_fav_ids = set(user.get("favorite_sessions", []))
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
    
    if "favorite_sessions" not in user:
        user["favorite_sessions"] = []
    
    if session_id in user["favorite_sessions"]:
        user["favorite_sessions"].remove(session_id)
        is_fav = False
        msg = f"Removed '{sess['title']}' from your agenda."
    else:
        user["favorite_sessions"].append(session_id)
        is_fav = True
        msg = f"Added '{sess['title']}' to your agenda! ❤️"
    
    return {
        "message": msg,
        "session_id": session_id,
        "is_favorite": is_fav,
        "favorite_sessions": user["favorite_sessions"]
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

