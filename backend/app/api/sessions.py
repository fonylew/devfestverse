from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from backend.app.core.rbac import require_roles, UserRole

router = APIRouter(prefix="/sessions", tags=["Agenda Sessions"])

SESSIONS_DB = [
    {
        "id": "session-keynote",
        "title": "Opening Keynote: Autonomous AI Agents on Google Cloud",
        "description": "Discover how multi-agent architectures are reshaping modern cloud platforms.",
        "speaker_id": "user-speaker-1",
        "speaker_name": "Dr. Agent",
        "room": "Main Stage",
        "start_time": "10:00 AM",
        "end_time": "11:00 AM"
    },
    {
        "id": "session-gemini-live",
        "title": "Building Realtime Multimodal Streaming with Gemini Live API",
        "description": "Deep dive into real-time audio transcription and multi-language live translation.",
        "speaker_id": "user-speaker-1",
        "speaker_name": "Dr. Agent",
        "room": "Track A - AI Stage",
        "start_time": "11:15 AM",
        "end_time": "12:00 PM"
    }
]

class SessionCreate(BaseModel):
    title: str
    description: str
    speaker_id: str
    speaker_name: str
    room: str
    start_time: str
    end_time: str

@router.get("")
def list_agenda_sessions():
    return SESSIONS_DB

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
        "start_time": req.start_time,
        "end_time": req.end_time
    }
    SESSIONS_DB.append(sess)
    return {"message": "Agenda session created", "session": sess}
