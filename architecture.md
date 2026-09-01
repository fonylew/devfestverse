# Architecture & Technical Design Document - DevFestVerse

## Overview
**DevFestVerse** is an interactive 2D pixel-art virtual event platform built for **GDG Cloud Bangkok**. Deployed on **Google Cloud Platform (Cloud Run microservices)**, it provides an immersive retro game experience featuring custom SVG agent avatars with idle bobbing animations, GDG Cloud Bangkok community billboards (social links with embedded iframe modals & new tab buttons), sponsor booths, session-linked Gemini transcriptions by speaker, workshop room seat reservations, background music (YouTube/GCS audio), and role-based access control.

---

## High-Level System Architecture Diagram

```mermaid
graph TD
    subgraph ClientLayer ["Client Layer (Installable PWA & Responsive Mobile)"]
        Canvas2D["2D Canvas Engine (Multi-Direction Sprites, Hotspots & Mini-Map Radar)"]
        TouchControls["Mobile Touch Engine (Virtual D-Pad, Tap-to-Move & Action Button)"]
        BottomNav["Mobile Bottom Tab Navigation (World, Agenda, Labs, Studio, More)"]
        SW["Service Worker (PWA Caching & Web Push Listener)"]
        UI_Modals["Responsive Modals (Multi-Track Agenda, Workshops, Character Studio, Backoffice)"]
    end

    subgraph AuthLayer ["Authentication & Role Onboarding"]
        GoogleAuth["Google Sign-In (OAuth2 / Identity Platform)"]
        ParticReg["Simple Participant Register Link (/register)"]
        InviteLinks["Role Invite Link System (/invite/speaker, /sponsor, /staff)"]
    end

    subgraph GCPCloudRun ["Google Cloud Platform - Cloud Run Microservices"]
        AuthRBAC["Auth & RBAC Middleware (5 Roles: Organizer, Staff, Speaker, Sponsor, Participant)"]
        TicketSvc["Main Event Ticket Verification Service"]
        BillboardSvc["Community Billboard & Sponsor Service"]
        WorkshopSvc["Workshop Seat Reservation & Cancellation Engine"]
        SessionSvc["Agenda & Session Service"]
        TranscribeSvc["Session-Linked Gemini Transcribe Pipeline"]
        AnnounceSvc["Public & Staff Announcement Channels"]
        BackofficeAPIs["Comprehensive Back Office APIs"]
    end

    subgraph AIIntegrations ["Google Vertex AI & Gemini"]
        GeminiTranscribe["Gemini Live Transcribe API"]
        GeminiAvatar["Gemini Photo-to-SVG Avatar Engine"]
    end

    subgraph DataStorage ["Data & Storage Layer (Cloud Firestore & Storage)"]
        FirestoreUsers[("Cloud Firestore: 'users' (Profiles, Google Auth metadata, Roles, Tickets, Avatars)")]
        FirestoreEvents[("Cloud Firestore: 'events' (Event configs, Agenda, Attendance, Feedbacks)")]
        Redis[("Cloud MemoryStore (WebSockets, Active User Presence, Seat Holds)")]
        GCS[("Cloud Storage (SVG Assets, Avatars, Audio Tracks)")]
    end

    Canvas2D --> SW
    UI_Modals --> AuthLayer
    AuthLayer --> AuthRBAC

    AuthRBAC --> TicketSvc
    AuthRBAC --> BillboardSvc
    AuthRBAC --> WorkshopSvc
    AuthRBAC --> SessionSvc
    AuthRBAC --> TranscribeSvc
    AuthRBAC --> AnnounceSvc
    AuthRBAC --> BackofficeAPIs

    TranscribeSvc --> GeminiTranscribe
    AuthRBAC --> FirestoreUsers
    BackofficeAPIs --> FirestoreUsers
    BackofficeAPIs --> FirestoreEvents
    TicketSvc --> FirestoreUsers
    SessionSvc --> FirestoreEvents
    WorkshopSvc --> Redis
    WorkshopSvc --> FirestoreEvents
    BillboardSvc --> GCS
    AnnounceSvc --> Redis
```

---

## Google Auth & Cloud Firestore User Management Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as Attendee / Google User
    actor Admin as Event Organizer / Staff
    participant Web as DevFestVerse Web Client
    participant GIS as Google Identity Services (OAuth2 Client)
    participant AuthAPI as Auth API (/api/v1/auth)
    participant BackofficeAPI as Backoffice API (/api/v1/backoffice/users)
    participant Firestore as Cloud Firestore ('users' collection)

    rect rgb(24, 32, 54)
    note over User,Firestore: 1. Google Authentication & Auto-Registration Flow
    User->>Web: Click "Continue with Google"
    Web->>GIS: Trigger Google One-Tap / OAuth prompt
    GIS-->>Web: Google ID Token (Credential JWT)
    Web->>AuthAPI: POST /auth/google-login { google_token, email, display_name, avatar_url }
    AuthAPI->>GIS: Verify Google ID Token against audience & public keys
    AuthAPI->>Firestore: Check 'users' collection by email
    alt Existing User
        Firestore-->>AuthAPI: Existing User Record
        AuthAPI->>Firestore: Update avatar_url & google_sub metadata
    else New Attendee
        AuthAPI->>Firestore: Create user doc { id, email, display_name, role: 'PARTICIPANT', auth_provider: 'google' }
    end
    Firestore-->>AuthAPI: Persisted User Document
    AuthAPI-->>Web: 200 OK (User Profile + Avatar Config)
    Web->>User: Welcome Toast & Enter 2D DevFest Tech Campus
    end

    rect rgb(30, 41, 59)
    note over Admin,Firestore: 2. Backoffice User Directory & Role Administration Flow
    Admin->>Web: Open Back Office -> User Management Tab
    Web->>BackofficeAPI: GET /backoffice/users (with role/search query) & GET /backoffice/users/stats
    BackofficeAPI->>Firestore: Query 'users' collection stream
    Firestore-->>BackofficeAPI: List of users & aggregated statistics
    BackofficeAPI-->>Web: 200 OK (User list & KPI counts)
    Web->>Admin: Displays live user table, Google badges & ticket statuses
    Admin->>Web: Change User Role (e.g. PARTICIPANT -> SPEAKER) or Link Ticket
    Web->>BackofficeAPI: POST /backoffice/users/{id}/role or /ticket
    BackofficeAPI->>Firestore: Update user document in 'users' collection
    Firestore-->>BackofficeAPI: OK
    BackofficeAPI-->>Web: 200 OK (Updated User)
    Web->>Admin: Toast "User role updated to SPEAKER on Firestore!"
    end
