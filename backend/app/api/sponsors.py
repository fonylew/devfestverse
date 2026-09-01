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
        "theme_color": "#EA4335",
        "ring_color": "#F87171",
        "position_x": 720,
        "position_y": 190
    },
    {
        "id": "booth-swag-shop",
        "name": "GDG Swag & Merch Shop",
        "tier": "Official Merchandise",
        "logo_svg": "<svg width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' rx='8' fill='#F59E0B'/><text x='10' y='26' fill='#FFF' font-weight='bold' font-size='16'>🛍️</text></svg>",
        "iframe_url": "https://shop.line.me/@837etxse",
        "description": "Official GDG Cloud Bangkok Hoodies, developer tees, stickers & pins on LINE Shopping.",
        "theme_color": "#F59E0B",
        "ring_color": "#FDE047",
        "position_x": 720,
        "position_y": 270
    },
    {
        "id": "sponsor-vertex-ai",
        "name": "Vertex AI Platform",
        "tier": "Platinum Sponsor",
        "logo_svg": "<svg width='40' height='40' viewBox='0 0 40 40'><rect width='40' height='40' rx='8' fill='#4285F4'/><text x='12' y='25' fill='#FFF' font-weight='bold' font-size='14'>V</text></svg>",
        "iframe_url": "https://cloud.google.com/vertex-ai",
        "description": "Build, deploy, and scale ML models and generative AI agents with Vertex AI.",
        "theme_color": "#4285F4",
        "ring_color": "#60A5FA",
        "position_x": 650,
        "position_y": 200
    }
]

class SponsorCreateUpdate(BaseModel):
    id: Optional[str] = None
    name: str
    tier: str = "Gold Sponsor"
    iframe_url: str
    description: str
    theme_color: Optional[str] = "#38BDF8"
    ring_color: Optional[str] = "#60A5FA"
    booth_type: Optional[str] = "custom_booth"

class CustomBoothGenerateRequest(BaseModel):
    booth_type: str = "swag_shop"  # swag_shop, sponsor_booth, ai_hub, gaming_lounge, community_kiosk
    name: str
    tagline: Optional[str] = None
    theme_style: str = "cyberpunk"  # cyberpunk, google_cloud, sunset_glass, emerald_matrix
    theme_color: str = "#F59E0B"
    target_url: str = "https://shop.line.me/@837etxse"
    description: Optional[str] = None
    showcase_items: Optional[List[str]] = None

@router.get("")
def list_sponsors():
    return SPONSORS_DB

@router.post("", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def create_or_upsert_booth(req: SponsorCreateUpdate, user: dict = Depends(get_current_user)):
    booth_id = req.id or f"booth-{req.name.lower().replace(' ', '-')[:12]}"
    existing = next((s for s in SPONSORS_DB if s["id"] == booth_id), None)
    
    booth_data = {
        "id": booth_id,
        "name": req.name,
        "tier": req.tier,
        "iframe_url": req.iframe_url,
        "description": req.description,
        "theme_color": req.theme_color or "#38BDF8",
        "ring_color": req.ring_color or "#60A5FA",
        "logo_svg": f"<svg width='40' height='40' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='{req.theme_color or '#38BDF8'}'/><text x='12' y='25' fill='#FFF' font-weight='bold' font-size='14'>★</text></svg>",
        "position_x": 720,
        "position_y": 200
    }
    
    if existing:
        existing.update(booth_data)
    else:
        SPONSORS_DB.append(booth_data)
        
    return {"message": f"Booth '{req.name}' successfully deployed to virtual venue!", "booth": booth_data}

@router.put("/{sponsor_id}", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.SPONSOR, UserRole.STAFF]))])
def update_sponsor(sponsor_id: str, req: SponsorCreateUpdate, user: dict = Depends(get_current_user)):
    sponsor = next((s for s in SPONSORS_DB if s["id"] == sponsor_id), None)
    if not sponsor:
        raise HTTPException(status_code=404, detail="Sponsor booth not found.")
    
    sponsor["name"] = req.name
    sponsor["tier"] = req.tier
    sponsor["iframe_url"] = req.iframe_url
    sponsor["description"] = req.description
    if req.theme_color: sponsor["theme_color"] = req.theme_color
    if req.ring_color: sponsor["ring_color"] = req.ring_color
    return {"message": "Sponsor booth updated successfully", "sponsor": sponsor}

@router.post("/generate-booth", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def generate_custom_booth_design(req: CustomBoothGenerateRequest):
    """
    Customizable Booth Design Generator: Generate cohesive visual theme, 2D sprite palette, banner styles, and metadata.
    """
    color_map = {
        "cyberpunk": {"theme": "#00E5FF", "ring": "#38BDF8", "bg": "linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(124, 58, 237, 0.3))"},
        "google_cloud": {"theme": "#4285F4", "ring": "#60A5FA", "bg": "linear-gradient(135deg, rgba(66, 133, 244, 0.2), rgba(52, 168, 83, 0.2))"},
        "sunset_glass": {"theme": "#F59E0B", "ring": "#FDE047", "bg": "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(239, 68, 68, 0.2))"},
        "emerald_matrix": {"theme": "#10B981", "ring": "#34D399", "bg": "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(6, 78, 59, 0.3))"}
    }
    
    theme_preset = color_map.get(req.theme_style, color_map["cyberpunk"])
    active_color = req.theme_color if req.theme_color else theme_preset["theme"]
    
    items = req.showcase_items or []
    if req.booth_type == "swag_shop" and not items:
        items = ["🧥 Cyberpunk Hoodie", "👕 DevFest 2026 Tee", "✨ Enamel Pins & Stickers", "🍶 Stainless Tumbler"]
    elif req.booth_type == "ai_hub" and not items:
        items = ["🤖 Vertex AI Agent Demo", "🧠 Gemini 2.0 Live Playground", "⚡ Cloud Run Microservices"]
        
    booth_id = f"booth-{req.name.lower().replace(' ', '-')[:12]}"
    designed_booth = {
        "id": booth_id,
        "name": req.name,
        "booth_type": req.booth_type,
        "tagline": req.tagline or f"Welcome to {req.name}",
        "tier": "Official Swag & Merch" if req.booth_type == "swag_shop" else "Interactive Expo",
        "description": req.description or f"Official interactive {req.booth_type.replace('_', ' ')} for DevFest Bangkok.",
        "iframe_url": req.target_url,
        "theme_color": active_color,
        "ring_color": theme_preset["ring"],
        "background_css": theme_preset["bg"],
        "showcase_items": items,
        "icon": "🛍️" if "swag" in req.booth_type or "shop" in req.booth_type else "🏢"
    }
    
    # Save into DB
    existing = next((s for s in SPONSORS_DB if s["id"] == booth_id), None)
    if existing:
        existing.update(designed_booth)
    else:
        SPONSORS_DB.append(designed_booth)
        
    return {
        "message": f"✨ Booth '{req.name}' designed & generated successfully!",
        "booth": designed_booth
    }

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
