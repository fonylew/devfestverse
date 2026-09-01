import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_list_community_billboards():
    response = client.get("/api/v1/community-billboards")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 6
    urls = {b["id"]: b["url"] for b in data}
    assert urls["bb-chapter"] == "https://gdg.community.dev/gdg-cloud-bangkok/"
    assert urls["bb-fb-page"] == "https://www.facebook.com/profile.php?id=61583002384772"
    assert urls["bb-fb-group"] == "https://www.facebook.com/groups/gdgcloudbkk/"
    assert urls["bb-discord"] == "https://discord.gg/CBbPpNvmS"
    assert urls["bb-instagram"] == "https://www.instagram.com/gdgcloudbkk"
    assert urls["bb-youtube"] == "https://www.youtube.com/@gdgcloudbangkok"

def test_update_community_billboard_as_organizer():
    response = client.put(
        "/api/v1/community-billboards/bb-discord",
        json={"title": "GDG Cloud BKK Official Discord Hub"},
        headers={"x-user-id": "user-org-1"}
    )
    assert response.status_code == 200
    assert response.json()["billboard"]["title"] == "GDG Cloud BKK Official Discord Hub"

def test_list_sponsors_includes_swag_shop():
    response = client.get("/api/v1/sponsors")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    swag_booth = next((b for b in data if b["id"] == "booth-swag-shop"), None)
    assert swag_booth is not None
    assert swag_booth["iframe_url"] == "https://shop.line.me/@837etxse"
    assert "Swag" in swag_booth["name"]

def test_generate_custom_booth_design():
    res = client.post("/api/v1/sponsors/generate-booth", json={
        "booth_type": "swag_shop",
        "name": "GDG Bangkok Cyber Store",
        "theme_style": "sunset_glass",
        "theme_color": "#F59E0B",
        "target_url": "https://shop.line.me/@837etxse"
    }, headers={"x-user-id": "user-org-1"})
    assert res.status_code == 200
    data = res.json()
    assert "booth" in data
    assert data["booth"]["name"] == "GDG Bangkok Cyber Store"
    assert data["booth"]["theme_color"] == "#F59E0B"
    assert data["booth"]["iframe_url"] == "https://shop.line.me/@837etxse"

def test_upsert_custom_booth():
    res = client.post("/api/v1/sponsors", json={
        "id": "booth-ai-agents",
        "name": "Gemini 2.0 Agent Sandbox",
        "tier": "AI Sandbox",
        "iframe_url": "https://cloud.google.com/vertex-ai",
        "description": "Live AI agent playground on GCP",
        "theme_color": "#00E5FF"
    }, headers={"x-user-id": "user-org-1"})
    assert res.status_code == 200
    assert "Gemini 2.0" in res.json()["booth"]["name"]

def test_parse_sponsor_details_with_gemini():
    res = client.post("/api/v1/sponsors/parse-gemini", json={
        "raw_text": "Cloudflare is a Title Sponsor for DevFest Bangkok 2026. Empowering developers with edge computing at https://cloudflare.com"
    }, headers={"x-user-id": "user-org-1"})
    assert res.status_code == 200
    data = res.json()
    assert "parsed_sponsor" in data
    sp = data["parsed_sponsor"]
    assert "Cloudflare" in sp["name"]
    assert sp["tier"] == "Title Sponsor"
    assert "cloudflare.com" in sp["iframe_url"]

