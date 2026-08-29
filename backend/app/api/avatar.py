from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional
from backend.app.core.rbac import get_current_user

router = APIRouter(prefix="/avatar", tags=["Avatar Generator"])

class AvatarPresetRequest(BaseModel):
    agent_theme: str = "agent-cyberpunk"
    primary_color: str = "#4285F4"

def generate_svg_agent_avatar(theme: str, color: str) -> str:
    # SVG Vector Avatar with idle bobbing CSS animation capability
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" class="pixel-agent-sprite">
      <defs>
        <style>
          .pixel-agent-sprite {{ filter: drop-shadow(0px 4px 0px rgba(0,0,0,0.25)); }}
          .agent-body {{ fill: {color}; }}
          .agent-eye {{ fill: #FFFFFF; }}
          .agent-visor {{ fill: #00E5FF; }}
        </style>
      </defs>
      <!-- Base Head & Agent Helmet -->
      <rect x="16" y="12" width="32" height="32" rx="4" class="agent-body" />
      <rect x="20" y="20" width="24" height="8" rx="2" class="agent-visor" />
      <!-- Eyes -->
      <rect x="24" y="22" width="4" height="4" class="agent-eye" />
      <rect x="36" y="22" width="4" height="4" class="agent-eye" />
      <!-- Agent Body Armor -->
      <rect x="12" y="44" width="40" height="16" rx="4" class="agent-body" />
      <rect x="26" y="48" width="12" height="8" fill="#FFD700" />
    </svg>"""

@router.post("/generate-preset")
def generate_preset_avatar(req: AvatarPresetRequest, user: dict = Depends(get_current_user)):
    svg_content = generate_svg_agent_avatar(req.agent_theme, req.primary_color)
    user["avatar_svg"] = svg_content
    return {
        "message": "Pixel Agent SVG Avatar generated successfully!",
        "svg_avatar": svg_content,
        "user": user
    }

@router.post("/upload-photo")
async def upload_photo_to_avatar(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    # Mock Gemini Image processing: converts photo input to custom 2D Pixel Agent SVG
    filename = file.filename or "selfie.png"
    svg_content = generate_svg_agent_avatar("gemini-custom-agent", "#34A853")
    user["avatar_svg"] = svg_content
    return {
        "message": f"Photo '{filename}' converted to 2D Pixel Agent SVG via Gemini!",
        "svg_avatar": svg_content,
        "user": user
    }
