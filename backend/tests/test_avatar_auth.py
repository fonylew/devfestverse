import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_get_avatar_config():
    response = client.get("/api/v1/avatar/config", headers={"x-user-id": "user-partic-1"})
    assert response.status_code == 200
    data = response.json()
    assert "config" in data
    assert "svg_avatar" in data
    assert "<svg" in data["svg_avatar"]

def test_customize_avatar():
    payload = {
        "skin_tone": "#FCD34D",
        "hair_style": "spiky",
        "hair_color": "#EF4444",
        "outfit_style": "cyber_jacket",
        "outfit_color": "#8B5CF6",
        "headwear": "google_glasses",
        "aura": "cloud_pet",
        "theme": "cyberpunk"
    }
    response = client.post("/api/v1/avatar/customize", json=payload, headers={"x-user-id": "user-partic-1"})
    assert response.status_code == 200
    data = response.json()
    assert data["config"]["hair_style"] == "spiky"
    assert data["config"]["headwear"] == "google_glasses"
    assert "<svg" in data["svg_avatar"]

def test_ai_generate_avatar():
    response = client.post("/api/v1/avatar/ai-generate", json={
        "prompt": "Cyberpunk Google Cloud hacker with vr headset and green matrix glow"
    }, headers={"x-user-id": "user-partic-1"})
    assert response.status_code == 200
    data = response.json()
    assert "config" in data
    assert data["config"]["headwear"] == "vr_headset"
    assert data["config"]["aura"] == "matrix_glow"
    assert "<svg" in data["svg_avatar"]

def test_google_login_with_avatar_config():
    response = client.post("/api/v1/auth/google-login", json={
        "google_token": "token-xyz-123",
        "email": "agent.smith@gdgcloudbkk.org",
        "display_name": "Agent Smith",
        "avatar_config": {
            "skin_tone": "#FBBF24",
            "hair_style": "short",
            "hair_color": "#1E293B",
            "outfit_style": "gdg_hoodie",
            "outfit_color": "#4285F4",
            "headwear": "devfest_cap",
            "aura": "ai_sparkles",
            "theme": "devfest-standard"
        }
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "agent.smith@gdgcloudbkk.org"
    assert data["user"]["avatar_config"]["headwear"] == "devfest_cap"
    assert "<svg" in data["user"]["avatar_svg"]
