import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_list_builder_projects():
    response = client.get("/api/v1/builders/projects")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] >= 3
    assert any("Agentic" in p["title"] for p in data["projects"])

def test_filter_and_search_builder_projects():
    response = client.get("/api/v1/builders/projects", params={"category": "AI & Agents", "search": "Transcriber"})
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    assert "Thai Speech" in data["projects"][0]["title"]

def test_submit_and_upvote_builder_project():
    # Submit Project
    submit_res = client.post("/api/v1/builders/projects", json={
        "title": "Cloud Run Game Server Cluster",
        "builder_name": "Antigravity Hacker",
        "category": "Cloud & DevOps",
        "demo_url": "https://devfestverse-game.run.app",
        "github_url": "https://github.com/google/game-server",
        "description": "High throughput WebSocket spatial cluster scaling to zero on Google Cloud Run.",
        "tech_stack": ["Cloud Run", "Python", "FastAPI", "WebSockets"]
    }, headers={"x-user-id": "user-partic-1"})
    
    assert submit_res.status_code == 200
    proj = submit_res.json()["project"]
    proj_id = proj["id"]
    assert proj["title"] == "Cloud Run Game Server Cluster"
    assert proj["upvotes"] == 1

    # Upvote
    upvote_res = client.post(f"/api/v1/builders/projects/{proj_id}/upvote", headers={"x-user-id": "user-partic-2"})
    assert upvote_res.status_code == 200
    assert upvote_res.json()["upvotes"] == 2

    # Delete as Organizer
    del_res = client.delete(f"/api/v1/builders/projects/{proj_id}", headers={"x-user-id": "user-org-1"})
    assert del_res.status_code == 200
