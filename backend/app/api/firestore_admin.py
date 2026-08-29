from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from backend.app.core.rbac import require_roles, UserRole, get_current_user
from backend.app.core.firestore import firestore_manager

router = APIRouter(prefix="/firestore/events", tags=["Firestore Event & Attendance Management"])

class VenueModel(BaseModel):
    name: str
    address: str
    rooms: List[str] = []

class EventUpsertRequest(BaseModel):
    event_id: str
    event_name: str
    date: str
    venue: VenueModel
    metadata: Dict[str, Any] = {}
    speakers: List[Dict[str, Any]] = []
    sessions: List[Dict[str, Any]] = []
    sponsors: List[Dict[str, Any]] = []
    workshops: List[Dict[str, Any]] = []

class EventMetadataUpdateRequest(BaseModel):
    date: Optional[str] = None
    venue: Optional[VenueModel] = None
    metadata: Optional[Dict[str, Any]] = None

class ParticipantCheckinRequest(BaseModel):
    ticket_ref_or_user_id: str
    notes: Optional[str] = None

@router.get("")
def list_events():
    """List all events stored in Firestore with live show-up summaries."""
    return firestore_manager.list_all_events()

@router.get("/{event_id}")
def get_event(event_id: str):
    """Retrieve top-level Firestore event document by name/slug."""
    event = firestore_manager.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found in Firestore.")
    return event

@router.post("", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def upsert_event(req: EventUpsertRequest):
    """Create or overwrite top-level event document on Firestore with metadata, venue, date, and components."""
    data = req.model_dump()
    event = firestore_manager.upsert_event(req.event_id, data)
    return {"message": f"Event '{req.event_name}' saved to Firestore successfully.", "event": event}

@router.put("/{event_id}/metadata", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def update_event_metadata(event_id: str, req: EventMetadataUpdateRequest):
    """Update event date, venue, and custom metadata on Firestore."""
    venue_dict = req.venue.model_dump() if req.venue else None
    event = firestore_manager.update_metadata(event_id, date=req.date, venue=venue_dict, metadata=req.metadata)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found in Firestore.")
    return {"message": f"Event '{event_id}' metadata updated successfully.", "event": event}

@router.post("/{event_id}/checkin", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def checkin_event_participant(event_id: str, req: ParticipantCheckinRequest, current_user: dict = Depends(get_current_user)):
    """Check in participant on event date to track live show-up rate."""
    try:
        res = firestore_manager.checkin_participant(
            event_id=event_id,
            ticket_ref_or_user_id=req.ticket_ref_or_user_id,
            scanned_by=current_user.get("id", "staff-console"),
            notes=req.notes or ""
        )
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{event_id}/attendance")
def get_event_attendance(event_id: str):
    """Get live show-up percentage and participant status on the event date."""
    event = firestore_manager.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found in Firestore.")
    
    participants = list(event.get("participants", {}).values())
    summary = event.get("attendance_summary", {})
    return {
        "event_id": event_id,
        "event_name": event.get("event_name"),
        "date": event.get("date"),
        "venue": event.get("venue"),
        "attendance_summary": summary,
        "participants": participants
    }
