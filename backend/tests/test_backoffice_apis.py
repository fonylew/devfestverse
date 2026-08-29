import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_list_active_users_as_organizer():
    response = client.get("/api/v1/backoffice/active-users", headers={"x-user-id": "user-org-1"})
    assert response.status_code == 200
    data = response.json()
    assert data["total_active_count"] >= 5

def test_change_user_role_as_organizer():
    response = client.post("/api/v1/backoffice/change-role", json={
        "user_id": "user-partic-1",
        "new_role": "STAFF"
    }, headers={"x-user-id": "user-org-1"})
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "STAFF"

def test_trigger_lucky_draw_as_organizer():
    response = client.post("/api/v1/lucky-draw/draw", headers={"x-user-id": "user-org-1"})
    assert response.status_code == 200
    assert "winner" in response.json()
