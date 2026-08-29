# DevFestVerse - GDG Cloud Bangkok Interactive 2D Platform

> *Made by Antigravity CLI, Antigravity 2.0 with Gemini 3.7 Flash (Medium)*

**DevFestVerse** is an interactive, gamified 2D pixel-art virtual event platform built for **GDG Cloud Bangkok** DevFest. Deployed on **Google Cloud Platform (Cloud Run)**, participants explore a top-down virtual space with custom 2D SVG pixel agent avatars, interact with community billboards and sponsor booths, attend sessions, register for workshops, and view live Gemini transcriptions by speaker.

---

## Key Features

- **Real Sign in with Google (GIS) & Avatar Cloud Persistence**:
  - Integrated **Google Identity Services (GIS)** OAuth flow.
  - Custom pixel avatars designed in the **Character Studio** are permanently saved to **Cloud Firestore** under the user's profile and synchronized across all sessions.
- **Fullscreen Responsive 2D Virtual Canvas**:
  - Automatically resizes and scales dynamically to fill 100% of the screen across desktop widescreen monitors, tablets, and smartphones.
  - Spatially balances booths, keynote stages, and lounges to comfortably support high-density attendee roaming.
- **AI Agenda Auto-Fill & Generator (Back Office)**:
  - Organizers and staff can describe talks or paste abstracts in natural language (e.g. *"Dr. Alice Chen on Scalable AI Agents with LangGraph on Cloud Run at 1:30 PM in Room B1"*).
  - Gemini AI extracts and auto-fills title, speaker, track, room, start/end times, and description with glowing animations.
- **Attendee Event Feedback & NPS Satisfaction System**:
  - Interactive **📝 EVENT FEEDBACK** kiosk in the 2D venue and accessible from the HUD header / mobile drawer.
  - ⭐ 1-5 Star ratings for overall experience, talk content, and venue.
  - **Net Promoter Score (NPS 0-10)** slider and qualitative feedback suggestions.
  - Dedicated **📝 Feedback Analytics** tab in Back Office displaying average ratings, NPS, and real-time review feeds.
- **Bouncy Character Walking & Idle Physics**: Dynamic step cycle that bobs and bounces the avatar up and down with each footstep and breathes playfully when idle.
- **Modern Monospace Tech Typography**: Styled with Google Fonts `'JetBrains Mono'`, `'Space Mono'`, and `'Fira Code'` across the entire HUD, billboards, modals, and canvas labels.
- **Brighter Tech Event Venue & Ambient Lighting**:
  - Bright modern slate-blue tech floor with alternating acoustic tiles and crisp grid lines.
  - Radiant ambient downlights and color glow pools under the Keynote Stage (Amber/Gold), Google Cloud Booth (Blue), Workshop Labs (Purple), and Ticket Plaza (Emerald).
  - Warm velvet lounge with coffee table, laptops, steaming coffee cups ☕, beanbags, and potted monsteras 🌿.
- **Multi-Directional Sprite Rendering Engine**: 4-way directional walking animations (Down, Up, Left, Right), animated limb step cycles, shadows, and floating role tags.
- **Seamless Hotkey Navigation & Modal Toggle**:
  - Press <kbd>E</kbd> or <kbd>Space</kbd> when approaching any billboard or booth to open the pop-up.
  - Press <kbd>E</kbd>, <kbd>Space</kbd>, or <kbd>Esc</kbd> again while a pop-up is active to instantly close it without needing to click the `×` button.
- **Main Event Ticket Verification Billboard**: Central 2D spawn billboard where participants verify their official DevFest tickets to earn an in-game "Verified Ticket Badge" and unlock Lucky Draw entry.
- **GDG Cloud Bangkok Community Billboards & Media Hub**:
  - Authorized YouTube embed player (`youtube-nocookie.com/embed/...`) with full video playback.
  - Branded Community Hub cards for Discord, Facebook, Instagram, and Google Cloud Expo.
- **Multi-Track Agenda & Schedule System**: Filter sessions by track (`Main Keynote`, `Track 1: AI & Agents`, `Track 2: Cloud & DevOps`, `Track 3: Web & Frontend`) and search talks.
- **My Agenda & Favorites**: Dedicated **"⭐ My Agenda"** tab aggregating all favorited talks into a personalized schedule.
- **Workshop Room Registration & Cancellation**: Real-time seat capacity reservation engine with digital passes, live seat status, and cancellation support.
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

## Firestore Data Hierarchy & Live Attendance Tracking

Data on Google Cloud Firestore is structured with the **event name / slug as the top-level document key** under the `events` collection:

- **Collection**: `events`
- **Document ID**: Event Name / Slug (e.g. `events/devfest-bangkok-2026`)
  - `date`: Event date (e.g., `2026-11-28`)
  - `venue`: Venue details (`name`, `address`, `rooms: [...]`)
  - `metadata`: `{ theme, year, organizer, expected_capacity, registration_url }`
  - `speakers`: Array of speaker profiles, titles, and bios
  - `sessions`: Multi-track session agenda items
  - `sponsors`: Sponsor tiers, booth URLs, and promo configs
  - `workshops`: Workshop labs, seat capacities, and reserved counts
  - `participants`: Map of registered attendees tracking show-up status on the date:
    - `attended: true / false`
    - `checked_in_at: ISO timestamp`
    - `scanned_by: staff_id`
    - `ticket_ref: TICKET-DEV-001`
  - `attendance_summary`: Real-time show-up rate statistics (`total_registered`, `total_attended`, `show_up_rate_percent`, `absent_count`).

---

## Deploying to Google Cloud Run

To deploy DevFestVerse to **Google Cloud Run** under project **`gdg-cloud-bangkok-2026`** with scale-down to 0 and max 1 instance cap:

### Run Deployment Script
```bash
./deploy.sh
```

Or deploy directly via `gcloud`:
```bash
gcloud run deploy devfestverse \
    --project gdg-cloud-bangkok-2026 \
    --image gcr.io/gdg-cloud-bangkok-2026/devfestverse:latest \
    --platform managed \
    --region asia-southeast3 \
    --min-instances 0 \
    --max-instances 1 \
    --memory 512Mi \
    --cpu 1 \
    --allow-unauthenticated
```

---

## Architecture Reference

For detailed system design, ER diagrams, and Mermaid charts, see [architecture.md](architecture.md).

---

*Made by Antigravity CLI, Antigravity 2.0 with Gemini 3.7 Flash (Medium)*

