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
