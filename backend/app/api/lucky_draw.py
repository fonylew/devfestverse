from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import random
from backend.app.core.rbac import require_roles, UserRole, DB_USERS, get_current_user

router = APIRouter(prefix="/lucky-draw", tags=["Lucky Draw"])

LUCKY_DRAW_WINNERS = []

@router.post("/draw", dependencies=[Depends(require_roles([UserRole.ORGANIZER]))])
def trigger_lucky_draw():
    # Only verified ticket participants are eligible
    eligible = [u for u in DB_USERS.values() if u.get("verified_ticket")]
    if not eligible:
        raise HTTPException(status_code=400, detail="No verified ticket participants found for lucky draw! Please ask participants to verify their tickets at the Main Billboard.")
    
    winner = random.choice(eligible)
    result = {
        "draw_id": f"draw-{len(LUCKY_DRAW_WINNERS)+1}",
        "winner_id": winner["id"],
        "winner_name": winner["display_name"],
        "winner_email": winner["email"],
        "prize": "DevFest Cloud Swag Pack + Pixel Agent Badge"
    }
    LUCKY_DRAW_WINNERS.append(result)
    return {
        "message": "Lucky draw completed successfully!",
        "broadcast_animation": "SLOT_MACHINE_RAFFLE",
        "winner": result
    }

@router.get("/winners")
def list_lucky_draw_winners():
    return LUCKY_DRAW_WINNERS
