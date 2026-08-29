from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from backend.app.core.rbac import get_current_user
from backend.app.api.sessions import SESSIONS_DB
import datetime

router = APIRouter(prefix="/transcribe", tags=["Session Transcriptions"])

TRANSCRIPTS_DB = [
    {
        "id": "trans-1",
        "session_id": "session-keynote",
        "speaker_id": "user-speaker-1",
        "speaker_name": "Dr. Agent",
        "original_text": "Welcome to DevFest Bangkok! Today we are discussing building AI agents on Google Cloud.",
        "original_language": "en",
        "translated_text": "ยินดีต้อนรับสู่ DevFest Bangkok! วันนี้เราจะมาพูดถึงการสร้าง AI agents บน Google Cloud",
        "target_language": "th",
        "timestamp": "2026-08-29T10:05:00Z"
    }
]

class TranscribeStreamChunk(BaseModel):
    session_id: str
    speaker_id: str
    audio_text_chunk: str
    original_language: str = "en"
    target_language: str = "th"

@router.post("/stream-chunk")
def process_gemini_transcribe_chunk(req: TranscribeStreamChunk, user: dict = Depends(get_current_user)):
    session = next((s for s in SESSIONS_DB if s["id"] == req.session_id), None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    
    # Mock Gemini Live Transcribe & Translation pipeline
    translated = f"[TH Translation] {req.audio_text_chunk}"
    transcript_item = {
        "id": f"trans-{len(TRANSCRIPTS_DB)+1}",
        "session_id": req.session_id,
        "speaker_id": req.speaker_id,
        "speaker_name": session["speaker_name"],
        "original_text": req.audio_text_chunk,
        "original_language": req.original_language,
        "translated_text": translated,
        "target_language": req.target_language,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    TRANSCRIPTS_DB.append(transcript_item)
    return {
        "message": "Gemini transcribe processed & saved to speaker transcript archive",
        "live_caption": transcript_item
    }

@router.get("/session/{session_id}")
def get_session_transcripts(session_id: str):
    session_items = [t for t in TRANSCRIPTS_DB if t["session_id"] == session_id]
    return {
        "session_id": session_id,
        "transcript_count": len(session_items),
        "transcripts": session_items
    }

@router.get("/speaker/{speaker_id}")
def get_speaker_transcripts(speaker_id: str):
    speaker_items = [t for t in TRANSCRIPTS_DB if t["speaker_id"] == speaker_id]
    return {
        "speaker_id": speaker_id,
        "transcript_count": len(speaker_items),
        "transcripts": speaker_items
    }
