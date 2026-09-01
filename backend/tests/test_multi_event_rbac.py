import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.firestore import firestore_manager

client = TestClient(app)

def test_multi_event_role_isolation():
    # Setup dedicated test user with multi-event roles
    firestore_manager.upsert_user({
        "id": "user-multi-tester",
        "email": "multitester@gdgcloudbkk.org",
        "display_name": "Multi Tester",
        "global_role": "PARTICIPANT",
        "role": "PARTICIPANT",
        "events": {
            "devfest-bangkok-2026": {
                "role": "PARTICIPANT",
                "ticket_ref": "TICKET-DEV-MULTI",
                "verified_ticket": True
            },
            "gdg-ai-hackathon-2026": {
                "role": "SPEAKER",
                "ticket_ref": "TICKET-HACK-MULTI",
                "verified_ticket": True
            }
        }
    })

    role_devfest = firestore_manager.get_user_role_in_event("user-multi-tester", "devfest-bangkok-2026")
    assert role_devfest["role"] == "PARTICIPANT"

    role_hackathon = firestore_manager.get_user_role_in_event("user-multi-tester", "gdg-ai-hackathon-2026")
    assert role_hackathon["role"] == "SPEAKER"

def test_context_aware_rbac_header_resolution():
    firestore_manager.upsert_user({
        "id": "user-multi-staff-tester",
        "email": "stafftester@gdgcloudbkk.org",
        "display_name": "Staff Tester",
        "global_role": "PARTICIPANT",
        "role": "PARTICIPANT",
        "events": {
            "devfest-bangkok-2026": {
                "role": "PARTICIPANT"
            },
            "cloud-community-day-2026": {
                "role": "STAFF"
            }
        }
    })

    # 1. DevFest context: user is PARTICIPANT -> forbidden from backoffice
    resp_devfest = client.get("/api/v1/backoffice/users", headers={
        "x-user-id": "user-multi-staff-tester",
        "x-event-id": "devfest-bangkok-2026"
    })
    assert resp_devfest.status_code == 403

    # 2. Cloud Community Day context: user is STAFF -> backoffice access allowed!
    resp_ccd = client.get("/api/v1/backoffice/users", headers={
        "x-user-id": "user-multi-staff-tester",
        "x-event-id": "cloud-community-day-2026"
    })
    assert resp_ccd.status_code == 200


def test_backoffice_event_scoped_user_listing_and_stats():
    # List attendees for AI Hackathon
    hack_resp = client.get("/api/v1/backoffice/users?event_id=gdg-ai-hackathon-2026", headers={
        "x-user-id": "user-org-1",
        "x-event-id": "devfest-bangkok-2026"
    })
    assert hack_resp.status_code == 200
    hack_data = hack_resp.json()
    assert "users" in hack_data
    assert any(u["id"] == "user-partic-1" and u["effective_role"] == "SPEAKER" for u in hack_data["users"])

    # Get event stats for AI Hackathon
    stats_resp = client.get("/api/v1/backoffice/users/stats?event_id=gdg-ai-hackathon-2026", headers={
        "x-user-id": "user-org-1"
    })
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["event_id"] == "gdg-ai-hackathon-2026"
    assert stats["by_role"]["SPEAKER"] >= 1

def test_user_event_membership_crud():
    # Query user events
    events_resp = client.get("/api/v1/backoffice/users/user-partic-1/events", headers={
        "x-user-id": "user-org-1"
    })
    assert events_resp.status_code == 200
    user_events = events_resp.json()["events"]
    assert len(user_events) >= 2
    event_ids = [e["event_id"] for e in user_events]
    assert "devfest-bangkok-2026" in event_ids
    assert "gdg-ai-hackathon-2026" in event_ids

    # Change user role in a specific event
    role_change_resp = client.post(
        "/api/v1/backoffice/users/user-partic-1/role?event_id=cloud-community-day-2026",
        json={"new_role": "SPEAKER"},
        headers={"x-user-id": "user-org-1"}
    )
    assert role_change_resp.status_code == 200
    assert role_change_resp.json()["event_id"] == "cloud-community-day-2026"

    # Verify updated role in that event
    role_check = firestore_manager.get_user_role_in_event("user-partic-1", "cloud-community-day-2026")
    assert role_check["role"] == "SPEAKER"

    # Assign event ticket
    ticket_change_resp = client.post(
        "/api/v1/backoffice/users/user-partic-1/ticket?event_id=cloud-community-day-2026",
        json={"ticket_ref": "TICKET-CCD-DEV-777", "verified": True},
        headers={"x-user-id": "user-org-1"}
    )
    assert ticket_change_resp.status_code == 200
    ticket_check = firestore_manager.get_user_role_in_event("user-partic-1", "cloud-community-day-2026")
    assert ticket_check["ticket_ref"] == "TICKET-CCD-DEV-777"
    assert ticket_check["verified_ticket"] is True

def test_event_scoped_invite_flow():
    # 1. Create invite for gdg-ai-hackathon-2026 as SPEAKER
    gen_resp = client.post("/api/v1/invites/generate", json={
        "role": "SPEAKER",
        "event_id": "gdg-ai-hackathon-2026"
    }, headers={"x-user-id": "user-org-1"})
    assert gen_resp.status_code == 200
    token_data = gen_resp.json()
    token = token_data["token"]
    assert token_data["event_id"] == "gdg-ai-hackathon-2026"

    # 2. Validate token
    val_resp = client.get(f"/api/v1/invites/validate?token={token}")
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    assert val_data["valid"] is True
    assert val_data["role"] == "SPEAKER"
    assert val_data["event_id"] == "gdg-ai-hackathon-2026"

    # 3. Create a fresh participant user
    new_user = firestore_manager.upsert_user({
        "id": "user-fresh-guest",
        "email": "freshguest@bangkok.dev",
        "display_name": "Fresh Guest",
        "global_role": "PARTICIPANT",
        "role": "PARTICIPANT"
    })

    # 4. Redeem token
    red_resp = client.post("/api/v1/invites/redeem", json={
        "token": token,
        "user_id": "user-fresh-guest"
    })
    assert red_resp.status_code == 200
    assert red_resp.json()["event_id"] == "gdg-ai-hackathon-2026"

    # Verify user is SPEAKER in Hackathon, but default PARTICIPANT in DevFest
    hack_role = firestore_manager.get_user_role_in_event("user-fresh-guest", "gdg-ai-hackathon-2026")
    devfest_role = firestore_manager.get_user_role_in_event("user-fresh-guest", "devfest-bangkok-2026")
    assert hack_role["role"] == "SPEAKER"
    assert devfest_role["role"] == "PARTICIPANT"