```

---

## User Role Matrix (RBAC)

```mermaid
graph TD
    User["User Onboarding"] --> RoleCheck{"Assigned Role?"}
    
    RoleCheck -- Participant --> ParticPerms["Participant: 2D World, Avatar, Ticket Check, Q&A, Workshops, BGM"]
    RoleCheck -- Speaker --> SpeakerPerms["Speaker: Speaker Dashboard, Session Materials, Speaker Transcripts"]
    RoleCheck -- Sponsor --> SponsorPerms["Sponsor: Sponsor Booth Portal, Logo/Iframe Manager, Leads"]
    RoleCheck -- Staff --> StaffPerms["Staff: Staff Console, Internal Team Communication, Moderation, Workshop Check-in"]
    RoleCheck -- Organizer --> OrgPerms["Organizer: Full Back Office, Role Switcher, SVG Asset Studio, Lucky Draw, APIs"]
```

---

## Google Sign-In & Character Studio Onboarding Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Participant / Attendee
    participant Client as Web Client (PWA / Canvas)
    participant AuthAPI as Auth Service (/api/v1/auth)
    participant AvatarAPI as Avatar Service (/api/v1/avatar)
    participant Gemini as Google Vertex AI / Gemini

    User->>Client: Open DevFestVerse / Click Google Sign-In
    Client->>AuthAPI: POST /auth/google-login (OAuth token, email, name)
    AuthAPI-->>Client: 200 OK (User Profile + Default AvatarConfig)
    
    User->>Client: Open 2D Character Studio
    alt Prompt-Based Generation
        User->>Client: Enters Prompt: "Google Cloud Architect with VR visor"
        Client->>AvatarAPI: POST /avatar/ai-generate { prompt }
        AvatarAPI->>Gemini: Synthesize Character Attributes & Theme
        Gemini-->>AvatarAPI: Palette, Hair, Headwear, Aura, Outfit
        AvatarAPI-->>Client: Updated AvatarConfig + SVG Avatar
    else Interactive Customizer
        User->>Client: Selects Skin, Hairstyle, GDG Hoodie, Space Helmet, Pet
        Client->>Client: Real-Time Animated Preview Render
        User->>Client: Clicks "Save & Apply Look"
        Client->>AvatarAPI: POST /avatar/customize { AvatarConfig }
        AvatarAPI-->>Client: 200 OK (Persisted AvatarConfig + SVG)
    end
    Client->>Client: Renders 4-Way Multi-Directional Sprite on 2D Tech Campus Map
```

---

## Detailed Data Models & Entity Relationships

1. **User / Account (`users`)**:
   - `id`: UUID
   - `email`: String (Google OAuth)
   - `display_name`: String
   - `role`: Enum (`ORGANIZER`, `STAFF`, `SPEAKER`, `SPONSOR`, `PARTICIPANT`)
   - `verified_ticket`: Boolean (Status from Main Event Ticket Verification)
   - `ticket_ref`: String
   - `avatar_config`: JSON (`skin_tone`, `hair_style`, `hair_color`, `outfit_style`, `outfit_color`, `headwear`, `aura`, `theme`)
   - `avatar_svg`: Text (SVG avatar markup)
   - `created_at`: Timestamp

2. **Agenda Session (`sessions`)**:
   - `id`: UUID
   - `event_id`: UUID
   - `title`: String
   - `description`: Text
   - `speaker_id`: UUID (FK `users.id`)
   - `start_time`: Timestamp
   - `end_time`: Timestamp

3. **Session Transcript (`transcripts`)**:
   - `id`: UUID
   - `session_id`: UUID (FK `sessions.id`)
   - `speaker_id`: UUID (FK `users.id`)
   - `transcript_text`: Text
   - `original_language`: String (e.g. `th`, `en`)
   - `translated_text`: Text
   - `timestamp`: Timestamp

4. **Community Billboard & Sponsor (`billboards`)**:
   - `id`: UUID
   - `event_id`: UUID
   - `category`: Enum (`COMMUNITY_FACEBOOK_PAGE`, `COMMUNITY_FACEBOOK_GROUP`, `COMMUNITY_DISCORD`, `COMMUNITY_INSTAGRAM`, `COMMUNITY_YOUTUBE`, `SPONSOR`)
   - `title`: String
   - `logo_svg`: Text / URL
   - `iframe_url`: String
   - `description`: Text
   - `position_x`: Integer
   - `position_y`: Integer

5. **Workshop Room (`workshops`)**:
   - `id`: UUID
   - `event_id`: UUID
   - `title`: String
   - `speaker_name`: String
   - `capacity`: Integer
   - `reserved_count`: Integer
   - `room_code`: String

---

## Security & Authentication Flow
- **Google OAuth2 & Identity Integration**: User authenticates with Google Identity Services; backend synchronizes user account and avatar configuration.
- **Invitation Token Validation**: Organizers generate HMAC-signed token URLs (`/invite/speaker?token=...`, `/invite/sponsor?token=...`, `/invite/staff?token=...`). Redemption validates signature and updates user role in DB.

---

## Multi-Track Agenda & Personalized "My Agenda" Architecture

