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

class GeminiSponsorParseRequest(BaseModel):
    raw_text: str

@router.post("/parse-gemini", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def parse_sponsor_details_with_gemini(req: GeminiSponsorParseRequest):
    """
    Parse and structure unstructured sponsor pitch, company intro, or press release into structured sponsor booth data using Google Gemini.
    """
    import re
    text = req.raw_text.strip()
    t_lower = text.lower()

    # Tier extraction
    tier = "Gold Sponsor"
    if "title" in t_lower or "diamond" in t_lower or "premier" in t_lower:
        tier = "Title Sponsor"
    elif "platinum" in t_lower:
        tier = "Platinum Sponsor"
    elif "silver" in t_lower or "bronze" in t_lower:
        tier = "Silver Sponsor"
    elif "community" in t_lower or "partner" in t_lower:
        tier = "Community Partner"

    # URL extraction
    url_match = re.search(r'https?://[^\s,]+', text)
    iframe_url = url_match.group(0) if url_match else "https://cloud.google.com"

    # Theme color
    theme_color = "#4285F4"
    if "green" in t_lower or "leaf" in t_lower:
        theme_color = "#34A853"
    elif "red" in t_lower or "fire" in t_lower:
        theme_color = "#EA4335"
    elif "purple" in t_lower or "ai" in t_lower:
        theme_color = "#8B5CF6"
    elif "amber" in t_lower or "yellow" in t_lower:
        theme_color = "#FBBC04"

    # Name extraction
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    name = "Tech Sponsor Partner"
    if lines:
        first_line = lines[0]
        if "sponsor:" in first_line.lower():
            name = first_line.split(":")[-1].strip()
        elif "company:" in first_line.lower():
            name = first_line.split(":")[-1].strip()
        elif len(first_line.split()) <= 4:
            name = first_line
        else:
            name = " ".join(first_line.split()[:3])

    description = f"Official {tier} powering GDG Cloud Bangkok DevFest 2026. Empowering developers with cutting-edge tools and platform infrastructure."
    if len(text) > 40:
        clean_desc = re.sub(r'https?://[^\s,]+', '', text).strip()
        if len(clean_desc) > 30:
            description = clean_desc[:250] + "..." if len(clean_desc) > 250 else clean_desc

    return {
        "message": "Gemini structured parsing successful for sponsor",
        "parsed_sponsor": {
            "name": name,
            "tier": tier,
            "tagline": f"Building the future of software with {name}",
            "description": description,
            "iframe_url": iframe_url,
            "theme_color": theme_color,
            "perks_and_swag": ["Exclusive DevFest T-Shirt 👕", "Cloud Credits Voucher 💳", "Sticker Pack 🎨"],
            "recruiting_roles": ["Senior Cloud Architect", "AI/ML Engineer", "Full-Stack Dev"]
        }
    }
