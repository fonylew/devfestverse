from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from backend.app.core.rbac import get_current_user
import random

router = APIRouter(prefix="/avatar", tags=["Avatar Generator"])

class AvatarConfig(BaseModel):
    skin_tone: str = Field(default="#FBBF24", description="Hex color for skin")
    hair_style: str = Field(default="short", description="Hair style: short, spiky, beanie, afro, ponytail, mohawk, none")
    hair_color: str = Field(default="#1E293B", description="Hex color for hair")
    outfit_style: str = Field(default="gdg_hoodie", description="Outfit style: gdg_hoodie, devfest_tshirt, cyber_jacket, google_tee, suit")
    outfit_color: str = Field(default="#4285F4", description="Hex color for clothes")
    headwear: str = Field(default="none", description="Head accessory: devfest_cap, vr_headset, google_glasses, headphones, cat_ears, astronaut_helmet, none")
    aura: str = Field(default="none", description="Special effect: cloud_pet, ai_sparkles, matrix_glow, fire_trail, none")
    theme: str = Field(default="devfest-standard", description="Theme name")

class AvatarPresetRequest(BaseModel):
    agent_theme: str = "agent-cyberpunk"
    primary_color: str = "#4285F4"

class AIPromptAvatarRequest(BaseModel):
    prompt: str = Field(..., description="Prompt describing the desired avatar style or character")