```mermaid
graph TD
    subgraph FrontendUI ["DevFest Agenda UI"]
        TrackSelector["Track Filters (🌐 All, Keynote, Track 1: AI, Track 2: Cloud, Track 3: Web)"]
        MyAgendaTab["⭐ My Agenda Tab (Cross-Track Aggregator)"]
        SearchFilter["Instant Real-Time Search (Title, Speaker, Track, Keyword)"]
        FavButton["❤️ Favorite Heart Button (Instant Toggle)"]
        LiveTranscriptsBtn["📜 Gemini Live Transcripts Modal"]
    end

    subgraph BackendServices ["FastAPI Backend Services"]
        SessionsAPI["GET /sessions?track={track}"]
        TracksAPI["GET /sessions/tracks"]
        FavToggleAPI["POST /sessions/{id}/favorite"]
        FavListAPI["GET /sessions/favorites"]
        AdminSessionCRUD["POST/PUT/DELETE /sessions (Back Office RBAC)"]
    end

    subgraph Storage ["Cloud SQL PostgreSQL"]
        SDB[("Sessions Table (id, title, track, room, start_time, end_time, speaker_name)")]
        UDB[("User Profile (id, favorite_sessions: JSONB/Array)")]
    end

    TrackSelector --> SessionsAPI
    MyAgendaTab --> FavListAPI
    FavButton --> FavToggleAPI
    FavToggleAPI --> UDB
    FavListAPI --> UDB
    FavListAPI --> SDB
    SessionsAPI --> SDB
    AdminSessionCRUD --> SDB
```

### Multi-Track & Back Office Flow Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Organizer / Staff
    actor User as Participant
    participant Client as Frontend PWA
    participant API as Sessions Service (/api/v1/sessions)
    participant DB as Cloud SQL Database

    Note over Admin,DB: Back Office Schedule Configuration
    Admin->>Client: Open Back Office -> Manage Agenda & Tracks
    Admin->>Client: Input Session (Title, Track, Time, Room, Speaker)
    Client->>API: POST /api/v1/sessions or PUT /api/v1/sessions/{id}
    API->>DB: Upsert Session Record
    API-->>Client: 200 OK (Updated Session)
    Client-->>Admin: Show Success Toast & Update Admin Table

    Note over User,DB: Participant Multi-Track & Favorites Flow
    User->>Client: Open Agenda Modal
    Client->>API: GET /sessions & GET /sessions/favorites
    API-->>Client: Return Multi-Track Sessions + User Favorite IDs
    User->>Client: Click Track Tab (e.g. "Track 1: AI & Agents")
    Client->>Client: Filter sessions for selected track
    User->>Client: Click ❤️ Favorite on Session
    Client->>API: POST /sessions/{id}/favorite
    API->>DB: Toggle ID in User.favorite_sessions
    API-->>Client: 200 OK (is_favorite: true)
    User->>Client: Click "⭐ My Agenda" Tab
    Client->>Client: Render all favorited talks across all conference tracks
```

---

## Firestore Event Document Hierarchy & Attendance Tracking

The database on Google Cloud Firestore uses the **Event Name / Slug as the top-level document key** under the `events` collection.

```mermaid
graph TD
    subgraph FirestoreRoot ["Google Cloud Firestore: Collection ('events')"]
        EventDoc["Document: events/{event_id} (e.g. 'devfest-bangkok-2026')"]
    end

    subgraph EventPayload ["Top-Level Event Document Fields"]
        EventMeta["Metadata: {theme, year, organizer, expected_capacity, registration_url}"]
        EventDate["Date: '2026-11-28'"]
        EventVenue["Venue: {name, address, rooms: ['Grand Ballroom', 'Room A1', 'Room B1', ...]}"]
        EventSpeakers["Speakers: [ {id, name, title, bio, avatar_url}, ... ]"]
        EventSessions["Sessions: [ {id, title, track, room, start_time, end_time, speaker_name}, ... ]"]
        EventSponsors["Sponsors: [ {id, name, tier, booth_url, description}, ... ]"]
        EventWorkshops["Workshops: [ {id, title, instructor, capacity, reserved_count, room_code}, ... ]"]
        EventSummary["Attendance Summary: {total_registered, total_attended, show_up_rate_percent, absent_count}"]
    end

    subgraph EventFeedbackSub ["Event Feedbacks (Collection: events/{event_id}/feedbacks)"]
        FB1["Feedback fb-1: {overall_rating: 5, content_rating: 5, venue_rating: 5, nps_score: 10, comments: '...', event_id}"]
    end

    subgraph EventQnaSub ["Stage Q&A (Collection: events/{event_id}/qna)"]
        QNA1["Q&A q-1: {question: '...', author: '...', upvotes: 14, upvoted_by: [...], event_id}"]
    end

    subgraph AttendanceSub ["Participants / Attendance Map on Date"]
        Partic1["Participant: user-partic-1<br/>ticket_ref: 'TICKET-DEV-001'<br/>attended: true<br/>checked_in_at: '2026-11-28T09:15:30Z'<br/>scanned_by: 'user-staff-1'"]
        Partic2["Participant: user-partic-2<br/>ticket_ref: 'TICKET-DEV-002'<br/>attended: false<br/>checked_in_at: null<br/>scanned_by: null"]
    end

    EventDoc --> EventMeta
    EventDoc --> EventDate
    EventDoc --> EventVenue
    EventDoc --> EventSpeakers
    EventDoc --> EventSessions
    EventDoc --> EventSponsors
    EventDoc --> EventWorkshops
    EventDoc --> EventSummary
    EventDoc --> EventFeedbackSub
    EventDoc --> EventQnaSub
    EventDoc --> AttendanceSub
```

### Participant Check-In & Show-Up Rate Tracking Flow

```mermaid
sequenceDiagram
    autonumber
    actor Attendee as Participant
    actor Staff as Staff / Organizer (Gate Scanner)
    participant Client as Back Office Console
    participant API as Firestore API (/api/v1/firestore/events)
    participant FS as Google Cloud Firestore

    Note over Attendee,FS: On Event Date (Check-In & Attendance)
    Attendee->>Staff: Shows Ticket QR / Reference (TICKET-DEV-001)
    Staff->>Client: Enters / Scans Ticket Ref into Check-In Scanner
    Client->>API: POST /firestore/events/{event_id}/checkin {ticket_ref: "TICKET-DEV-001"}
    API->>FS: Update participant.attended=true, checked_in_at=NOW, scanned_by=Staff.id
    API->>FS: Recalculate show_up_rate_percent = (total_attended / total_registered) * 100
    API-->>Client: 200 OK with updated participant and live attendance_summary
    Client-->>Staff: Live Success Toast & Updates Attendance Dashboard (Show-Up Rate %)
