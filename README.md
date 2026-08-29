# DevFestVerse - GDG Cloud Bangkok Interactive 2D Platform

> *Made by Antigravity CLI, Antigravity 2.0 with Gemini 3.7 Flash (Medium)*

**DevFestVerse** is an interactive, gamified 2D pixel-art virtual event platform built for **GDG Cloud Bangkok** DevFest. Deployed on **Google Cloud Platform (Cloud Run)**, participants explore a top-down virtual space with custom 2D SVG pixel agent avatars, interact with community billboards and sponsor booths, attend sessions, register for workshops, and view live Gemini transcriptions by speaker.

---

## Key Features

- **Google Sign-In & Onboarding Flow**: Seamless authentication with Google OAuth profile integration, instant demo account switcher, and profile card HUD chip.
- **2D Character Customizer Studio**:
  - Live animated preview with real-time idle bobbing and step animations.
  - Granular customization for skin tones, hair styles & colors, outfit types & colorways.
  - Headwear accessories: DevFest Caps, VR Visors, Google Glasses, DJ Headphones, Cat Ears, and Space Helmets.
  - Special aura & companions: Orbiting Google Cloud Pets, AI Energy Sparkles, and Matrix Green Glow.
- **Gemini AI Character Synthesizer**: Generate full 2D pixel avatars directly from natural language prompts (e.g., *"Google Cloud Architect with glowing VR visor and cyan pet"*).
- **Mobile & Touch Navigation Engine**:
  - **On-Screen Virtual Touch D-Pad**: Directional touch controls (⬆️ ⬇️ ⬅️ ➡️) for one-thumb walking on mobile devices.
  - **Tap-to-Move Pathfinding**: Tap or click anywhere on the 2D canvas to smoothly move the character with animated target rings.
  - **Floating Action Touch Button**: Contextual touch button that glows and pulses when approaching interactive booths, stages, and billboards.
  - **Mobile Bottom Navigation Bar**: Fixed bottom navigation bar (`World`, `Agenda`, `Labs`, `Studio`, `More`) on screens < 768px.
  - **Responsive Layout**: Fluid canvas scaling, stacked mobile customizer studio, and touch-optimized modal dialogs.
- **Multi-Directional Sprite Rendering Engine**: 4-way directional walking animations (Down, Up, Left, Right), animated limb step cycles, shadows, and floating role tags.
- **2D Tech Campus World & Proximity HUD**: Interactive Google-themed campus with circuit pathways, pulsating holographic pads, proximity interaction tooltips (`Press [E] or Click to Open`), and mini-map radar.
- **Main Event Ticket Verification Billboard**: Central 2D spawn billboard where participants verify their official DevFest tickets to earn an in-game "Verified Ticket Badge" and unlock Lucky Draw entry.
- **GDG Cloud Bangkok Community Billboards**: Interactive billboards for Facebook Page, Facebook Group, Discord, Instagram, and YouTube.
- **Clickable Billboard UX**: Clicking a billboard opens an embedded `iframe` view modal first, featuring an explicit **"Open in New Tab"** header button.
- **Interactive Sponsor Booths**: Embedded sponsor website `iframe` popups and promo banners.
- **Multi-Track Agenda & Schedule System**:
  - Filter sessions by track (`Main Keynote`, `Track 1: AI & Agents`, `Track 2: Cloud & DevOps`, `Track 3: Web & Frontend`, etc.).
  - Real-time search across session titles, speaker names, descriptions, and tracks.
- **My Agenda & Favorites**:
  - One-click favorite button (❤️ / 🤍) on any session card.
  - Dedicated **"⭐ My Agenda"** tab aggregating all favorited talks across all conference tracks into a personalized schedule.
- **Back Office Agenda & Track Management**:
  - Organizers and staff can dynamically create, edit session times/rooms/speakers, and delete sessions via the Back Office console with real-time sync.
- **Session-Linked Gemini Transcriptions**: Speech-to-text transcriptions streamed via Gemini, displayed as live stage HUD captions, and indexed by Session ID & Speaker ID.
- **5 User Roles & Role Invitation Links**:
  - **Organizer**: Full administrative access, role switcher, SVG asset studio, lucky draw runner, agenda & track manager.
  - **Staff**: Staff console, internal team communication channel, Q&A/photo moderation, workshop check-in scanner.
  - **Speaker**: Speaker dashboard, session materials, and talk transcripts.
  - **Sponsor**: Sponsor portal, booth profile editor, iframe URL manager, visitor analytics.
  - **Participant**: 2D world exploration, avatar generator, multi-track agenda & favorites, shop iframe, public Q&A, feedback.
- **Role Invitation Links**: Organizers generate invite links (`/invite/speaker`, `/invite/sponsor`, `/invite/staff`) for elevated roles.
- **Workshop Room Registration & Cancellation**: Real-time seat capacity reservation engine with digital passes, live seat status, and cancellation / unregister support.
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

---

*Made by Antigravity CLI, Antigravity 2.0 with Gemini 3.7 Flash (Medium)*

