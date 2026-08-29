import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_list_community_billboards():
    response = client.get("/api/v1/community-billboards")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5
    categories = [b["category"] for b in data]
    assert "Facebook Page" in categories
    assert "Discord Server" in categories
    assert "YouTube Channel" in categories

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
