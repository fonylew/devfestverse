# DevFestVerse - GDG Cloud Bangkok Interactive 2D Platform

**DevFestVerse** is an interactive, gamified 2D pixel-art virtual event platform built for **GDG Cloud Bangkok** DevFest. Deployed on **Google Cloud Platform (Cloud Run)**, participants explore a top-down virtual space with custom 2D SVG pixel agent avatars, interact with community billboards and sponsor booths, attend sessions, register for workshops, and view live Gemini transcriptions by speaker.

---

## Key Features

- **2D Pixel Art World with Idle Bobbing Sprites**: Custom SVG character avatars bobbing up and down when stationary.
- **Main Event Ticket Verification Billboard**: Central 2D spawn billboard where participants verify their official DevFest tickets to earn an in-game "Verified Ticket Badge" and unlock Lucky Draw entry.
- **GDG Cloud Bangkok Community Billboards**: Interactive billboards for Facebook Page, Facebook Group, Discord, Instagram, and YouTube.
- **Clickable Billboard UX**: Clicking a billboard opens an embedded `iframe` view modal first, featuring an explicit **"Open in New Tab"** header button.
- **Interactive Sponsor Booths**: Embedded sponsor website `iframe` popups and promo banners.
- **Session-Linked Gemini Transcriptions**: Speech-to-text transcriptions streamed via Gemini, displayed as live stage HUD captions, and indexed by Session ID & Speaker ID.
- **5 User Roles & Role Invitation Links**:
  - **Organizer**: Full administrative access, role switcher, SVG asset studio, lucky draw runner.
  - **Staff**: Staff console, internal team communication channel, Q&A/photo moderation, workshop check-in scanner.
  - **Speaker**: Speaker dashboard, session materials, and talk transcripts.
  - **Sponsor**: Sponsor portal, booth profile editor, iframe URL manager, visitor analytics.
  - **Participant**: 2D world exploration, avatar generator, agenda, shop iframe, public Q&A, feedback.
- **Role Invitation Links**: Organizers generate invite links (`/invite/speaker`, `/invite/sponsor`, `/invite/staff`) for elevated roles.
- **Workshop Room Registration**: Real-time seat capacity reservation engine with digital passes.
- **Background Music (BGM)**: Zone-based audio player supporting YouTube URL embeds and GCS audio tracks.
- **Comprehensive Back Office APIs**: REST & WebSocket API suite for organizers and staff.

---

## Tech Stack & Tooling

- **Backend**: Python 3.13+ with **FastAPI**, managed via **`uv`**.
- **Frontend**: Single Page PWA application using HTML5 Canvas & SVG renderer, Service Worker (`sw.js`), and Web Push notifications.
- **Database & State**: Cloud SQL PostgreSQL, Cloud Firestore, and Cloud MemoryStore Redis.
- **AI Services**: Google Vertex AI & Gemini Live API.
- **Testing**: `pytest` executed with `uv run pytest`.

---

## How to Run & Develop Locally

### Prerequisites
- Python 3.11+ installed.
- `uv` installed (`pip install uv` or `brew install uv`).

### 1. Install Dependencies
```bash
uv sync
```

### 2. Run Backend FastAPI Server
```bash
uv run uvicorn backend.app.main:app --reload --port 8000
```
API Documentation available at `http://localhost:8000/docs`.

### 3. Run Automated Tests (`pytest`)
```bash
uv run pytest backend/tests/
```

### 4. Serve Frontend PWA Platform
```bash
uv run python -m http.server 3000 --directory frontend
```
Open `http://localhost:3000` in your browser.

---

## Architecture Reference

For detailed system design, ER diagrams, and Mermaid charts, see [architecture.md](architecture.md).
