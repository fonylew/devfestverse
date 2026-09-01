import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_list_agenda_sessions():
    response = client.get("/api/v1/sessions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["speaker_id"] == "user-speaker-1"

def test_list_agenda_sessions_with_track_filtering():
    # List all
    all_resp = client.get("/api/v1/sessions")
    assert all_resp.status_code == 200
    all_data = all_resp.json()
    assert len(all_data) >= 3

    # List tracks
    tracks_resp = client.get("/api/v1/sessions/tracks")
    assert tracks_resp.status_code == 200
    tracks = tracks_resp.json()["tracks"]
    assert "Main Keynote" in tracks
    assert "Track 1: AI & Agents" in tracks

    # Filter by track
    track1_resp = client.get("/api/v1/sessions?track=Track 1: AI & Agents")
    assert track1_resp.status_code == 200
    for s in track1_resp.json():
        assert s["track"] == "Track 1: AI & Agents"

def test_favorite_session_toggle_and_query():
    # Toggle favorite on
    fav_resp = client.post("/api/v1/sessions/session-gemini-live/favorite", headers={"x-user-id": "user-partic-1"})
    assert fav_resp.status_code == 200
    assert fav_resp.json()["is_favorite"] is True

    # Get favorites list
    list_fav = client.get("/api/v1/sessions/favorites", headers={"x-user-id": "user-partic-1"})
    assert list_fav.status_code == 200
    fav_ids = list_fav.json()["favorite_session_ids"]
    assert "session-gemini-live" in fav_ids

    # Toggle favorite off
    unfav_resp = client.post("/api/v1/sessions/session-gemini-live/favorite", headers={"x-user-id": "user-partic-1"})
    assert unfav_resp.status_code == 200
    assert unfav_resp.json()["is_favorite"] is False

def test_backoffice_session_crud():
    # Create session as Organizer
    create_resp = client.post("/api/v1/sessions", json={
        "title": "Quantum Computing on GCP",
        "description": "Intro to Cirq and quantum algorithms.",
        "speaker_id": "user-speaker-1",
        "speaker_name": "Quantum Specialist",
        "room": "Room D1",
        "track": "Track 1: AI & Agents",
        "start_time": "02:15 PM",
        "end_time": "03:15 PM"
    }, headers={"x-user-id": "user-org-1"})
    assert create_resp.status_code == 200
    created_sess = create_resp.json()["session"]
    sess_id = created_sess["id"]

    # Update session time and room as Organizer
    update_resp = client.put(f"/api/v1/sessions/{sess_id}", json={
        "start_time": "02:30 PM",
        "end_time": "03:30 PM",
        "room": "Room D2"
    }, headers={"x-user-id": "user-org-1"})
    assert update_resp.status_code == 200
    assert update_resp.json()["session"]["start_time"] == "02:30 PM"
    assert update_resp.json()["session"]["room"] == "Room D2"

    # Delete session as Organizer
    del_resp = client.delete(f"/api/v1/sessions/{sess_id}", headers={"x-user-id": "user-org-1"})
    assert del_resp.status_code == 200

def test_gemini_transcribe_chunk_stream_and_query():
    # Stream a transcribe chunk linked to session & speaker
    chunk_resp = client.post("/api/v1/transcribe/stream-chunk", json={
        "session_id": "session-keynote",
        "speaker_id": "user-speaker-1",
        "audio_text_chunk": "Gemini Live API delivers instant speech transcription.",
        "original_language": "en",
        "target_language": "th"
    })
    assert chunk_resp.status_code == 200
    assert "live_caption" in chunk_resp.json()

    # Query transcripts by session
    sess_resp = client.get("/api/v1/transcribe/session/session-keynote")
    assert sess_resp.status_code == 200
    assert sess_resp.json()["transcript_count"] >= 1

    # Query transcripts by speaker
    spk_resp = client.get("/api/v1/transcribe/speaker/user-speaker-1")
    assert spk_resp.status_code == 200
    assert spk_resp.json()["transcript_count"] >= 1

def test_parse_session_details_with_gemini():
    res = client.post("/api/v1/sessions/parse-gemini", json={
        "raw_text": "Dr. Sarah Lin talking about Serverless Kubernetes and Cloud Run Autoscaling at 1:30 PM to 2:30 PM in Room B1 for Track 2: Cloud & DevOps"
    }, headers={"x-user-id": "user-org-1"})
    assert res.status_code == 200
    data = res.json()
    assert "parsed_session" in data
    sess = data["parsed_session"]
    assert "Sarah Lin" in sess["speaker_name"]
    assert sess["track"] == "Track 2: Cloud & DevOps"
    assert "Room B1" in sess["room"]
    assert "1:30 PM" in sess["start_time"]
    assert "key_takeaways" in sess


