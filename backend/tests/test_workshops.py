import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_list_workshops():
    response = client.get("/api/v1/workshops")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2

def test_reserve_workshop_seat():
    response = client.post("/api/v1/workshops/reserve", json={"workshop_id": "ws-1"}, headers={"x-user-id": "user-partic-1"})
    assert response.status_code == 200
    data = response.json()
    assert "pass_code" in data
    assert data["room_code"] == "Room W1"
