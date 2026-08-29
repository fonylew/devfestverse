from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from backend.app.core.rbac import require_roles, UserRole

router = APIRouter(prefix="/events", tags=["Multi-Event Archiving"])

EVENTS_DB = [
    {
        "id": "event-devfest-2026",
        "name": "GDG Cloud Bangkok DevFest 2026",
        "year": "2026",
        "theme": "AI Agentverse",
        "status": "ACTIVE",
        "map_tileset": "retro-agent-map-2026"
    },
    {
        "id": "event-devfest-2025",
        "name": "GDG Cloud Bangkok DevFest 2025",
        "year": "2025",
        "theme": "Cloud Native AI",
        "status": "ARCHIVED",
        "map_tileset": "cloud-native-map-2025"
    }
]

class EventSwitchRequest(BaseModel):
    event_id: str

@router.get("")
def list_events():
    return EVENTS_DB

@router.post("/switch", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def switch_active_event(req: EventSwitchRequest):
    event = next((e for e in EVENTS_DB if e["id"] == req.event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Event configuration not found.")
    
    for e in EVENTS_DB:
        e["status"] = "ACTIVE" if e["id"] == req.event_id else "ARCHIVED"
    
    return {"message": f"Active event switched to '{event['name']}'", "active_event": event}
