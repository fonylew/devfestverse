import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_list_firestore_events():
    response = client.get("/api/v1/firestore/events")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["event_id"] == "devfest-bangkok-2026"
    assert "attendance_summary" in data[0]

def test_get_firestore_event_by_id():
    response = client.get("/api/v1/firestore/events/devfest-bangkok-2026")
    assert response.status_code == 200
    data = response.json()
    assert data["event_name"] == "GDG Cloud Bangkok DevFest 2026"
    assert data["date"] == "2026-11-28"
    assert "venue" in data
    assert "Grand Ballroom" in data["venue"]["rooms"]
    assert "speakers" in data
    assert len(data["speakers"]) >= 1
    assert "sessions" in data
    assert "sponsors" in data
    assert "workshops" in data

def test_update_firestore_event_metadata():
    response = client.put("/api/v1/firestore/events/devfest-bangkok-2026/metadata", json={
        "date": "2026-11-29",
        "venue": {
            "name": "True Digital Park Grand Hall (Expanded)",
            "address": "101 Sukhumvit Rd, Bangkok",
            "rooms": ["Grand Ballroom", "Room A1", "Room B1", "AI Arena"]
        },
        "metadata": {
            "expected_capacity": 1500,
            "badge_printer_enabled": True
        }
    }, headers={"x-user-id": "user-org-1"})
    assert response.status_code == 200
    data = response.json()["event"]
    assert data["date"] == "2026-11-29"
    assert data["venue"]["name"] == "True Digital Park Grand Hall (Expanded)"
    assert data["metadata"]["expected_capacity"] == 1500

def test_checkin_participant_and_track_show_up_rate():
    # Check in registered participant user-partic-1
    checkin_resp = client.post("/api/v1/firestore/events/devfest-bangkok-2026/checkin", json={
        "ticket_ref_or_user_id": "user-partic-1",
        "notes": "Checked in at Gate A - Morning Session"
    }, headers={"x-user-id": "user-staff-1"})
    assert checkin_resp.status_code == 200
    res_data = checkin_resp.json()
    assert res_data["participant"]["attended"] is True
    assert res_data["participant"]["checked_in_at"] is not None
    assert res_data["participant"]["scanned_by"] == "user-staff-1"
    assert res_data["attendance_summary"]["total_attended"] >= 1

    # Query live attendance stats
    att_resp = client.get("/api/v1/firestore/events/devfest-bangkok-2026/attendance")
    assert att_resp.status_code == 200
    att_data = att_resp.json()
    assert att_data["attendance_summary"]["show_up_rate_percent"] > 0
    assert len(att_data["participants"]) >= 2