```

---

## Google Identity Services & Avatar Sync Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Attendee / Organizer
    participant GIS as Google Identity Services (GIS)
    participant Client as Frontend PWA (Client & LocalStorage)
    participant API as FastAPI Backend (/auth, /avatar)
    participant FS as Google Cloud Firestore (users/{id})

    alt 1. Avatar Customization in Character Studio
        User->>Client: Customizes look (skin, hair, outfit, cat_ears, aura) & clicks "Save Look"
        Client->>API: POST /api/v1/avatar/customize {skin_tone, hair_style, outfit_style, headwear, aura}
        API->>FS: Persist avatar_config in users/{id} & events/{event_id}/participants/{id}
        API-->>Client: 200 OK
        Client->>Client: Save to LocalStorage ('devfestverse_avatar') & render to 2D Canvas
    else 2. Returning User Logs In (Google Sign-In / Session Restore)
        User->>GIS: Click "Sign in with Google" / GIS One-Tap
        GIS-->>Client: Return Credential JWT (sub, email, name, picture)
        Client->>API: POST /api/v1/auth/google-login {google_token, email, display_name}
        API->>FS: Look up user by email in Firestore
        FS-->>API: Returns existing user with saved avatar_config!
        API-->>Client: 200 OK {user: {id, display_name, role, avatar_config}}
        Client->>Client: Restores saved avatar_config to studioConfig & player sprite
        Client-->>User: Welcome back! Restored your custom pixel character! 🎨
    else 3. App Load / Page Refresh
        Client->>Client: Reads cached session from LocalStorage
        Client->>API: GET /api/v1/auth/me (with x-user-id header)
        API->>FS: Fetch latest user document from Firestore
        FS-->>API: User profile & avatar_config
        API-->>Client: 200 OK
        Client->>Client: Synchronizes avatar look & updates live canvas
    end
```

---

## AI Agenda Generation & Auto-Fill Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Org as Organizer / Staff
    participant Client as Back Office Console
    participant AI_API as AI Agenda Generator (/backoffice/ai-agenda-generate)
    participant SessionAPI as Session Service (/sessions)
    participant FS as Cloud Firestore (events/{id}/sessions)

    Org->>Client: Pastes raw talk description or prompt into AI Auto-Fill
    Client->>AI_API: POST /api/v1/backoffice/ai-agenda-generate {prompt: "..."}
    AI_API->>AI_API: NLP structured extraction (title, speaker, track, room, start_time, end_time, description)
    AI_API-->>Client: Return structured JSON {title, speaker_name, track, room, times, description}
    Client-->>Org: Auto-populates all form inputs with pulsing glow animation
    Org->>Client: Reviews & clicks "Save Session"
    Client->>SessionAPI: POST /api/v1/sessions
    SessionAPI->>FS: Persist session to Cloud Firestore
    SessionAPI-->>Client: 200 OK (Schedule Updated across all clients)
```

---

## Attendee Feedback & NPS Satisfaction Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as Attendee
    participant Client as 2D Campus / Feedback Modal
    participant API as Feedback Service (/api/v1/feedback)
    participant FS as Cloud Firestore (events/{id}/feedbacks)
    participant BackOffice as Back Office Analytics

    User->>Client: Interacts with 📝 FEEDBACK KIOSK or HUD Button
    Client-->>User: Renders Star Rating, Category Selectors, NPS Slider (0-10), and Comments Box
    User->>Client: Submits Feedback
    Client->>API: POST /api/v1/feedback {overall_rating, content_rating, venue_rating, nps_score, comments}
    API->>FS: Write feedback record to Cloud Firestore
    API-->>Client: 200 OK Recorded
    BackOffice->>API: GET /api/v1/feedback/all (Organizer / Staff)
    API-->>BackOffice: Live KPIs (Total Responses, Average Overall, Content, Venue, Net Promoter Score)
```

---

## Real-World Multiplayer Architecture (200+ Active Players)

To smoothly support 200+ concurrent players in the 2D world on Google Cloud Run with minimal latency and negligible bandwidth costs, DevFestVerse employs a multi-tiered real-time spatial networking architecture:

```mermaid
graph TD
    subgraph Attendees ["200+ Concurrent Players (Browsers / Mobile PWAs)"]
        P1["Player 1 (Keynote Stage)"]
        P2["Player 2 (Builder Zone)"]
        P3["Player 3 (Workshop Labs)"]
        P_N["Player N..."]
    end

    subgraph ClientSideEngine ["Client-Side Interpolation (60 FPS)"]
        Lerp["Linear Interpolation (Lerp) & Dead Reckoning"]
        Throttler["15 Hz Position Broadcast Throttler"]
    end

    subgraph CloudRunCluster ["Google Cloud Run WebSocket Service (asia-southeast3)"]
        WS_GW["FastAPI WebSocket Gateway (/ws/presence)"]
        AoI["Spatial Partitioning Grid (Area of Interest - 320px Cells)"]
        DeltaComp["Delta State Compression (x, y, dir, state, anim)"]
    end

    subgraph ScaleLayer ["Distributed Scalability Layer"]
        RedisPubSub[("Google Cloud MemoryStore Redis (Pub/Sub Cluster Channel)")]
        FirestoreUsers[("Cloud Firestore (Persistent Avatars & Profiles)")]
    end

    P1 & P2 & P3 & P_N --> Throttler
    Throttler -->|15 Hz Delta Updates| WS_GW
    WS_GW --> AoI
    AoI --> DeltaComp
    DeltaComp -->|Broadcast Only to Nearby Viewports| WS_GW
    WS_GW -->|Inter-Instance Cluster Sync| RedisPubSub
    WS_GW --> FirestoreUsers
    WS_GW -->|Broadcast Delta Updates| Lerp
    Lerp --> P1 & P2 & P3 & P_N
```

### Key Scaling Mechanisms:
1. **Spatial Partitioning (Area of Interest - AoI)**:
   - The campus is divided into $320\times 320\text{ px}$ grid quadrants.
   - Position deltas are broadcast exclusively to clients within the player's immediate and adjacent grid cells ($O(1)$ lookup), reducing global network traffic from $O(N^2)$ to $O(N)$.
