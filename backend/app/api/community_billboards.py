from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from backend.app.core.rbac import require_roles, UserRole

router = APIRouter(prefix="/community-billboards", tags=["Community Billboards"])

COMMUNITY_BILLBOARDS_DB = [
    {
        "id": "bb-chapter",
        "category": "GDG Chapter Portal",
        "title": "GDG Cloud Bangkok Chapter",
        "description": "Official community portal, RSVP, event tickets & chapter updates.",
        "url": "https://gdg.community.dev/gdg-cloud-bangkok/",
        "position_x": 60,
        "position_y": 50,
        "badge_color": "#4285F4"
    },
    {
        "id": "bb-fb-page",
        "category": "Facebook Page",
        "title": "GDG Cloud Bangkok Official Page",
        "description": "Official announcements, event updates & cloud tech news.",
        "url": "https://www.facebook.com/profile.php?id=61583002384772",
        "position_x": 160,
        "position_y": 50,
        "badge_color": "#1877F2"
    },
    {
        "id": "bb-fb-group",
        "category": "Facebook Group",
        "title": "GDG Cloud BKK Developer Group",
        "description": "Community discussion, Q&A, and technical networking.",
        "url": "https://www.facebook.com/groups/gdgcloudbkk/",
        "position_x": 260,
        "position_y": 50,
        "badge_color": "#34A853"
    },
    {
        "id": "bb-discord",
        "category": "Discord Server",
        "title": "GDG Cloud Bangkok Discord",
        "description": "Live chat, agent hacking channels, and real-time community chat.",
        "url": "https://discord.gg/CBbPpNvmS",
        "position_x": 360,
        "position_y": 50,
        "badge_color": "#5865F2"
    },
    {
        "id": "bb-instagram",
        "category": "Instagram",
        "title": "@gdgcloudbkk Instagram",
        "description": "Behind the scenes photos, stories, and DevFest highlights.",
        "url": "https://www.instagram.com/gdgcloudbkk",
        "position_x": 460,
        "position_y": 50,
        "badge_color": "#E1306C"
    },
    {
        "id": "bb-youtube",
        "category": "YouTube Channel",
        "title": "GDG Cloud Bangkok YouTube",
        "description": "Recorded tech talks, livestream archives & DevFest sessions.",
        "url": "https://www.youtube.com/@gdgcloudbangkok",
        "position_x": 560,
        "position_y": 50,
        "badge_color": "#FF0000"
    }
]

class BillboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None

@router.get("")
def list_community_billboards():
    return COMMUNITY_BILLBOARDS_DB

@router.put("/{billboard_id}", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def update_community_billboard(billboard_id: str, req: BillboardUpdate):
    bb = next((b for b in COMMUNITY_BILLBOARDS_DB if b["id"] == billboard_id), None)
    if not bb:
        raise HTTPException(status_code=404, detail="Billboard not found.")
    if req.title:
        bb["title"] = req.title
    if req.description:
        bb["description"] = req.description
    if req.url:
        bb["url"] = req.url
    return {"message": "Billboard updated successfully", "billboard": bb}
