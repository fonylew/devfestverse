import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_root_serves_html():
    response = client.get("/")
    assert response.status_code == 200
    assert "DevFestVerse" in response.text

def test_favicon_ico_and_png_exist():
    ico_resp = client.get("/favicon.ico")
    assert ico_resp.status_code == 200
    assert len(ico_resp.content) > 0

    png_resp = client.get("/favicon.png")
    assert png_resp.status_code == 200
    assert len(png_resp.content) > 0

def test_src_static_assets_serve():
    app_js_resp = client.get("/src/app.js")
    assert app_js_resp.status_code == 200
    assert "API_BASE" in app_js_resp.text

def test_health_check_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"
    from backend.app.core.config import settings
    assert resp.json()["project"] == (settings.GCP_PROJECT or "local-dev")

def test_privacy_policy_page_serves():
    resp = client.get("/privacy")
    assert resp.status_code == 200
    assert "Privacy Policy" in resp.text
    assert "https://policies.google.com/privacy" in resp.text

    resp_alias = client.get("/privacy-policy")
    assert resp_alias.status_code == 200
    assert "Privacy Policy" in resp_alias.text

def test_terms_of_service_page_serves():
    resp = client.get("/terms")
    assert resp.status_code == 200
    assert "Terms of Service" in resp.text
    assert "https://policies.google.com/terms" in resp.text

    resp_alias = client.get("/terms-of-service")
    assert resp_alias.status_code == 200
    assert "Terms of Service" in resp_alias.text