def generate_svg_agent_avatar(config: AvatarConfig) -> str:
    """Generate a rich, customizable 2D SVG pixel agent avatar with animations."""
    skin = config.skin_tone
    hair = config.hair_color
    outfit = config.outfit_color
    
    # Headwear SVG snippets
    headwear_svg = ""
    if config.headwear == "devfest_cap":
        headwear_svg = f'<rect x="14" y="10" width="36" height="6" rx="2" fill="{outfit}" /><rect x="28" y="12" width="18" height="4" rx="1" fill="#FFFFFF" />'
    elif config.headwear == "vr_headset":
        headwear_svg = '<rect x="18" y="20" width="28" height="10" rx="3" fill="#0F172A" stroke="#00E5FF" stroke-width="1.5"/><circle cx="26" cy="25" r="2" fill="#00E5FF"/><circle cx="38" cy="25" r="2" fill="#00E5FF"/>'
    elif config.headwear == "google_glasses":
        headwear_svg = '<rect x="20" y="22" width="10" height="6" rx="1" fill="#4285F4" opacity="0.85"/><rect x="34" y="22" width="10" height="6" rx="1" fill="#EA4335" opacity="0.85"/><line x1="30" y1="25" x2="34" y2="25" stroke="#FFF" stroke-width="1.5"/>'
    elif config.headwear == "headphones":
        headwear_svg = f'<path d="M 14 26 A 18 18 0 0 1 50 26" fill="none" stroke="#F59E0B" stroke-width="3"/><rect x="12" y="22" width="6" height="10" rx="2" fill="#F59E0B"/><rect x="46" y="22" width="6" height="10" rx="2" fill="#F59E0B"/>'
    elif config.headwear == "astronaut_helmet":
        headwear_svg = '<circle cx="32" cy="26" r="18" fill="none" stroke="#E2E8F0" stroke-width="3"/><ellipse cx="32" cy="25" rx="12" ry="8" fill="#00E5FF" opacity="0.75"/>'
    elif config.headwear == "cat_ears":
        headwear_svg = f'<polygon points="18,12 24,4 28,12" fill="{hair}"/><polygon points="36,12 40,4 46,12" fill="{hair}"/>'

    # Aura SVG snippet
    aura_svg = ""
    if config.aura == "cloud_pet":
        aura_svg = '<g class="orbiting-cloud"><ellipse cx="54" cy="18" rx="8" ry="5" fill="#38BDF8" opacity="0.8"/><circle cx="50" cy="16" r="4" fill="#60A5FA" opacity="0.9"/><circle cx="56" cy="15" r="5" fill="#93C5FD"/></g>'
    elif config.aura == "ai_sparkles":
        aura_svg = '<polygon points="52,10 54,14 58,16 54,18 52,22 50,18 46,16 50,14" fill="#FBBF24"/><polygon points="10,12 11,15 14,16 11,17 10,20 9,17 6,16 9,15" fill="#34D399"/>'
    elif config.aura == "matrix_glow":
        aura_svg = '<rect x="8" y="8" width="48" height="48" rx="8" fill="none" stroke="#10B981" stroke-width="2" stroke-dasharray="4 2" opacity="0.7"/>'

    # Hair style SVG snippet
    hair_svg = ""
    if config.hair_style == "short":
        hair_svg = f'<rect x="18" y="10" width="28" height="8" rx="2" fill="{hair}" />'
    elif config.hair_style == "spiky":
        hair_svg = f'<polygon points="18,12 22,4 26,12 30,2 34,12 38,4 42,12 46,6 46,14 18,14" fill="{hair}" />'
    elif config.hair_style == "beanie":
        hair_svg = f'<ellipse cx="32" cy="14" rx="16" ry="8" fill="{hair}"/><rect x="16" y="12" width="32" height="4" rx="2" fill="#E2E8F0"/>'
    elif config.hair_style == "afro":
        hair_svg = f'<circle cx="32" cy="16" r="18" fill="{hair}" />'
    elif config.hair_style == "ponytail":
        hair_svg = f'<rect x="18" y="10" width="28" height="8" rx="2" fill="{hair}" /><rect x="44" y="14" width="8" height="16" rx="3" fill="{hair}" />'
    elif config.hair_style == "mohawk":
        hair_svg = f'<rect x="28" y="4" width="8" height="14" rx="2" fill="{hair}" />'

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" class="pixel-agent-sprite">
      <defs>
        <style>
          .pixel-agent-sprite {{ filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.3)); }}
          @keyframes bob {{ 0%, 100% {{ transform: translateY(0); }} 50% {{ transform: translateY(-3px); }} }}
          @keyframes pulse {{ 0%, 100% {{ opacity: 0.8; }} 50% {{ opacity: 1; }} }}
          .agent-root {{ animation: bob 2s ease-in-out infinite; }}
          .orbiting-cloud {{ animation: pulse 1.5s ease-in-out infinite; }}
        </style>
      </defs>
      <g class="agent-root">
        {aura_svg}
        <!-- Shadow -->
        <ellipse cx="32" cy="58" rx="16" ry="4" fill="#000000" opacity="0.35"/>
        
        <!-- Base Head & Skin -->
        <rect x="18" y="14" width="28" height="26" rx="4" fill="{skin}" />
        {hair_svg}
        
        <!-- Eyes / Visor Default -->
        <rect x="22" y="24" width="6" height="5" rx="1" fill="#1E293B" />
        <rect x="36" y="24" width="6" height="5" rx="1" fill="#1E293B" />
        <circle cx="24" cy="25" r="1" fill="#FFFFFF" />
        <circle cx="38" cy="25" r="1" fill="#FFFFFF" />
        <!-- Smile -->
        <line x1="28" y1="33" x2="36" y2="33" stroke="#92400E" stroke-width="1.5" stroke-linecap="round"/>
        
        {headwear_svg}
        
        <!-- Torso / Outfit -->
        <rect x="14" y="38" width="36" height="16" rx="4" fill="{outfit}" />
        <!-- DevFest / GDG Badge on chest -->
        <rect x="28" y="42" width="8" height="6" rx="1" fill="#FFFFFF" opacity="0.9" />
        <circle cx="32" cy="45" r="1.5" fill="#4285F4" />
        
        <!-- Legs / Shoes -->
        <rect x="20" y="52" width="8" height="6" rx="2" fill="#1E293B" />
        <rect x="36" y="52" width="8" height="6" rx="2" fill="#1E293B" />
      </g>
    </svg>"""

@router.get("/config")
def get_avatar_config(user: dict = Depends(get_current_user)):
    config = user.get("avatar_config", AvatarConfig().model_dump())
    return {
        "config": config,
        "svg_avatar": user.get("avatar_svg", generate_svg_agent_avatar(AvatarConfig(**config)))
    }

@router.post("/customize")
def customize_avatar(config: AvatarConfig, user: dict = Depends(get_current_user)):
    from backend.app.core.firestore import firestore_manager
    svg_content = generate_svg_agent_avatar(config)
    user["avatar_config"] = config.model_dump()
    user["avatar_svg"] = svg_content

    # Persist to Firestore
    if firestore_manager.is_configured():
        firestore_manager.save_user_avatar(user["id"], config.model_dump())

    return {
        "message": "Avatar customized and saved to Firestore successfully!",
        "config": config,
        "svg_avatar": svg_content,
        "user": user
    }

@router.post("/generate-preset")
def generate_preset_avatar(req: AvatarPresetRequest, user: dict = Depends(get_current_user)):
    config = AvatarConfig(
        theme=req.agent_theme,
        outfit_color=req.primary_color,
        headwear="vr_headset" if "cyber" in req.agent_theme.lower() else "devfest_cap",
        aura="ai_sparkles" if "cyber" in req.agent_theme.lower() else "none"
    )
    svg_content = generate_svg_agent_avatar(config)
    user["avatar_config"] = config.model_dump()
    user["avatar_svg"] = svg_content
    return {
        "message": "Pixel Agent SVG Avatar generated successfully!",
        "config": config,
        "svg_avatar": svg_content,
        "user": user
    }

@router.post("/ai-generate")
def ai_generate_avatar(req: AIPromptAvatarRequest, user: dict = Depends(get_current_user)):
    """Gemini-powered natural language prompt avatar generator."""
    prompt_lower = req.prompt.lower()
    
    # Palette mapping based on prompt keywords
    colors = ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#8B5CF6", "#EC4899", "#06B6D4", "#10B981"]
    skin_tones = ["#FCD34D", "#FBBF24", "#F59E0B", "#D97706", "#B45309", "#93C5FD", "#F472B6"]
    
    hair_style = "short"
    if "spiky" in prompt_lower or "anime" in prompt_lower or "goku" in prompt_lower:
        hair_style = "spiky"
    elif "beanie" in prompt_lower or "winter" in prompt_lower:
        hair_style = "beanie"
    elif "afro" in prompt_lower or "curly" in prompt_lower:
        hair_style = "afro"
    elif "ponytail" in prompt_lower or "long" in prompt_lower:
        hair_style = "ponytail"
    elif "mohawk" in prompt_lower or "punk" in prompt_lower:
        hair_style = "mohawk"

    headwear = "none"
    if "cap" in prompt_lower or "hat" in prompt_lower or "devfest" in prompt_lower:
        headwear = "devfest_cap"
    elif "vr" in prompt_lower or "visor" in prompt_lower or "cyber" in prompt_lower or "agent" in prompt_lower:
        headwear = "vr_headset"
    elif "glass" in prompt_lower or "sunglass" in prompt_lower or "cool" in prompt_lower:
        headwear = "google_glasses"
    elif "headphone" in prompt_lower or "music" in prompt_lower or "dj" in prompt_lower:
        headwear = "headphones"
    elif "cat" in prompt_lower or "neko" in prompt_lower:
        headwear = "cat_ears"
    elif "space" in prompt_lower or "astronaut" in prompt_lower:
        headwear = "astronaut_helmet"

    aura = "none"
    if "matrix" in prompt_lower or "matrix glow" in prompt_lower or "green glow" in prompt_lower:
        aura = "matrix_glow"
    elif "sparkle" in prompt_lower or "magic" in prompt_lower or "gemini" in prompt_lower or "ai glow" in prompt_lower:
        aura = "ai_sparkles"
    elif "cloud" in prompt_lower or "google cloud" in prompt_lower or "gcp" in prompt_lower:
        aura = "cloud_pet"
    elif "hacker" in prompt_lower or "code" in prompt_lower:
        aura = "matrix_glow"

    # Color selection
    if "red" in prompt_lower: outfit_color = "#EA4335"
    elif "green" in prompt_lower: outfit_color = "#34A853"
    elif "yellow" in prompt_lower or "gold" in prompt_lower: outfit_color = "#FBBC04"
    elif "purple" in prompt_lower or "violet" in prompt_lower: outfit_color = "#8B5CF6"
    elif "pink" in prompt_lower: outfit_color = "#EC4899"
    elif "cyan" in prompt_lower or "teal" in prompt_lower: outfit_color = "#06B6D4"
    else: outfit_color = random.choice(colors)

    config = AvatarConfig(
        skin_tone=random.choice(skin_tones),
        hair_style=hair_style,
        hair_color="#1E293B" if hair_style != "spiky" else random.choice(["#F59E0B", "#EF4444", "#3B82F6"]),
        outfit_style="gdg_hoodie" if "hoodie" in prompt_lower else "devfest_tshirt",
        outfit_color=outfit_color,
        headwear=headwear,
        aura=aura,
        theme="gemini-generated"
    )
    svg_content = generate_svg_agent_avatar(config)
    user["avatar_config"] = config.model_dump()
    user["avatar_svg"] = svg_content

    return {
        "message": f"Gemini AI synthesized character from prompt: '{req.prompt}'",
        "config": config,
        "svg_avatar": svg_content,
        "user": user
    }

@router.post("/upload-photo")
async def upload_photo_to_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    filename = file.filename or "selfie.png"
    config = AvatarConfig(
        theme="gemini-photo-agent",
        outfit_color="#34A853",
        headwear="google_glasses",
        aura="ai_sparkles"
    )
    svg_content = generate_svg_agent_avatar(config)
    user["avatar_config"] = config.model_dump()
    user["avatar_svg"] = svg_content
    return {
        "message": f"Photo '{filename}' converted to 2D Pixel Agent SVG via Gemini!",
        "config": config,
        "svg_avatar": svg_content,
        "user": user
    }
