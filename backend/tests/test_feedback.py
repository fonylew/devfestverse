import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_feedback_flow():
    # Submit Feedback
    res = client.post("/api/v1/feedback", json={
        "overall_rating": 5,
        "content_rating": 5,
        "venue_rating": 5,
        "nps_score": 10,
        "comments": "The 2D venue and realtime AI transcripts were awesome!",
        "event_id": "devfest-bangkok-2026"
    }, headers={"x-user-id": "user-partic-1"})
    assert res.status_code == 200
    data = res.json()
    assert "feedback" in data
    assert data["feedback"]["overall_rating"] == 5
    assert data["feedback"]["nps_score"] == 10

def test_feedback_analytics_as_organizer():
    res = client.get("/api/v1/feedback/all", headers={"x-user-id": "user-org-1"})
    assert res.status_code == 200
    stats = res.json()
    assert stats["total_responses"] >= 2
    assert "average_overall" in stats
    assert "nps_score" in stats
    assert len(stats["feedbacks"]) >= 2
