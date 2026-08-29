from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from backend.app.core.rbac import require_roles, UserRole

router = APIRouter(prefix="/bgm", tags=["Background Music"])

BGM_PLAYLIST_DB = [
    {
        "id": "track-1",
        "title": "Chiptune Cloud Beats (8-bit)",
        "zone": "Lounge",
        "type": "YOUTUBE",
        "url": "https://www.youtube.com/embed/jfKfPfyJRdk",
        "default": True
    },
    {
        "id": "track-2",
        "title": "Retro Agent Synthwave",
        "zone": "Stage Area",
        "type": "GCS",
        "url": "https://storage.googleapis.com/gdgcloudbkk-devfest/audio/synthwave.mp3",
        "default": False
    }
]

class BGMTrackCreate(BaseModel):
    title: str
    zone: str = "Global"
    type: str = "YOUTUBE" # "YOUTUBE" or "GCS"
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
