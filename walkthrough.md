# DevFestVerse Implementation Walkthrough

We have fully implemented the **DevFestVerse** interactive 2D virtual event platform for **GDG Cloud Bangkok**.

---

## What Was Built

### 1. 2D Interactive Engine & Pixel Agent Avatar
- **Idle Bobbing Animation**: 2D SVG pixel agent sprites continually bob up and down when stationary.
- **Map Hotspots**:
  - **Main Event Ticket Verification Billboard**: Central spawn billboard verifying official DevFest tickets and awarding the "Verified Ticket Badge".
  - **GDG Cloud Bangkok Community Billboards**: Interactive billboards for Facebook Page, Facebook Group, Discord, Instagram, and YouTube Channel.
  - **Clickable Billboard UX**: Clicking a billboard opens an embedded `iframe` view modal first, featuring an explicit **"Open in New Tab"** button.
  - **Sponsor Booths**: Interactive sponsor banners with embedded website `iframe` popups.
  - **Workshop Zone**: Interactive entrance for workshop seat reservations.

### 2. Session-Linked Gemini Transcriptions by Speaker
- Speech-to-text transcriptions streamed via Gemini, rendered as live stage HUD captions, and indexed by **Session ID** and **Speaker ID** for post-session reading.

### 3. Role Onboarding & 5 User Roles
- **Simple Participant Register Link**: Participants join via `/register` or 1-click Google Sign-In.
- **Role Invitation Links**: Organizers generate invite links (`/invite/speaker`, `/invite/sponsor`, `/invite/staff`) in the Back Office for elevated roles.
- **5 User Roles**: Organizers, Staff, Speakers, Sponsors, Participants.

### 4. PWA Installation & Service Worker
- Progressive Web App support with `manifest.json`, Service Worker caching (`sw.js`), and Web Push notification listener.

### 5. Comprehensive Back Office APIs
- REST & WebSocket APIs for Organizers & Staff to manage active users, role switching, announcements, lucky draw raffles, BGM playlists, workshop seats, and multi-event archives.

---

## Verification Results

### Automated Tests (`pytest`)
Ran backend test suite using `uv run pytest`:
```bash
======================== 16 passed, 2 warnings in 0.25s ========================
```
- `test_auth_invites.py`: Passed (Quick register, Google OAuth, Role invite links)
- `test_tickets.py`: Passed (Official ticket verification & Verified Badge)
- `test_billboards_sponsors.py`: Passed (Community billboards & sponsor booth CRUD)
- `test_sessions_transcribe.py`: Passed (Session agenda & Gemini speaker transcriptions)
- `test_workshops.py`: Passed (Workshop seat reservations)
- `test_backoffice_apis.py`: Passed (Role switching & lucky draw raffle)

---

## How to Launch the Application

1. **Start Backend FastAPI Microservice**:
   ```bash
   uv run uvicorn backend.app.main:app --reload --port 8000
   ```
2. **Serve Frontend PWA Platform**:
   ```bash
   uv run python -m http.server 3000 --directory frontend
   ```
3. **Open Platform**: Navigate to `http://localhost:3000` in your web browser.
