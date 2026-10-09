from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from backend.app.core.rbac import require_roles, UserRole

router = APIRouter(prefix="/bgm", tags=["Background Music"])

BGM_PLAYLIST_DB = [
    {
        "id": "track-1",
        "title": "Chiptune Cyber Beats (8-bit)",
        "zone": "Lounge Zone",
        "type": "AUDIO",
        "url": "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3",
        "default": True
    },
    {
        "id": "track-2",
        "title": "GDG Cloud Synthwave Theme",
        "zone": "Main Stage",
        "type": "AUDIO",
        "url": "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=groovy-ambient-10655.mp3",
        "default": False
    },
    {
        "id": "track-3",
        "title": "Retro Agent Chiptune Stream",
        "zone": "Expo Hall",
        "type": "YOUTUBE",
        "url": "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1",
        "default": False
    }
]

class BGMTrackCreate(BaseModel):
    title: str
    zone: str = "Global"
    type: str = "AUDIO" # "AUDIO" or "YOUTUBE"
    url: str

@router.get("")
def list_bgm_tracks():
    return BGM_PLAYLIST_DB

@router.post("", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def add_bgm_track(req: BGMTrackCreate):
    track = {
        "id": f"track-{len(BGM_PLAYLIST_DB)+1}",
        "title": req.title,
        "zone": req.zone,
        "type": req.type.upper(),
        "url": req.url,
        "default": False
    }
    BGM_PLAYLIST_DB.append(track)
    return {"message": "BGM track added to playlist", "track": track}
