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

def test_list_sponsors():
    response = client.get("/api/v1/sponsors")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert "iframe_url" in data[0]

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

