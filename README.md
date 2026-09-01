# DevFestVerse - GDG Cloud Bangkok Interactive 2D Platform

> *Made by Antigravity CLI, Antigravity 2.0 with Gemini 3.7 Flash (Medium)*

**DevFestVerse** is an interactive, gamified 2D pixel-art virtual event platform built for **GDG Cloud Bangkok** DevFest. Deployed on **Google Cloud Platform (Cloud Run)**, participants explore a top-down virtual space with custom 2D SVG pixel agent avatars, interact with community billboards and sponsor booths, attend sessions, register for workshops, and view live Gemini transcriptions by speaker.

---

## Key Features

- **Browser Local AI (Gemini Nano / window.ai) Character Generator**:
  - **On-Device Local AI Synthesis**: Uses browser local AI (`window.ai?.languageModel` / Gemini Nano in Chrome) and client-side semantic rule pipelines to generate compatible pixel avatar configurations directly on the attendee's device without server round-trips.
  - **Instant Live Preview**: Updates the Character Studio canvas in real time with prompt suggestions (e.g. *Cyberpunk Hacker*, *Cat Ears Anime Dev*, *Google Glass Cloud Architect*, *Lofi Beats Streamer*).
- **Gemini 2.0 Unstructured Data Parsing (Sessions & Sponsors)**:
  - **Session Proposal Parser (`/sessions/parse-gemini`)**: Organizers can paste messy CFP abstracts, speaker bios, or emails. Gemini extracts clean session titles, speakers, tracks, rooms, time slots, levels, and key takeaways.
  - **Sponsor Prospectus Parser (`/sponsors/parse-gemini`)**: Organizers can paste sponsor agreements, pitch text, or website links. Gemini extracts sponsor names, tier rankings, interactive iframe URLs, theme colors, swag perks, and descriptions.
  - **Back Office Integration**: Includes dedicated AI auto-fill prompt bars in Back Office Agenda Management and Sponsor Booth Management.
- **Multi-Event Multi-Role Support & Isolated RBAC**:
  - A single user account can participate in multiple concurrent events (e.g. `devfest-bangkok-2026`, `gdg-ai-hackathon-2026`, `cloud-community-day-2026`) with independent roles (`ORGANIZER`, `STAFF`, `SPEAKER`, `SPONSOR`, `PARTICIPANT`) and event-specific ticket verification.
  - Context-aware RBAC header (`x-event-id`) resolves effective roles dynamically for every API request.
  - Back Office Console allows organizers to switch event contexts seamlessly, filter attendees by event, and update event-specific roles.
- **Client-Side Firestore Caching Engine (5-Minute TTL)**:
  - Dual-tier client-side cache (`sessionStorage` + in-memory map) intercepts API calls to prevent redundant reads and writes to Cloud Firestore.
  - Automatic cache invalidation triggers whenever any mutating action occurs (role promotion, ticket linkage, new session creation).
  - Organizers have a "🔄 Force Refresh Firestore" button to bypass cache on demand.
- **User Management Module & Back Office Console (Cloud Firestore)**:
  - **Direct Firestore Integration**: Persistent `users` collection storing user profiles, avatar configurations, assigned multi-event roles, ticket linkages, and Google OAuth credentials.
  - **Live User Directory & Statistics**: Real-time KPI cards displaying total attendees, role breakdown, verified ticket counts, and Google-authenticated user ratios per event.
  - **Administrative Controls**: Organizers can search, filter by role, instantly update/escalate user roles, manually link/verify tickets, and manage attendee accounts.
  - **Automatic In-Memory & Cloud Fallback**: Zero configuration needed for local development and CI test suites, seamlessly switching to live Cloud Firestore when deployed on Google Cloud.
- **Google Auth & Avatar Firestore Persistence & Re-Login Restore**:
  - Integrated **Google Identity Services (GIS)** client and server token validation pipeline.
  - **Firestore Avatar Synchronization**: Every pixel avatar customization (skin tone, hair style & color, outfit, headwear like cat ears/VR headsets, auras) is directly saved into the Firestore `users/{user_id}` collection and the active event's `participants` map.
  - **Seamless Re-Login Restore**: When returning attendees sign back in via Google or reload the browser, their personalized character appearance is automatically retrieved from Firestore and restored to the live 2D canvas and studio preview.