2. **Delta Compression & 15 Hz Rate Throttling**:
   - Rather than broadcasting entire player objects every render tick (60 Hz), positions are throttled to 15 Hz with minimal 5-field delta payloads (`[x, y, dir, moving, avatar_hash]`).
3. **Client-Side Linear Interpolation (Lerp)**:
   - The client smoothly interpolates remote player coordinates across animation frames, creating a seamless 60 FPS visual experience with zero jitter.
4. **Inter-Instance Synchronization**:
   - Cloud Run instances scale horizontally with session affinity. When multiple container revisions run concurrently, inter-instance sync is relayed via **Google Cloud MemoryStore (Redis Pub/Sub)**.

---

## Canvas Stability & Error Boundary Architecture

```mermaid
graph TD
    RAF["Browser requestAnimationFrame Loop"] --> TryCatch{"Error Boundary (try/catch)"}
    TryCatch -->|Normal Execution| Update["updatePlayer() & renderWorld()"]
    TryCatch -->|Transient Exception| ErrorHandler["Log to Sentry / Console & Recover Safely"]
    ErrorHandler --> RAF
    Update --> CanvasDraw["Canvas 2D Rendering Engine"]
    CanvasDraw --> BoundaryGuard{"Min Bounds Check (960x540)"}
    BoundaryGuard -->|Resize / Orientation Change| Reposition["repositionHotspots(w, h)"]
```

- **Render Loop Protection**: `gameLoop()` wraps all world rendering and player coordinate transforms inside a defensive error boundary, ensuring no uncaught runtime exceptions can ever terminate `requestAnimationFrame`.
- **Min Sizing Protection**: `resizeCanvas()` enforces a strict minimum viewport boundary ($960\times 540\text{ px}$) to prevent null/zero dimension collapses during browser minimize or modal transitions.
- **Automated Headless Canvas Test**: Verified via `frontend/tests/test_canvas_stability.js` executing 120+ continuous frames across 4 device viewports (Desktop, Laptop, Tablet, Mobile) with 0 failures.

---

## Builder Zone & Live Iframe Showcase Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Community Developer
    actor Attendee as DevFest Attendee
    participant Client as 2D Campus / Builder Hub
    participant API as Builders API (/api/v1/builders/projects)
    participant FS as Cloud Firestore (events/{id}/projects)
    participant Iframe as Sandboxed Interactive Iframe Viewport

    Dev->>Client: Clicks "Submit Project" in Builder Zone
    Client-->>Dev: Opens Submit Modal (Title, Category, Demo URL, GitHub, Tech Stack)
    Dev->>API: POST /api/v1/builders/projects
    API->>FS: Persist project to Firestore
    API-->>Client: 200 OK (Project Published)
    Attendee->>Client: Browses Builder Zone / Filter Category
    Client->>API: GET /api/v1/builders/projects
    API-->>Client: Return ranked projects list (sorted by upvotes)
    Attendee->>Client: Clicks "▶️ Launch Demo"
    Client->>Iframe: Embeds demo URL with safe HTML5 sandbox attributes
    Attendee->>Iframe: Interacts with the live community web app / AI tool
    Attendee->>Client: Clicks 👏 Upvote
    Client->>API: POST /api/v1/builders/projects/{id}/upvote
    API-->>Client: Updated upvote counter
```

---

## Google Cloud Run Deployment Architecture

Deployed to **Google Cloud Platform (GCP)** with cost-optimized scaling to 0 and single instance capping.

```mermaid
graph LR
    subgraph DevMachine ["Local / CI Pipeline"]
        SourceCode["Codebase (uv, FastAPI, Static PWA)"]
        DeployScript["deploy.sh / cloudbuild.yaml"]
    end

    subgraph GCP ["Google Cloud Platform (Configured GCP_PROJECT)"]
        CloudBuild["Cloud Build (Docker Container Build)"]
        ArtifactReg["Artifact Registry / Container Registry (gcr.io)"]
        CloudRun["Google Cloud Run: 'devfestverse'<br/>Region: asia-southeast3<br/>Min Instances: 0 (Scale-to-Zero)<br/>Max Instances: 1<br/>Memory: 512Mi | CPU: 1"]
        FirestoreDB[("Cloud Firestore (Top-Level Event, Attendance, Feedback, Sessions, Builder Projects)")]
        RedisStore[("Google Cloud MemoryStore Redis (WebSocket Presence Relay)")]
    end

    SourceCode --> DeployScript
    DeployScript --> CloudBuild
    CloudBuild --> ArtifactReg
    ArtifactReg --> CloudRun
    CloudRun --> FirestoreDB
    CloudRun --> RedisStore
