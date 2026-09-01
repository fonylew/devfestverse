import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.firestore import firestore_manager
from backend.app.core.config import settings

client = TestClient(app)

def test_firestore_user_crud_and_stats():
    # 1. Check initial stats
    stats = firestore_manager.get_user_stats()
    assert stats["project_id"] == settings.GCP_PROJECT
    assert stats["total_users"] >= 5
    assert stats["by_role"]["ORGANIZER"] >= 1

    # 2. Upsert user
    test_user = {
        "id": "test-firestore-user-1",
        "email": "clouddeveloper@gmail.com",
        "display_name": "Cloud Dev 2026",
        "role": "PARTICIPANT",
        "verified_ticket": False,
        "auth_provider": "google"
    }
    saved = firestore_manager.upsert_user(test_user)
    assert saved["id"] == "test-firestore-user-1"
    assert saved["email"] == "clouddeveloper@gmail.com"

    # 3. Retrieve user
    retrieved = firestore_manager.get_user("test-firestore-user-1")
    assert retrieved is not None
    assert retrieved["display_name"] == "Cloud Dev 2026"

    # 4. Search and list users
    res = firestore_manager.list_users(search="Cloud Dev 2026")
    assert res["total"] >= 1
    assert any(u["id"] == "test-firestore-user-1" for u in res["users"])

    # 5. Update user role
    updated = firestore_manager.update_user_role("test-firestore-user-1", "SPEAKER")
    assert updated["role"] == "SPEAKER"

    # 6. Update user ticket
    ticketed = firestore_manager.update_user_ticket("test-firestore-user-1", "TICKET-BANGKOK-777", verified=True)
    assert ticketed["verified_ticket"] is True
    assert ticketed["ticket_ref"] == "TICKET-BANGKOK-777"

    # 7. Delete user
    deleted = firestore_manager.delete_user("test-firestore-user-1")
    assert deleted is True
    assert firestore_manager.get_user("test-firestore-user-1") is None

def test_google_login_firestore_sync():
    # Perform Google Login with mock token
    resp = client.post("/api/v1/auth/google-login", json={
        "google_token": "mock-google-id-token-bangkok",
        "email": "newgoogledev@gmail.com",
        "display_name": "New Google Dev"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == settings.GCP_PROJECT
    assert data["user"]["email"] == "newgoogledev@gmail.com"
    assert data["user"]["role"] == "PARTICIPANT"
    user_id = data["user"]["id"]

    # Verify user exists in Firestore repository
    user_in_fs = firestore_manager.get_user(user_id)
    assert user_in_fs is not None
    assert user_in_fs["auth_provider"] == "google"

def test_backoffice_users_api_as_organizer():
    # List all users
    list_resp = client.get("/api/v1/backoffice/users", headers={"x-user-id": "user-org-1"})
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert "users" in list_data
    assert list_data["total"] >= 5

    # Filter by role
    speaker_resp = client.get("/api/v1/backoffice/users?role=SPEAKER", headers={"x-user-id": "user-org-1"})
    assert speaker_resp.status_code == 200
    speakers = speaker_resp.json()["users"]
    assert all(s["role"] == "SPEAKER" for s in speakers)

    # Get user stats
    stats_resp = client.get("/api/v1/backoffice/users/stats", headers={"x-user-id": "user-org-1"})
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["project_id"] == settings.GCP_PROJECT
    assert "by_role" in stats

    # Create new user via backoffice
    create_resp = client.post("/api/v1/backoffice/users", json={
        "email": "staff.vip@gdgcloudbkk.org",
        "display_name": "Staff VIP",
        "role": "STAFF",
        "verified_ticket": True,
        "ticket_ref": "TICKET-STAFF-999"
    }, headers={"x-user-id": "user-org-1"})
    assert create_resp.status_code == 200
    created_id = create_resp.json()["user"]["id"]

    # Update role to ORGANIZER
    role_resp = client.post(f"/api/v1/backoffice/users/{created_id}/role", json={
        "new_role": "ORGANIZER"
    }, headers={"x-user-id": "user-org-1"})
    assert role_resp.status_code == 200
    assert role_resp.json()["user"]["role"] == "ORGANIZER"

    # Assign ticket
    ticket_resp = client.post(f"/api/v1/backoffice/users/{created_id}/ticket", json={
        "ticket_ref": "TICKET-SUPER-VIP",
        "verified": True
    }, headers={"x-user-id": "user-org-1"})
    assert ticket_resp.status_code == 200
    assert ticket_resp.json()["user"]["ticket_ref"] == "TICKET-SUPER-VIP"

    # Delete user via backoffice
    del_resp = client.delete(f"/api/v1/backoffice/users/{created_id}", headers={"x-user-id": "user-org-1"})
    assert del_resp.status_code == 200

def test_backoffice_users_forbidden_for_participant():
    # Ensure participant user exists with PARTICIPANT role
    firestore_manager.upsert_user({
        "id": "user-pure-participant",
        "email": "purepartic@bangkok.dev",
        "display_name": "Pure Participant",
        "role": "PARTICIPANT"
    })
    resp = client.get("/api/v1/backoffice/users", headers={"x-user-id": "user-pure-participant"})
    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()

