import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_quick_register():
    response = client.post("/api/v1/auth/register", json={"display_name": "Test Participant"})
    assert response.status_code == 200
    data = response.json()
    assert "user_id" in data
    assert data["user"]["display_name"] == "Test Participant"
    assert data["user"]["role"] == "PARTICIPANT"

def test_google_login():
    response = client.post("/api/v1/auth/google-login", json={
        "google_token": "mock-google-oauth-token",
        "email": "testuser@gmail.com",
        "display_name": "Google Test User"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "testuser@gmail.com"

def test_generate_and_redeem_invite_link():
    # Generate Speaker Invite Link as Organizer
    gen_resp = client.post("/api/v1/invites/generate", json={"role": "SPEAKER"}, headers={"x-user-id": "user-org-1"})
    assert gen_resp.status_code == 200
    token_data = gen_resp.json()
    token = token_data["token"]
    assert token_data["role"] == "SPEAKER"

    # Validate token
    val_resp = client.get(f"/api/v1/invites/validate?token={token}")
    assert val_resp.status_code == 200
    assert val_resp.json()["valid"] is True

    # Redeem token as Participant
    red_resp = client.post("/api/v1/invites/redeem", json={"token": token, "user_id": "user-partic-1"})
    assert red_resp.status_code == 200
    assert red_resp.json()["user"]["role"] == "SPEAKER"

def test_auth_config_serves_google_client_id_from_env(monkeypatch):
    from backend.app.core.config import Settings
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "123456789-custom-container-client-id.apps.googleusercontent.com")
    new_settings = Settings()
    assert new_settings.GOOGLE_CLIENT_ID == "123456789-custom-container-client-id.apps.googleusercontent.com"
    
    # Test API endpoint
    import backend.app.api.auth as auth_module
    monkeypatch.setattr(auth_module.settings, "GOOGLE_CLIENT_ID", "123456789-custom-container-client-id.apps.googleusercontent.com")
    resp = client.get("/api/v1/auth/config")
    assert resp.status_code == 200
    assert resp.json()["google_client_id"] == "123456789-custom-container-client-id.apps.googleusercontent.com"