```

---

## Multi-Event Multi-Role RBAC Architecture

Users can participate in multiple concurrent Google Developer community events (e.g. DevFest, AI Hackathon, Cloud Community Day) with isolated roles, ticket numbers, and check-in statuses per event.

```mermaid
erDiagram
    USERS_COLLECTION ||--o{ EVENT_MEMBERSHIPS : "holds role & ticket in"
    EVENTS_COLLECTION ||--o{ PARTICIPANTS_MAP : "contains"
    
    USERS_COLLECTION {
        string id PK "user-speaker-1"
        string email "speaker@ai-agents.io"
        string display_name "Dr. Agent"
        string global_role "PARTICIPANT"
        string auth_provider "google"
        map events "Event-scoped roles & tickets"
    }

    EVENT_MEMBERSHIPS {
        string event_id "devfest-bangkok-2026 | gdg-ai-hackathon-2026"
        string role "SPEAKER | ORGANIZER | STAFF | SPONSOR | PARTICIPANT"
        string ticket_ref "TICKET-DEV-003"
        boolean verified_ticket "true"
        boolean attended "true"
    }

    EVENTS_COLLECTION {
        string event_id PK "devfest-bangkok-2026"
        string event_name "GDG Cloud Bangkok DevFest 2026"
        map venue "Address & room details"
        array sessions "Agenda track sessions"
        map participants "Live check-in records"
    }
```

### Context-Aware Role Resolution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend Client (PWA)
    participant RBAC as FastAPI RBAC Dependency
    participant FS as Firestore / In-Memory Manager
    participant Backoffice as Back Office API

    Client->>RBAC: HTTP Request (Headers: x-user-id, x-event-id)
    RBAC->>FS: get_user(x_user_id)
    FS-->>RBAC: User Profile Document
    RBAC->>FS: get_user_role_in_event(user_id, x_event_id)
    Note over RBAC: Checks user.global_role == 'ORGANIZER'<br/>or user.events[x_event_id].role
    FS-->>RBAC: Effective Role & Event Ticket Context
    RBAC-->>Backoffice: Verified Context User (role=STAFF/ORGANIZER)
    Backoffice-->>Client: 200 OK (Event-scoped data response)
```

---

## API Permission Matrix & Anti-Privilege Escalation Security Model

To prevent privilege escalation, DevFestVerse employs strict defense-in-depth access controls:
1. **Self-Escalation Prevention**: Only existing `ORGANIZER` accounts can alter user roles or assign elevated roles. Non-organizers attempting to promote themselves receive `403 Forbidden`.
2. **Server-Side Token Validation**: Invitation links are single-use, randomly generated (`uuid4` cryptographically random tokens), bound to specific roles (`STAFF`, `SPEAKER`, `SPONSOR`), and strictly prohibit minting `ORGANIZER` links. Replay attempts are rejected with `400 Bad Request`.
3. **Immutable Realtime Presence State**: WebSocket position updates (`POSITION_UPDATE`) cannot mutate client `role` or `verified_ticket` properties. The server resolves authentic roles directly from Cloud Firestore upon connection.
4. **Isolated Event Contexts**: Role evaluations are context-scoped (`x-event-id`), preventing roles held in one event from granting permissions in another event unless the user holds global `ORGANIZER` status.

```mermaid
graph TD
    subgraph ClientLayer ["Client Invocations"]
        AttReq["Attendee / Client Request"]
    end

    subgraph SecurityFilter ["FastAPI Security & RBAC Pipeline"]
        Identity["get_current_user()<br/>Resolves Firestore Identity"]
        RoleCheck{"require_roles(allowed_roles)"}
        EscalationGuard{"Privilege Escalation Guard"}
    end

    subgraph ProtectedResources ["System Endpoints & Actions"]
        PublicOps["Public APIs (Sessions, Speakers, Sponsors, Transcripts)"]
        StaffOps["Staff APIs (Check-in, Announcements, Session Edit)"]
        OrganizerOps["Organizer APIs (User Roles, Lucky Draw, Event Switch)"]
    end

    AttReq --> Identity
    Identity --> RoleCheck
    RoleCheck -- "PARTICIPANT" --> PublicOps
    RoleCheck -- "STAFF" --> StaffOps
    RoleCheck -- "ORGANIZER" --> EscalationGuard
    EscalationGuard -- "Valid Organizer Action" --> OrganizerOps
    EscalationGuard -- "Unauthorized Self-Promotion" --> Deny["403 Forbidden"]
    RoleCheck -- "Role Mismatch" --> Deny
```

### Permission Matrix by Role

| Resource / Endpoint | `PARTICIPANT` | `SPEAKER` | `SPONSOR` | `STAFF` | `ORGANIZER` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Browse Agenda & Venue Map** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Design / Save Avatar** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Submit / Upvote Q&A** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Submit / Upvote Builder Project** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Verify Official Ticket** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Reserve / Cancel Workshop** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Submit Feedback & NPS** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Edit Sponsor Booth** | ❌ | ❌ | ✅ (Own Booth) | ❌ | ✅ |
| **Check-In Attendees on Date** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Create / Edit Agenda Sessions** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **AI Agenda Auto-Fill (CFP)** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Broadcast Announcements** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **View Staff-Only Alerts** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **View Attendee Feedback Analytics** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **View User Directory & Stats** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Promote / Change User Roles** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Generate Role Invite Tokens** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Delete User from Firestore** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Trigger Lucky Draw Raffle** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Switch Active Event Global Context** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Client-Side Firestore Caching & Mutation Invalidation Engine

To eliminate redundant reads and writes to Cloud Firestore, the web client employs a dual-tier caching layer (`sessionStorage` + in-memory fallback) with time-to-live (5-minute TTL) and automatic mutation-driven invalidation.

```mermaid
sequenceDiagram
    autonumber
    actor User as Attendee / Backoffice Admin
    participant App as Frontend (app.js / ClientCacheManager)
    participant Storage as Browser sessionStorage / Memory
    participant API as FastAPI Cloud Run Backend
    participant Firestore as Google Cloud Firestore (GCP)

    Note over User,Storage: 1. Read Request (e.g. Load Agenda / Event Users)
    User->>App: Opens Agenda / Back Office Directory
    App->>Storage: ClientCacheManager.get(cacheKey)
    alt Cache Hit (TTL < 5 mins)
        Storage-->>App: Cached JSON Response
        App-->>User: Instant UI render (0ms network, 0 Firestore reads)
    else Cache Miss / Expired
        App->>API: GET /api/v1/backoffice/users?event_id=devfest-2026
        API->>Firestore: db.collection("users").stream()
        Firestore-->>API: Streamed User Documents
        API-->>App: 200 OK JSON
        App->>Storage: ClientCacheManager.set(cacheKey, data, TTL=300s)
        App-->>User: Rendered UI & updated KPI cards
    end

    Note over User,Firestore: 2. Mutation Request (e.g. Change Role / Add Session)
    User->>App: Updates user role to 'SPEAKER' or clicks Force Refresh
    App->>API: POST /api/v1/backoffice/users/{id}/role
    API->>Firestore: update({ role: 'SPEAKER', ... })
    Firestore-->>API: Document Updated
    API-->>App: 200 OK
    App->>Storage: ClientCacheManager.invalidate()
    Note over App,Storage: All stale query caches cleared!
    App->>App: Auto re-fetch fresh state from Firestore
```

---

## Browser Local AI Character Generator Architecture

DevFestVerse allows users to generate compatible 2D pixel avatars using **Client-Side On-Device AI** directly within the browser without requiring external server calls:

```mermaid
graph TD
    User["Attendee Prompt / Quick Inspiration Chip"] --> PromptBar["Character Studio Prompt Engine"]
    PromptBar --> CheckEnv{"Check Browser Capabilities"}
    
    CheckEnv -->|window.ai Available| ChromeAI["Chrome Built-in AI (Prompt API / Gemini Nano)"]
    CheckEnv -->|Standard Browser| LocalNLP["Client-Side Semantic Rule & Keyword Model"]

    ChromeAI -->|On-Device Synthesis| AvatarConfig["Structured Avatar Configuration: {skin, hair, outfit, headwear, aura}"]
    LocalNLP -->|On-Device Mapping| AvatarConfig
    
    AvatarConfig --> PreviewCanvas["Studio Preview Canvas (128x128 2D Context)"]
    AvatarConfig --> FirestoreSave["Persist to Firestore on Apply"]
```

---

## Gemini 2.0 Unstructured Data Parsing Architecture

Organizers and staff can supply unstructured text (CFP submissions, talk abstracts, speaker bios, sponsor pitch decks, or company websites) and leverage **Google Gemini 2.0** to generate structured metadata:

```mermaid
sequenceDiagram
    autonumber
    actor Org as Organizer / Staff
    participant Client as Back Office Console
    participant SessionAPI as Session Service (/sessions/parse-gemini)
    participant SponsorAPI as Sponsor Service (/sponsors/parse-gemini)
    participant Gemini as Google Gemini 2.0 Flash / Vertex AI

    alt Parse Session Proposal
        Org->>Client: Pastes raw CFP abstract or email text
        Client->>SessionAPI: POST /api/v1/sessions/parse-gemini {raw_text}
        SessionAPI->>Gemini: Prompt structured JSON extraction (Title, Speaker, Bio, Track, Room, Times, Level, Takeaways)
        Gemini-->>SessionAPI: Clean structured session payload
        SessionAPI-->>Client: 200 OK
        Client-->>Org: Auto-populates all form inputs with glowing animation
    else Parse Sponsor Prospectus
        Org->>Client: Pastes company pitch or prospectus URL
        Client->>SponsorAPI: POST /api/v1/sponsors/parse-gemini {raw_text}
        SponsorAPI->>Gemini: Prompt structured extraction (Name, Tier, Tagline, Description, Iframe URL, Color, Swag, Roles)
        Gemini-->>SponsorAPI: Clean structured sponsor payload
        SponsorAPI-->>Client: 200 OK
        Client-->>Org: Auto-populates sponsor booth form & live iframe preview
    end
```

---

## Google Auth Platform Branding & Legal Compliance Architecture

To meet Google Cloud Identity Platform and OAuth 2.0 verification requirements, DevFestVerse hosts dedicated, customized branding and policy documents within the application:

```mermaid
graph TD
    subgraph GoogleOAuth ["Google Identity Platform"]
        OAuthScreen["OAuth Consent Screen Verification"]
        GooglePriv["Google Privacy Policy<br/>policies.google.com/privacy"]
        GoogleTerms["Google Terms of Service<br/>policies.google.com/terms"]
    end

    subgraph DevFestVerseApp ["DevFestVerse Platform (Hosted on Cloud Run)"]
        Landing["App Homepage: /"]
        PrivacyPage["Privacy Policy Page: /privacy"]
        TermsPage["Terms of Service Page: /terms"]
        SignInModal["Google Sign-In Modal<br/>(Embedded Compliance Links)"]
    end

    OAuthScreen -->|Verified App Home| Landing
    OAuthScreen -->|Verified Privacy URL| PrivacyPage
    OAuthScreen -->|Verified Terms URL| TermsPage
    
    SignInModal -->|Direct Link| PrivacyPage
    SignInModal -->|Direct Link| TermsPage
    PrivacyPage -.->|Governed by| GooglePriv
    TermsPage -.->|Governed by| GoogleTerms
```

---

## Verification & Test Plan

Automated test suites covering all microservice endpoints (**75 passed tests** via `uv run pytest`):
- `backend/tests/test_static_routes.py`: Tests root page serving, favicon, static assets, health check, **Hosted Privacy Policy (`/privacy`, `/privacy-policy`)**, and **Hosted Terms of Service (`/terms`, `/terms-of-service`)** including Google policy links verification.
- `backend/tests/test_avatar_auth.py`: Tests 2D avatar customization, Google sign-in integration, Gemini AI avatar synthesis, **Avatar Firestore Persistence & Re-Login Restore** (`test_avatar_restore_on_relogin`), and Firestore profile retrieval (`/auth/me`).
- `backend/tests/test_rbac_security.py`: Tests strict role-based access control, privilege escalation prevention, invitation link single-use enforcement, and context-aware permissions.
- `backend/tests/test_feedback.py`: Tests attendee feedback submission, category ratings, NPS calculations, organizer KPI summaries, per-event isolation, and per-event stage Q&A submission/upvoting.
- `backend/tests/test_sessions_transcribe.py`: Tests multi-track agenda filtering, favorites toggle, Gemini live transcript streaming, and **Gemini session proposal structured parsing** (`/sessions/parse-gemini`).
- `backend/tests/test_billboards_sponsors.py`: Tests community billboard links, sponsor booth configurations, and **Gemini sponsor prospectus structured parsing** (`/sponsors/parse-gemini`).
- `backend/tests/test_multi_event_rbac.py`: Tests multi-event role isolation, context-aware RBAC header resolution, event-scoped user listing, ticket linking, and event-specific role invite token redemption.
- `backend/tests/test_user_management.py`: Tests Google OAuth2 authentication token verification, Firestore user CRUD, and backoffice analytics.
- `backend/tests/test_frontend_canvas_integrity.py`: Automated headless Node.js canvas simulation testing 120+ animation frames and multi-resolution resizing with 0 errors.
- `backend/tests/test_realtime_presence.py`: Tests spatial partitioning grid (AoI) calculation, active player tracking, and cluster capacity stats.
- `backend/tests/test_builders.py`: Tests community project submission, track filtering, search, and upvote claps.
- `backend/tests/test_auth_invites.py`: Tests user registration, role promotion, and invitation link generation.
- `backend/tests/test_tickets.py`: Tests official ticket reference verification.
- `backend/tests/test_firestore_events.py`: Tests top-level Firestore event hierarchy, date/venue metadata updates, and participant check-in / live show-up rate calculations.
- `backend/tests/test_workshops.py`: Tests workshop seat capacity reservations and cancellation.
- `backend/tests/test_backoffice_apis.py`: Tests role changes, AI agenda prompt generation, active user tracking, and RBAC enforcement.

---

## 14. Balanced Venue Floorplan, Prominent Builder Zone & Customizable Booth Studio

### 14.1 Symmetrical & Collision-Free 2D Floorplan Architecture
To ensure high visual legibility and eliminate overlap across resolutions, the campus floorplan is partitioned into dedicated zones:
- **Top Center Keynote Stage**: Grand wooden keynote stage (`w/2 - 135` to `w/2 + 135`, `y: 16-104`) with stage podium and Google 4-color footlights.
- **Top Left Wing (Community Hub 1)**: `🌐 CHAPTER` (`gdg.community.dev`), `📘 FB PAGE`, `👥 FB GROUP`.
- **Top Right Wing (Community Hub 2)**: `💬 DISCORD`, `📷 INSTAGRAM`, `▶️ YOUTUBE`.
- **Centerpiece Pavilion (Builder Zone Hub)**: Centered at (`w/2 - 125, h/2 - 34`) with cyan cybernetic floor mat, animated corner laser brackets, and ambient holographic spotlight.
- **Left Flank**: `💻 WORKSHOP LABS` codelabs and AI hacking arena.
- **Right Flank**: `🏢 GOOGLE CLOUD BOOTH` & `🛍️ GDG SWAG SHOP` (LINE Shopping: `https://shop.line.me/@837etxse`).
- **Bottom Floor**: `🎫 TICKET VERIFY` & `📝 EVENT FEEDBACK` kiosks.
- **South-West Lounge**: Repositioned Lofi Coffee Lounge with velvet armchairs, wooden coffee table, laptop, and steaming cups (zero collisions).

```mermaid
flowchart TD
    subgraph VenueFloor ["Virtual Venue 2D Responsive Grid (Symmetrical Distribution)"]
        subgraph TopRow ["Top North Sector"]
            TL_Arcade["Top-Left Community Wing<br/>• 🌐 GDG Chapter<br/>• 📘 Facebook Page<br/>• 👥 Facebook Group"]
            StagePlatform["🏛️ Grand Keynote Stage & Screen<br/>(Centered: w/2 - 105, y: 32)<br/>• 🎤 MAIN STAGE AGENDA<br/>• Live Gemini Transcripts"]
            TR_Arcade["Top-Right Community Wing<br/>• 💬 Discord Server<br/>• 📷 Instagram<br/>• ▶️ YouTube Channel"]
        end

        subgraph MidRow ["Center Exhibition & Codelab Arena"]
            WS_Zone["💻 WORKSHOP LABS<br/>(Left Flank: x: 45, y: h/2 - 32)<br/>Hands-on Labs"]
            BZ_Hub["🛠️ BUILDER ZONE PAVILION<br/>(Centerpiece: w/2 - 125, y: h/2 - 34)<br/>• Neon Cyber Grid & Laser Corners<br/>• Community Web Apps & AI Demos<br/>• Built-in Live Iframe Runner"]
            RightBooths["Right Flank Pavilions<br/>• 🏢 Google Cloud Vertex AI Booth<br/>• 🛍️ GDG Swag & Merch Shop<br/>(LINE Shopping: @837etxse)"]
        end

        subgraph BottomRow ["South Entrance & Networking Floor"]
            LofiCafe["☕ Lofi Coffee & Beanbag Lounge<br/>(South-West: x: 235, y: h/2 + 35)<br/>Relaxed Networking Area"]
            TicketStation["🎫 TICKET VERIFY<br/>(x: w/2 - 205, y: h - 85)"]
            FeedbackStation["📝 EVENT FEEDBACK<br/>(x: w/2 + 20, y: h - 85)"]
        end
    end

    subgraph BoothCustomizer ["Customizable Booth Design Studio & LINE Shopping Module"]
        Presets["🎨 Quick Presets<br/>(Swag Shop, Title Sponsor, AI Sandbox, Arcade)"]
        CanvasPreview["Live 2D Sprite Preview Canvas<br/>(Realtime Color, Frame & Label Sync)"]
        DeployEngine["🚀 Dynamic Hotspot & DB Sync<br/>(/api/v1/sponsors & /api/v1/sponsors/generate-booth)"]
        LineShopping["🛍️ LINE Shopping Channel<br/>https://shop.line.me/@837etxse"]
    end

    Presets --> CanvasPreview
    CanvasPreview --> DeployEngine
    DeployEngine --> RightBooths
    RightBooths --> LineShopping
```

### 14.2 High-Legibility Typography & Glassmorphic UI Standards
- **Hotspot Bounding Boxes**: `bold 11px / 12px JetBrains Mono, monospace` (titles) and `bold 7.5px / 9.5px JetBrains Mono, monospace` (subtitles) with dynamic content-aware auto-padding.
- **Participant Overhead Name Tags**: `bold 11px JetBrains Mono, monospace` with dark translucent glass pill backgrounds (`rgba(11, 17, 33, 0.85)`).
- **Speech Bubbles**: `bold 11px JetBrains Mono, monospace` rendered with 28px ergonomic pill heights and generous padding.
- **Glassmorphic Proximity Hints**: Compact rounded pill badge (`0.72rem`, `border-radius: 20px`, `padding: 3px 10px`) with **12px backdrop blur** (`backdrop-filter: blur(12px) saturate(180%)`), subtle cyan border (`rgba(56, 189, 248, 0.4)`), and an embedded glowing keycap `<span class="hint-key">E</span>` that never blocks surrounding booths or characters.
