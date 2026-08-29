from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.api import (
    auth,
    invites,
    tickets,
    community_billboards,
    sponsors,
    avatar,
    sessions,
    transcribe,
    workshops,
    qna,
    announcements,
    feedback,
    lucky_draw,
    bgm,
    events,
    backoffice,
    firestore_admin
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS setup for Web PWA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all V1 Routers
api_v1_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=api_v1_prefix)
app.include_router(invites.router, prefix=api_v1_prefix)
app.include_router(tickets.router, prefix=api_v1_prefix)
app.include_router(community_billboards.router, prefix=api_v1_prefix)
app.include_router(sponsors.router, prefix=api_v1_prefix)
app.include_router(avatar.router, prefix=api_v1_prefix)
app.include_router(sessions.router, prefix=api_v1_prefix)
app.include_router(transcribe.router, prefix=api_v1_prefix)
app.include_router(workshops.router, prefix=api_v1_prefix)
app.include_router(qna.router, prefix=api_v1_prefix)
app.include_router(announcements.router, prefix=api_v1_prefix)
app.include_router(feedback.router, prefix=api_v1_prefix)
app.include_router(lucky_draw.router, prefix=api_v1_prefix)
app.include_router(bgm.router, prefix=api_v1_prefix)
app.include_router(events.router, prefix=api_v1_prefix)
app.include_router(backoffice.router, prefix=api_v1_prefix)
app.include_router(firestore_admin.router, prefix=api_v1_prefix)

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Static Frontend mounting for standalone container deployment
frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend")

if os.path.exists(frontend_path):
    # Mount subdirectories
    src_dir = os.path.join(frontend_path, "src")
    if os.path.exists(src_dir):
        app.mount("/src", StaticFiles(directory=src_dir), name="src")
    
    public_dir = os.path.join(frontend_path, "public")
    if os.path.exists(public_dir):
        app.mount("/public", StaticFiles(directory=public_dir), name="public")
        
    assets_dir = os.path.join(frontend_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/")
def serve_root():
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "app": settings.PROJECT_NAME,
        "community": "GDG Cloud Bangkok",
        "status": "online",
        "docs": "/docs"
    }

@app.get("/favicon.ico")
def serve_favicon():
    fav = os.path.join(frontend_path, "favicon.ico")
    if os.path.exists(fav):
        return FileResponse(fav)
    return {"detail": "favicon not found"}

@app.get("/favicon.png")
def serve_favicon_png():
    fav = os.path.join(frontend_path, "favicon.png")
    if os.path.exists(fav):
        return FileResponse(fav)
    return {"detail": "favicon not found"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "devfestverse", "project": "gdg-cloud-bangkok-2026"}
