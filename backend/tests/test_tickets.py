import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_ticket_system_info():
    response = client.get("/api/v1/tickets/info")
    assert response.status_code == 200
    assert "official_registration_url" in response.json()

def test_verify_valid_ticket():
    response = client.post("/api/v1/tickets/verify", json={"ticket_ref": "TICKET-DEV-100"}, headers={"x-user-id": "user-partic-1"})
    assert response.status_code == 200
    data = response.json()
    assert data["verified_badge"] == "Verified Ticket Badge"
    assert data["user"]["verified_ticket"] is True

def test_verify_invalid_ticket():
    response = client.post("/api/v1/tickets/verify", json={"ticket_ref": "INVALID-TICKET-999"}, headers={"x-user-id": "user-partic-1"})
    assert response.status_code == 400
    assert "not found" in response.json()["detail"]
