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

def test_feedback_per_event_isolation():
    # Submit for Hackathon event
    res = client.post("/api/v1/feedback", json={
        "overall_rating": 4,
        "content_rating": 4,
        "venue_rating": 5,
        "nps_score": 9,
        "comments": "Great AI Hackathon challenges and mentors!",
        "event_id": "gdg-ai-hackathon-2026"
    }, headers={"x-user-id": "user-partic-2"})
    assert res.status_code == 200

    # Query feedback scoped to Hackathon event
    hackathon_res = client.get("/api/v1/feedback/all?event_id=gdg-ai-hackathon-2026", headers={"x-user-id": "user-org-1"})
    assert hackathon_res.status_code == 200
    h_data = hackathon_res.json()
    assert h_data["event_id"] == "gdg-ai-hackathon-2026"
    assert any("AI Hackathon" in f.get("comments", "") for f in h_data["feedbacks"])

def test_qna_per_event_submission_and_upvote():
    # Submit Q&A for DevFest 2026
    sub_res = client.post("/api/v1/qna", json={
        "question": "Will session recordings and slides be uploaded after DevFest?",
        "event_id": "devfest-bangkok-2026"
    }, headers={"x-user-id": "user-partic-1"})
    assert sub_res.status_code == 200
    q_id = sub_res.json()["question"]["id"]

    # List Q&A for DevFest 2026
    list_res = client.get("/api/v1/qna?event_id=devfest-bangkok-2026")
    assert list_res.status_code == 200
    questions = list_res.json()
    assert any(q["id"] == q_id for q in questions)

    # Upvote question
    up_res = client.post(f"/api/v1/qna/{q_id}/upvote?event_id=devfest-bangkok-2026", headers={"x-user-id": "user-partic-2"})
    assert up_res.status_code == 200
    assert up_res.json()["upvotes"] >= 2

def test_dual_section_feedback_flow():
    # Submit feedback with both Section 1 (Event) and Section 2 (Platform)
    res = client.post("/api/v1/feedback", json={
        "overall_rating": 5,
        "content_rating": 5,
        "venue_rating": 4,
        "nps_score": 10,
        "event_comments": "Loved the keynote and live AI demos!",
        "platform_rating": 5,
        "platform_avatar_rating": 5,
        "platform_navigation_rating": 5,
        "platform_comments": "The 2D campus and GDG Lead welcome interaction were super immersive.",
        "event_id": "devfest-bangkok-2026"
    }, headers={"x-user-id": "user-partic-1"})
    assert res.status_code == 200
    data = res.json()
    fb = data["feedback"]
    assert fb["overall_rating"] == 5
    assert fb["platform_rating"] == 5
    assert fb["event_comments"] == "Loved the keynote and live AI demos!"
    assert "GDG Lead" in fb["platform_comments"]

    # Check analytics endpoint returns average_platform
    analytics_res = client.get("/api/v1/feedback/all?event_id=devfest-bangkok-2026", headers={"x-user-id": "user-org-1"})
    assert analytics_res.status_code == 200
    a_data = analytics_res.json()
    assert "average_platform" in a_data
    assert a_data["average_platform"] >= 4.0


