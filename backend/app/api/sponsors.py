from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from backend.app.core.rbac import require_roles, UserRole, get_current_user

router = APIRouter(prefix="/sponsors", tags=["Sponsors"])

SPONSORS_DB = [
    {
        "id": "sponsor-google-cloud",
        "name": "Google Cloud",
        "tier": "Title Sponsor",
        "logo_svg": "<svg width='40' height='40' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='#4285F4'/><text x='11' y='25' fill='#FFF' font-weight='bold' font-size='14'>G</text></svg>",
        "iframe_url": "https://cloud.google.com",
        "description": "Empowering developers to build intelligent AI Agent applications on GCP.",
        "position_x": 550,
        "position_y": 200
    },
    {
        "id": "sponsor-vertex-ai",
        "name": "Vertex AI Platform",
        "tier": "Platinum Sponsor",
        "logo_svg": "<svg width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' rx='8' fill='#EA4335'/><text x='12' y='25' fill='#FFF' font-weight='bold' font-size='14'>V</text></svg>",
        "iframe_url": "https://cloud.google.com/vertex-ai",
        "description": "Build, deploy, and scale ML models and generative AI agents with Vertex AI.",
        "position_x": 650,
        "position_y": 200
    }
]

class SponsorCreateUpdate(BaseModel):
    name: str
    tier: str
    iframe_url: str
    description: str

@router.get("")
def list_sponsors():
    return SPONSORS_DB

@router.put("/{sponsor_id}", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.SPONSOR]))])
def update_sponsor(sponsor_id: str, req: SponsorCreateUpdate, user: dict = Depends(get_current_user)):
    sponsor = next((s for s in SPONSORS_DB if s["id"] == sponsor_id), None)
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor booth not found.")
    
    sponsor["name"] = req.name
    sponsor["tier"] = req.tier
    sponsor["iframe_url"] = req.iframe_url
    sponsor["description"] = req.description
    return {"message": "Sponsor booth updated successfully", "sponsor": sponsor}