- **Official GDG Cloud Bangkok Community Channels & Billboards**:
  - **🌐 GDG Chapter Portal**: [https://gdg.community.dev/gdg-cloud-bangkok/](https://gdg.community.dev/gdg-cloud-bangkok/) (Official RSVPs, event tickets, and chapter registration)
  - **📘 Facebook Official Page**: [https://www.facebook.com/profile.php?id=61583002384772](https://www.facebook.com/profile.php?id=61583002384772) (Official announcements & news)
  - **👥 Facebook Developer Group**: [https://www.facebook.com/groups/gdgcloudbkk/](https://www.facebook.com/groups/gdgcloudbkk/) (Discussions, Q&A & community networking)
  - **📷 Instagram**: [https://www.instagram.com/gdgcloudbkk](https://www.instagram.com/gdgcloudbkk) (@gdgcloudbkk event stories & highlights)
  - **▶️ YouTube Channel**: [https://www.youtube.com/@gdgcloudbangkok](https://www.youtube.com/@gdgcloudbangkok) (Recorded talks & livestreams)
  - **💬 Discord Server**: [https://discord.gg/CBbPpNvmS](https://discord.gg/CBbPpNvmS) (Real-time live chat & agent hacking channels)
- **🛍️ Official GDG Swag & Merch Shop (LINE Shopping Integration)**:
  - Dedicated **"🛍️ GDG SWAG SHOP"** interactive booth on the 2D venue floor and direct modal navigation.
  - Showcases official merchandise: GDG Cyberpunk Limited Edition Hoodies, DevFest 2026 Developer Tees, Enamel Lapel Pins, Holographic Sticker Packs, and Thermal Stainless Tumblers.
  - Direct checkout & ordering via **LINE Shopping** channel: [https://shop.line.me/@837etxse](https://shop.line.me/@837etxse).
- **🎨 Customizable Booth Design Studio & AI Generator (Back Office Tab 7)**:
  - Interactive generator allowing organizers and sponsors to design custom booths (Swag Stores, Title Sponsor Pavilions, AI Sandboxes, Community Arcades).
  - Configurable themes (Cyberpunk Neon, Google Cloud 4-Color, Sunset Glass, Emerald Matrix), custom accent colors, target URLs, and descriptions.
  - **Live 2D Pixel Booth Preview Canvas**: Real-time canvas rendering showing exactly how the customized booth sprite will appear on the virtual campus.
  - **✨ AI Auto-Design with Gemini**: Natural language prompt bar that automatically configures booth parameters from sponsor pitch decks or descriptions.
  - **Instant Live Deployment**: Deploys updated booth branding to the live 2D canvas and syncs with backend REST APIs (`/api/v1/sponsors` & `/api/v1/sponsors/generate-booth`).
- **DevFest Builder Showcase & Live Iframe Demo Hub**:
  - Dedicated centerpiece **"🛠️ BUILDER ZONE"** pavilion with glowing cybernetic grid, neon laser corner brackets, and interactive kiosks.
  - Interactive project cards showcasing community web apps, AI tools, and games built by DevFest developers.
  - **Built-in Interactive Iframe Viewport**: Launch and test live web applications inside an embedded, sandboxed in-app runner with fullscreen and "Open in New Tab" controls.
  - **Community Claps & Upvotes**: Attendees can upvote (👏) their favorite developer projects in real time.
  - **Project Submission Portal**: Direct form modal allowing developers to submit title, builder team, category, live demo URL, GitHub repository, and tech stack tags with Cloud Firestore persistence.
- **Real-World Multiplayer Architecture (200+ Active Players)**:
  - High-throughput **WebSocket Presence Cluster** (`/api/v1/ws/presence`) running on Cloud Run.
  - **Spatial Partitioning (Area of Interest - AoI)**: $320\text{px}$ grid quadrant sharding ensures player delta broadcasts scale linearly $O(N)$ instead of quadratic $O(N^2)$.
  - **15 Hz Delta Throttling & Client Lerp**: Smooth 60 FPS visual movements via client-side linear interpolation and dead reckoning with minimal network overhead.
  - **Multi-Instance Sync**: Scalable horizontally across Cloud Run container instances via **Google Cloud MemoryStore (Redis Pub/Sub)**.
- **Canvas Stability & Error Boundary Guarantee**:
  - `gameLoop()` guarded with defensive try/catch error boundaries to prevent transient exceptions from ever freezing the animation loop.
  - Minimum dimensional clamping ($960\times 540\text{ px}$) to prevent null/zero dimension collapses.
  - Automated headless Node.js + VM test (`frontend/tests/test_canvas_stability.js` & `backend/tests/test_frontend_canvas_integrity.py`) validating 120+ continuous frames across 4 viewport resolutions.
- **Fullscreen Responsive 2D Virtual Canvas**:
  - Automatically resizes and scales dynamically to fill 100% of the screen across desktop widescreen monitors, tablets, and smartphones.
  - Spatially balances booths, keynote stages, and lounges to comfortably support high-density attendee roaming.
- **AI Agenda Auto-Fill & Generator (Back Office)**:
  - Organizers and staff can describe talks or paste abstracts in natural language.
  - Gemini AI extracts and auto-fills title, speaker, track, room, start/end times, and description with glowing animations.
- **Redesigned Modern Feedback Form & Per-Event Firestore Persistence**:
  - **Premium Cyberpunk GDG Aesthetic**: Replaced clunky native buttons/dropdowns with large glowing gold stars (`⭐`), dynamic rating feedback labels (e.g. *5/5 • Outstanding Experience! 🌟*), segmented category rating chips (`5★ Excellent` to `1★ Poor`), and a color-coded 0–10 NPS segmented pill picker with live Detractor / Passive / Promoter status badge.
  - **Per-Event Feedback Scoping (`events/{event_id}/feedbacks`)**: Automatically scopes feedback submissions to the selected event context (e.g. `devfest-bangkok-2026`, `gdg-ai-hackathon-2026`) and persists into Google Cloud Firestore.
  - **Per-Event Stage Q&A Engine (`events/{event_id}/qna`)**: Stage questions and attendee upvotes are saved and tracked per event in Cloud Firestore with real-time upvote toggling.
  - **Back Office Analytics**: Dedicated **📝 Feedback Analytics** tab in Back Office displaying average ratings, NPS, and real-time review feeds filtered by event context.
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

## Environment Configuration (`.env`)

DevFestVerse uses `pydantic-settings` to manage configuration safely through environment variables or a local `.env` file. Credentials and secrets are never committed into git.

### 1. Create your local `.env` file
Copy the template from `.env.example`:
```bash
cp .env.example .env
```

### 2. Available Environment Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `GCP_PROJECT` | Google Cloud Platform Project ID | `gdg-cloud-bangkok-2026` |
| `PORT` | Web server listening port | `8000` (Local) / `8080` (Cloud Run default) |
| `ENVIRONMENT` | Runtime environment mode | `development` / `production` |
| `SECRET_KEY` | Secret key for JWT & session encryption | Secure 32+ char random string |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Web Client ID for Google Login | `123456789-xyz.apps.googleusercontent.com` |
| `FIRESTORE_USERS_COLLECTION` | Firestore collection for attendee accounts | `users` |
| `FIRESTORE_EVENTS_COLLECTION` | Firestore collection for events & agenda | `events` |
| `DEFAULT_TICKET_REGISTRATION_URL` | Default link for ticket registration | `https://gdg.community.dev/` |


---

## How to Run & Develop Locally

### Prerequisites
- Python 3.13+ installed.
- `uv` installed (`pip install uv` or `brew install uv`).

### 1. Install Dependencies
```bash
uv sync
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env to add your GOOGLE_CLIENT_ID or other settings
```

### 3. Run Backend FastAPI Server
```bash
uv run uvicorn backend.app.main:app --reload --port 8000
```
- Web Application: `http://localhost:8000/`
- Interactive API Documentation (Swagger): `http://localhost:8000/docs`

### 4. Run Automated Tests (`pytest`)
```bash
uv run pytest
```

---

## Deploying to Google Cloud Run

### Option A: Using the Interactive Deployment Script (`deploy.sh`)
Run the deployment script. If `GCP_PROJECT` is not already exported in your shell, the script will interactively ask you to enter your GCP Project ID:
```bash
./deploy.sh
```

Or provide your project ID directly via environment variable:
```bash
GCP_PROJECT=<YOUR_GCP_PROJECT_ID> ./deploy.sh
```

### Option B: Deploying via `gcloud` CLI
```bash
# 1. Build and push container image
gcloud builds submit --tag gcr.io/<YOUR_GCP_PROJECT_ID>/devfestverse:latest .

# 2. Deploy to Cloud Run (with scale-to-zero and max 1 instance cap)
gcloud run deploy devfestverse \
    --project <YOUR_GCP_PROJECT_ID> \
    --image gcr.io/<YOUR_GCP_PROJECT_ID>/devfestverse:latest \
    --platform managed \
    --region asia-southeast3 \
    --min-instances 0 \
    --max-instances 1 \
    --memory 512Mi \
    --cpu 1 \
    --concurrency 80 \
    --timeout 300 \
    --allow-unauthenticated \
    --set-env-vars "GCP_PROJECT=<YOUR_GCP_PROJECT_ID>,PROJECT_NAME=DevFestVerse"
```

---

## Google Cloud Run Configuration & Security Guide

### 1. Where to Set Environment Variables in Cloud Run

#### Method 1: Google Cloud Console (Web UI)
1. Open the [Google Cloud Console - Cloud Run](https://console.cloud.google.com/run).
2. Click on your service: **`devfestverse`**.
3. Click **"Edit & Deploy New Revision"** at the top of the page.
4. Scroll down and open the **"Variables & Secrets"** tab (under Container configuration).
5. Click **"+ Add Variable"** and add your desired key-value pairs:
   - `GCP_PROJECT` = `gdg-cloud-bangkok-2026`
   - `GOOGLE_CLIENT_ID` = `<YOUR_OAUTH_CLIENT_ID>.apps.googleusercontent.com`
   - `SECRET_KEY` = `<YOUR_SECRET_KEY>`
6. (Optional) For sensitive tokens like `SECRET_KEY`, click **"+ Reference a Secret"** to bind a secret from **Google Secret Manager**.
7. Click **"Deploy"** at the bottom to apply the changes to a new revision.

#### Method 2: `gcloud` CLI
To update environment variables on an existing Cloud Run service without re-building:
```bash
gcloud run services update devfestverse \
    --region asia-southeast3 \
    --project gdg-cloud-bangkok-2026 \
    --update-env-vars "GCP_PROJECT=gdg-cloud-bangkok-2026,GOOGLE_CLIENT_ID=<YOUR_CLIENT_ID>"
```

#### Method 3: Using Google Secret Manager (Recommended for Production Secrets)
1. Create a secret in Secret Manager:
   ```bash
   echo -n "my-super-strong-production-secret" | gcloud secrets create devfest-secret-key \
       --project <YOUR_GCP_PROJECT_ID> \
       --replication-policy automatic \
       --data-file=-
   ```
2. Grant Cloud Run Service Account permission to read the secret:
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe <YOUR_GCP_PROJECT_ID> --format='value(projectNumber)')
   gcloud secrets add-iam-policy-binding devfest-secret-key \
       --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
       --role="roles/secretmanager.secretAccessor"
   ```
3. Attach the secret to Cloud Run:
   ```bash
   gcloud run services update devfestverse \
       --region asia-southeast3 \
       --project <YOUR_GCP_PROJECT_ID> \
       --set-secrets "SECRET_KEY=devfest-secret-key:latest"
   ```

---

### 2. Setting up Google Sign-in / Firebase Authentication

1. **Google Cloud Console OAuth 2.0 Credentials**:
   - Navigate to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials).
   - Click **"+ Create Credentials"** > **OAuth client ID**.
   - Application Type: **Web application**.
   - **Authorized JavaScript origins**:
     - Local dev: `http://localhost:8000`, `http://localhost:3000`
     - Production: `https://<YOUR_CLOUD_RUN_SERVICE_URL>` (e.g. `https://devfestverse-xxxxx-as.a.run.app`)
   - Copy the generated **Client ID** and set it to `GOOGLE_CLIENT_ID` in your `.env` and Cloud Run configuration.

2. **Google Cloud Console OAuth Consent Screen Branding**:
   - Navigate to [APIs & Services > OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).
   - **App name**: `DevFestVerse - GDG Cloud Bangkok`
   - **User support email**: `organizer@gdgcloudbkk.org`
   - **Application home page**: `https://<YOUR_CLOUD_RUN_SERVICE_URL>/`
   - **Application privacy policy link**: `https://<YOUR_CLOUD_RUN_SERVICE_URL>/privacy`
   - **Application terms of service link**: `https://<YOUR_CLOUD_RUN_SERVICE_URL>/terms`
   - **Authorized domains**: Add your Cloud Run domain (`*.run.app`) or custom domain (`gdgcloudbkk.org`).

3. **Firebase Console (Optional Direct Web SDK integration)**:
   - Go to [Firebase Console](https://console.firebase.google.com/) and select your GCP Project.
   - Under **Build > Authentication**, enable **Google** sign-in provider.
   - Under **Project Settings > General**, register a Web App and copy the config values (`apiKey`, `authDomain`, `projectId`, `appId`).

---

### 3. Hosted Chapter Legal & Compliance Pages

DevFestVerse hosts customized branded legal pages satisfying Google OAuth Platform verification requirements:

| Route | Description | Governing Third-Party Links |
| :--- | :--- | :--- |
| [`/privacy`](file:///Users/fony/ai-vibes/devfestverse/frontend/privacy.html) | Community Privacy Policy & data handling disclosure | [Google Privacy Policy](https://policies.google.com/privacy) |
| [`/terms`](file:///Users/fony/ai-vibes/devfestverse/frontend/terms.html) | Community Code of Conduct & Terms of Service | [Google Terms of Service](https://policies.google.com/terms) |

---

### 4. Required Google Cloud IAM Permissions

Ensure the Cloud Run Service Account (e.g. `<PROJECT_NUMBER>-compute@developer.gserviceaccount.com` or custom service account) has the following roles assigned:

```bash
# Cloud Firestore Read/Write Access
gcloud projects add-iam-policy-binding <YOUR_GCP_PROJECT_ID> \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/datastore.user"

# Vertex AI Access (for Gemini Live Transcription & Avatar generation)
gcloud projects add-iam-policy-binding <YOUR_GCP_PROJECT_ID> \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/aiplatform.user"
```

---

## Firestore Data Hierarchy

Data on Google Cloud Firestore is organized with the event slug as top-level document keys:

- **Collection**: `events`
  - **Document ID**: `devfest-bangkok-2026`
    - `date`, `venue`, `metadata`, `speakers`, `sessions`, `sponsors`, `workshops`
    - `participants`: Show-up and check-in tracking (`attended`, `checked_in_at`, `scanned_by`, `ticket_ref`)
    - `attendance_summary`: Real-time show-up rate statistics
- **Collection**: `users`
  - **Document ID**: `user-xxxx-xxxx`
    - `email`, `display_name`, `global_role`, `events`, `avatar_config`, `avatar_svg`, `auth_provider`, `google_sub`

---

## Architecture Reference

For detailed architectural specifications, ER diagrams, and sequence flows, see [architecture.md](architecture.md).

---

*Made by Antigravity CLI, Antigravity 2.0 with Gemini 3.7 Flash (Medium)*
