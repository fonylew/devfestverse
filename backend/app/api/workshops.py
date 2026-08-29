from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from backend.app.core.rbac import get_current_user, require_roles, UserRole

router = APIRouter(prefix="/workshops", tags=["Workshops"])

WORKSHOPS_DB = [
    {
        "id": "ws-1",
        "title": "Hands-on: Building AI Agents with ADK & Gemini 2.0",
        "instructor": "Google Cloud Architect",
        "capacity": 30,
        "reserved_count": 12,
        "attendees": ["user-partic-1"],
        "room_code": "Room W1"
    },
    {
        "id": "ws-2",
        "title": "Deploying Microservices on Google Cloud Run",
        "instructor": "GDG Cloud Bangkok Lead",
        "capacity": 25,
        "reserved_count": 25,
        "attendees": [],
        "room_code": "Room W2"
    }
]

class ReserveSeatRequest(BaseModel):
    workshop_id: str

class CancelSeatRequest(BaseModel):
    workshop_id: str

@router.get("")
def list_workshops():
    return WORKSHOPS_DB

@router.post("/reserve")
def reserve_workshop_seat(req: ReserveSeatRequest, user: dict = Depends(get_current_user)):
    ws = next((w for w in WORKSHOPS_DB if w["id"] == req.workshop_id), None)
    if not ws:
        raise HTTPException(status_code=404, detail="Workshop room not found.")
    
    if user["id"] in ws["attendees"]:
        return {
            "message": "You are already registered for this workshop!",
            "pass_code": f"PASS-{ws['id']}-{user['id'][:6]}",
            "room_code": ws["room_code"]
        }
    
    if ws["reserved_count"] >= ws["capacity"]:
        raise HTTPException(status_code=400, detail="Workshop is fully booked! Joined waitlist.")
    
    ws["reserved_count"] += 1
    ws["attendees"].append(user["id"])
    return {
        "message": f"Successfully reserved seat for '{ws['title']}'!",
        "pass_code": f"PASS-{ws['id']}-{user['id'][:6]}",
        "room_code": ws["room_code"]
    }

@router.post("/cancel")
def cancel_workshop_seat(req: CancelSeatRequest, user: dict = Depends(get_current_user)):
    ws = next((w for w in WORKSHOPS_DB if w["id"] == req.workshop_id), None)
    if not ws:
        raise HTTPException(status_code=404, detail="Workshop room not found.")
    
    if user["id"] not in ws["attendees"]:
        raise HTTPException(status_code=400, detail="You are not registered for this workshop.")
    
    ws["attendees"].remove(user["id"])
    ws["reserved_count"] = max(0, ws["reserved_count"] - 1)
    return {
        "message": f"Cancelled reservation for '{ws['title']}'. Seat released!",
        "workshop_id": ws["id"],
        "reserved_count": ws["reserved_count"]
    }

