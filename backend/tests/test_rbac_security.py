import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.rbac import UserRole
from backend.app.core.firestore import firestore_manager

client = TestClient(app)

# Helper headers
PARTICIPANT_HEADERS = {"x-user-id": "user-sec-partic", "x-event-id": "devfest-bangkok-2026"}
STAFF_HEADERS = {"x-user-id": "user-staff-1", "x-event-id": "devfest-bangkok-2026"}
ORGANIZER_HEADERS = {"x-user-id": "user-org-1", "x-event-id": "devfest-bangkok-2026"}

@pytest.fixture(autouse=True)
def reset_participant_role():
    firestore_manager.upsert_user({
        "id": "user-sec-partic",
        "email": "secpartic@devfestverse.io",
        "display_name": "Security Participant",
        "global_role": "PARTICIPANT",
        "role": "PARTICIPANT",
        "events": {
            "devfest-bangkok-2026": {
                "role": "PARTICIPANT",
                "verified_ticket": False
            }
        }
    })
    yield
    firestore_manager.upsert_user({
        "id": "user-sec-partic",
        "email": "secpartic@devfestverse.io",
        "display_name": "Security Participant",
        "global_role": "PARTICIPANT",
        "role": "PARTICIPANT",
        "events": {
            "devfest-bangkok-2026": {
                "role": "PARTICIPANT",
                "verified_ticket": False
            }
        }
    })

def test_participant_cannot_access_backoffice_users():
    """Ensure regular participant cannot view or manage users."""
    resp = client.get("/api/v1/backoffice/users", headers=PARTICIPANT_HEADERS)
    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()

def test_participant_cannot_escalate_role():
    """Ensure participant cannot call role promotion endpoint."""
    resp = client.post(
        "/api/v1/backoffice/users/user-sec-partic/role",
        json={"new_role": "ORGANIZER"},
        headers=PARTICIPANT_HEADERS
    )
    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()

def test_staff_cannot_escalate_user_to_organizer():
    """Ensure staff member cannot escalate roles (organizer only)."""
    resp = client.post(
        "/api/v1/backoffice/users/user-sec-partic/role",
        json={"new_role": "ORGANIZER"},
        headers=STAFF_HEADERS
    )
    assert resp.status_code == 403
    assert "not authorized" in resp.json()["detail"].lower()

def test_participant_cannot_call_legacy_change_role():
    """Ensure participant cannot call legacy change-role endpoint."""
    resp = client.post(
        "/api/v1/backoffice/change-role",
        json={"user_id": "user-sec-partic", "new_role": "ORGANIZER"},
        headers=PARTICIPANT_HEADERS
    )
    assert resp.status_code == 403

def test_participant_cannot_generate_invite_links():
    """Ensure participant cannot create role invitation tokens."""
    resp = client.post(
        "/api/v1/invites/generate",
        json={"role": "SPEAKER"},
        headers=PARTICIPANT_HEADERS
    )
    assert resp.status_code == 403

def test_organizer_cannot_generate_organizer_invite_links():
    """Ensure organizer invite tokens cannot be minted to prevent unauthorized privilege delegation."""
    resp = client.post(
        "/api/v1/invites/generate",
        json={"role": "ORGANIZER"},
        headers=ORGANIZER_HEADERS
    )
    assert resp.status_code == 400
    assert "only for speaker, sponsor, or staff" in resp.json()["detail"].lower()

def test_fake_or_unissued_invite_token_rejected():
    """Ensure unissued or crafted tokens cannot be redeemed."""
    resp = client.post(
        "/api/v1/invites/redeem",
        json={"token": "token-crafted-fake-9999", "user_id": "user-sec-partic"},
        headers=PARTICIPANT_HEADERS
    )
    assert resp.status_code == 400
    assert "invalid or spent" in resp.json()["detail"].lower()

def test_invite_token_single_use_enforcement():
    """Ensure an invitation token cannot be redeemed twice."""
    # 1. Organizer generates invite token
    gen_resp = client.post(
        "/api/v1/invites/generate",
        json={"role": "SPEAKER"},
        headers=ORGANIZER_HEADERS
    )
    assert gen_resp.status_code == 200
    token = gen_resp.json()["token"]

    # 2. First redemption succeeds
    red_resp = client.post(
        "/api/v1/invites/redeem",
        json={"token": token, "user_id": "user-sec-partic"},
        headers=PARTICIPANT_HEADERS
    )
    assert red_resp.status_code == 200
    assert red_resp.json()["user"]["role"] == "SPEAKER"

    # 3. Second redemption fails (replay attack prevention)
    replay_resp = client.post(
        "/api/v1/invites/redeem",
        json={"token": token, "user_id": "user-sec-partic-2"},
        headers=PARTICIPANT_HEADERS
    )
    assert replay_resp.status_code == 400
    assert "invalid or spent" in replay_resp.json()["detail"].lower()

def test_participant_cannot_create_or_delete_sessions():
    """Ensure participant cannot create or delete agenda sessions."""
    # Create
    create_resp = client.post(
        "/api/v1/sessions",
        json={
            "title": "Malicious Session",
            "description": "Unauthorized",
            "speaker_name": "Attacker",
            "room": "Grand Ballroom",
            "start_time": "10:00 AM",
            "end_time": "11:00 AM"
        },
        headers=PARTICIPANT_HEADERS
    )
    assert create_resp.status_code == 403

    # Delete
    del_resp = client.delete(
        "/api/v1/sessions/session-keynote",
        headers=PARTICIPANT_HEADERS
    )
    assert del_resp.status_code == 403

def test_participant_cannot_trigger_lucky_draw():
    """Ensure participant cannot trigger the lucky draw raffle."""
    resp = client.post("/api/v1/lucky-draw/draw", headers=PARTICIPANT_HEADERS)
    assert resp.status_code == 403

def test_participant_cannot_toggle_feedback():
    """Ensure participant cannot toggle feedback system settings."""
    resp = client.post("/api/v1/feedback/toggle?enabled=false", headers=PARTICIPANT_HEADERS)
    assert resp.status_code == 403

def test_participant_cannot_switch_active_event():
    """Ensure participant cannot switch global event archive context."""
    resp = client.post(
        "/api/v1/events/switch",
        json={"event_id": "event-devfest-2025"},
        headers=PARTICIPANT_HEADERS
    )
    assert resp.status_code == 403

def test_participant_cannot_add_bgm_track():
    """Ensure participant cannot modify background music playlist."""
    resp = client.post(
        "/api/v1/bgm",
        json={"title": "Rogue Track", "zone": "Global", "type": "YOUTUBE", "url": "https://youtube.com"},
        headers=PARTICIPANT_HEADERS
    )
    assert resp.status_code == 403

def test_participant_cannot_upsert_event_data():
    """Ensure participant cannot modify top-level Firestore events."""
    resp = client.post(
        "/api/v1/firestore/events",
        json={
            "event_id": "test-event",
            "event_name": "Test Event",
            "date": "2026-11-28",
            "venue": {"name": "Test", "address": "Bangkok", "rooms": []}
        },
        headers=PARTICIPANT_HEADERS
    )
    assert resp.status_code == 403

def test_participant_cannot_view_staff_announcements():
    """Ensure participant cannot read private staff-only announcements."""
    resp = client.get("/api/v1/announcements/staff", headers=PARTICIPANT_HEADERS)
    assert resp.status_code == 403

def test_participant_cannot_delete_builder_project():
    """Ensure participant cannot delete community builder projects."""
    resp = client.delete("/api/v1/builders/projects/proj-agentverse", headers=PARTICIPANT_HEADERS)
    assert resp.status_code == 403
