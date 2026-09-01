from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional
from datetime import datetime
import uuid
from backend.app.core.rbac import get_current_user, require_roles, UserRole
from backend.app.core.firestore import firestore_manager

router = APIRouter(prefix="/builders", tags=["Builder Zone & Interactive Projects Showcase"])

class BuilderProjectCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    builder_name: str = Field(..., min_length=2, max_length=50)
    builder_email: Optional[str] = None
    category: str = Field("AI & Agents", description="Track or Category")
    demo_url: str = Field(..., description="Live interactive web app URL for iframe showcase")
    github_url: Optional[str] = None
    description: str = Field(..., min_length=10, max_length=1000)
    tech_stack: List[str] = Field(default_factory=list)
    thumbnail_url: Optional[str] = None

class BuilderProjectUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    demo_url: Optional[str] = None
    github_url: Optional[str] = None
    description: Optional[str] = None
    tech_stack: Optional[List[str]] = None

# Initial Seed Projects for the Builder Showcase
BUILDER_PROJECTS_DB = [
    {
        "id": "proj-agentverse",
        "title": "Agentic Cloud Orchestrator",
        "builder_name": "DevFest Hacker Team",
        "builder_email": "builder1@devfest.th",
        "category": "AI & Agents",
        "demo_url": "https://quickdraw.withgoogle.com",
        "github_url": "https://github.com/google/devfestverse",
        "description": "Multi-agent autonomous workflow pipeline deployed on Cloud Run with Gemini 2.0 function calling.",
        "tech_stack": ["Google Cloud Run", "Gemini 2.0", "FastAPI", "AlloyDB"],
        "upvotes": 42,
        "upvoted_by": ["user-partic-1"],
        "submitted_at": "2026-08-29T10:00:00Z"
    },
    {
        "id": "proj-vector-rag",
        "title": "Thai Speech Transcriber & RAG Chat",
        "builder_name": "Sara Cloud & Neo Dev",
        "builder_email": "sara@devfest.th",
        "category": "AI & Agents",
        "demo_url": "https://cloud.google.com/vertex-ai",
        "github_url": "https://github.com/gdgcloudbkk/vertex-rag",
        "description": "Real-time bilingual Thai/English transcription tool with sub-second vector embeddings.",
        "tech_stack": ["Vertex AI", "Cloud Speech", "Cloud Storage", "Flutter Web"],
        "upvotes": 38,
        "upvoted_by": [],
        "submitted_at": "2026-08-29T11:30:00Z"
    },
    {
        "id": "proj-flutter-wasm",
        "title": "Retro Pixel Game Hub (Flutter WebAssembly)",
        "builder_name": "GameDev GDG",
        "builder_email": "games@devfest.th",
        "category": "Web & Mobile",
        "demo_url": "https://flutter.github.io/samples/game_template",
        "github_url": "https://github.com/flutter/samples",
        "description": "High frame-rate 2D canvas game rendered with Flutter WebAssembly on Google Firebase Hosting.",
        "tech_stack": ["Flutter", "Wasm", "CanvasKit", "Firebase"],
        "upvotes": 29,
        "upvoted_by": [],
        "submitted_at": "2026-08-29T13:00:00Z"
    }
]

@router.get("/projects")
def list_builder_projects(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    """List all community submitted builder projects with category filtering and search."""
    results = BUILDER_PROJECTS_DB

    if category and category != "All":
        results = [p for p in results if p.get("category") == category]

    if search:
        s_lower = search.lower()
        results = [
            p for p in results 
            if s_lower in p["title"].lower() 
            or s_lower in p["description"].lower() 
            or s_lower in p["builder_name"].lower()
            or any(s_lower in t.lower() for t in p.get("tech_stack", []))
        ]

    return {
        "count": len(results),
        "projects": sorted(results, key=lambda x: x.get("upvotes", 0), reverse=True)
    }

@router.get("/projects/{project_id}")
def get_builder_project(project_id: str):
    proj = next((p for p in BUILDER_PROJECTS_DB if p["id"] == project_id), None)
    if not proj:
        raise HTTPException(status_code=404, detail="Builder project not found.")
    return proj

@router.post("/projects")
def submit_builder_project(req: BuilderProjectCreate, user: dict = Depends(get_current_user)):
    """Submit a community builder project to be showcased in the 2D Builder Zone."""
    proj_id = f"proj-{uuid.uuid4().hex[:8]}"
    
    # Normalize URL scheme
    demo_url = req.demo_url.strip()
    if not (demo_url.startswith("http://") or demo_url.startswith("https://")):
        demo_url = f"https://{demo_url}"

    new_project = {
        "id": proj_id,
        "title": req.title.strip(),
        "builder_name": req.builder_name.strip(),
        "builder_email": req.builder_email or user.get("email", ""),
        "category": req.category,
        "demo_url": demo_url,
        "github_url": req.github_url.strip() if req.github_url else None,
        "description": req.description.strip(),
        "tech_stack": req.tech_stack or ["Google Cloud", "DevFest 2026"],
        "thumbnail_url": req.thumbnail_url,
        "upvotes": 1,
        "upvoted_by": [user.get("id", "anonymous")],
        "user_id": user.get("id", "anonymous"),
        "submitted_at": datetime.utcnow().isoformat() + "Z"
    }

    BUILDER_PROJECTS_DB.append(new_project)

    # Persist to Firestore if available
    if firestore_manager.is_configured():
        try:
            firestore_manager.save_session("devfest-bangkok-2026", {
                "id": proj_id,
                "type": "BUILDER_PROJECT",
                **new_project
            })
        except Exception:
            pass

    return {
        "message": f"🎉 Project '{new_project['title']}' submitted successfully to Builder Zone!",
        "project": new_project
    }

@router.post("/projects/{project_id}/upvote")
def upvote_builder_project(project_id: str, user: dict = Depends(get_current_user)):
    """Upvote or clap for a community builder showcase project."""
    proj = next((p for p in BUILDER_PROJECTS_DB if p["id"] == project_id), None)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")

    u_id = user.get("id", "anonymous")
    if "upvoted_by" not in proj:
        proj["upvoted_by"] = []

    if u_id in proj["upvoted_by"]:
        # Toggle un-upvote
        proj["upvoted_by"].remove(u_id)
        proj["upvotes"] = max(0, proj["upvotes"] - 1)
        return {"message": "Upvote removed", "upvotes": proj["upvotes"], "has_upvoted": False}
    else:
        proj["upvoted_by"].append(u_id)
        proj["upvotes"] = proj.get("upvotes", 0) + 1
        return {"message": "🚀 Project upvoted!", "upvotes": proj["upvotes"], "has_upvoted": True}

@router.delete("/projects/{project_id}", dependencies=[Depends(require_roles([UserRole.ORGANIZER, UserRole.STAFF]))])
def delete_builder_project(project_id: str):
    """Delete project from Builder Showcase (Moderators / Organizers)."""
    global BUILDER_PROJECTS_DB
    proj = next((p for p in BUILDER_PROJECTS_DB if p["id"] == project_id), None)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found.")
    
    BUILDER_PROJECTS_DB = [p for p in BUILDER_PROJECTS_DB if p["id"] != project_id]
    return {"message": f"Project '{proj['title']}' removed from showcase."}
